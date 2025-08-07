import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ImapService } from '../imap/imap.service';
import { EmailProcessingService } from '../email/email-processing.service';
import {
  ExecutionStatus,
  Prisma,
  ProcessingSchedule,
  ProcessingStatus,
  ProcessingType,
  ScheduleExecution,
} from '@prisma/client';
import { EmailBatchProcessingResult } from '../../types/email-processing.types';
import { EmailMessage } from '../../types/email.types';

@Injectable()
/**
 * Orchestrates time-based executions for processing schedules.
 * - Polls due schedules via cron and groups executions by timestamp.
 * - Acquires execution-time locks to avoid concurrent runs for the same slot.
 * - Creates a ScheduleExecution and delegates email processing to domain pipeline.
 * - Updates nextExecutionAt after completion, and releases locks reliably.
 *
 * Notes
 * - ScheduleExecution.status must use ExecutionStatus; ProcessingStatus is for processed emails only.
 * - This service computes the date window and fetches emails; transformation is delegated to the email module.
 */
export class ScheduleOrchestratorService {
  private readonly logger = new Logger(ScheduleOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailProcessingService: EmailProcessingService,
    private readonly imapService: ImapService
  ) {}

  /**
   * Cron entry point: checks for due schedules and executes them in conflict-free groups.
   * Runs every minute by design; lightweight when there are no due schedules.
   */
  @Cron('* * * * *')
  async checkAndExecuteScheduledJobs(): Promise<void> {
    const now = new Date();

    // Find schedules ready for execution
    const readySchedules = await this.findSchedulesReadyForExecution(now);

    // Group by execution time to prevent conflicts
    const executionGroups = this.groupSchedulesByExecutionTime(readySchedules);

    // Execute each group
    for (const [executionTime, schedules] of executionGroups) {
      await this.executeScheduleGroup(executionTime, schedules);
    }
  }

  /**
   * Executes a group of schedules that share the same execution time.
   * - Acquires a lock for the time slot to avoid duplicate runs.
   * - Executes schedules in parallel with error isolation.
   * - Always releases the lock at the end.
   */
  private async executeScheduleGroup(
    executionTime: Date,
    schedules: Prisma.ProcessingScheduleGetPayload<{}>[]
  ): Promise<void> {
    const scheduleIds = schedules.map((s) => s.id);

    // Lock execution time to prevent conflicts
    const lockAcquired = await this.acquireExecutionLock(
      executionTime,
      scheduleIds
    );
    if (!lockAcquired) {
      this.logger.warn(
        `Execution time ${executionTime} already locked, skipping ${schedules.length} schedules`
      );
      return;
    }

    this.logger.log(
      `Executing ${
        schedules.length
      } schedules at ${executionTime.toISOString()}`
    );

    try {
      // Execute schedules in parallel with error isolation
      const executions = schedules.map(async (schedule) => {
        try {
          const execution = await this.executeSchedule(schedule);
          this.logger.log(
            `Successfully executed schedule: ${schedule.name} (${execution.id})`
          );
          return { schedule, execution, success: true };
        } catch (error) {
          this.logger.error(
            `Failed to execute schedule: ${schedule.name}`,
            error
          );
          return { schedule, error, success: false };
        }
      });

      const results = await Promise.allSettled(executions);

      // Log execution summary
      const successful = results.filter(
        (r) => r.status === 'fulfilled' && r.value.success
      ).length;
      const failed = results.filter(
        (r) =>
          r.status === 'rejected' ||
          (r.status === 'fulfilled' && !r.value.success)
      ).length;

      this.logger.log(
        `Execution group completed: ${successful} successful, ${failed} failed`
      );
    } finally {
      // Always release the lock
      await this.releaseExecutionLock(executionTime);
    }
  }

  /**
   * Attempts to acquire a lock for a given execution timestamp and set of schedule IDs.
   * Returns true when the lock is acquired; false when another worker already holds it.
   */
  private async acquireExecutionLock(
    executionTime: Date,
    scheduleIds: string[]
  ): Promise<boolean> {
    try {
      await this.prisma.cronJobRegistry.create({
        data: {
          executionTime,
          scheduleIds,
          isLocked: true,
        },
      });

      this.logger.debug(
        `Acquired execution lock for ${executionTime.toISOString()}`
      );
      return true;
    } catch (error) {
      if (error.code === 'P2002') {
        // Unique constraint violation
        this.logger.warn(
          `Execution time ${executionTime.toISOString()} already locked`
        );
        return false;
      }
      throw error;
    }
  }

  /**
   * Releases the lock for the given execution timestamp.
   * Best-effort; errors are logged but not thrown to avoid masking upstream results.
   */
  private async releaseExecutionLock(executionTime: Date): Promise<void> {
    try {
      await this.prisma.cronJobRegistry.delete({
        where: { executionTime },
      });

      this.logger.debug(
        `Released execution lock for ${executionTime.toISOString()}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to release execution lock for ${executionTime.toISOString()}:`,
        error
      );
    }
  }

  /**
   * Executes a single schedule now.
   * - Creates a ScheduleExecution (RUNNING)
   * - Calculates date window by schedule type
   * - Fetches emails for the window
   * - Delegates processing to EmailProcessingService (schedule-aware)
   * - Completes the execution and updates nextExecutionAt
   * On error, marks execution as FAILED and rethrows.
   */
  async executeSchedule(
    schedule: ProcessingSchedule
  ): Promise<ScheduleExecution> {
    const execution = await this.createScheduleExecution(schedule);

    try {
      this.logger.log(`Starting execution for schedule: ${schedule.name}`);

      // Determine date range based on schedule type
      const dateRange = await this.calculateDateRangeForSchedule(schedule);

      // Fetch emails for processing
      const emails = await this.fetchEmailsForSchedule(schedule, dateRange);

      // Process emails in batches
      const results =
        await this.emailProcessingService.processEmailsWithScheduleConfig(
          schedule,
          emails,
          execution
        );

      // Update execution as completed
      await this.completeScheduleExecution(execution, results);

      // Update schedule's next execution time
      await this.updateScheduleNextExecution(schedule);

      return execution;
    } catch (error) {
      await this.failScheduleExecution(execution, error);
      throw error;
    }
  }

  /**
   * Returns the inclusive date window used to fetch emails for a schedule.
   * - DATE_RANGE: uses configured from/to
   * - RECURRING: since last successful execution (or schedule creation) until now
   * - SPECIFIC_DATES: 24h window around the next configured date
   */
  private async calculateDateRangeForSchedule(
    schedule: ProcessingSchedule
  ): Promise<{ since: Date; before?: Date }> {
    switch (schedule.processingType) {
      case ProcessingType.DATE_RANGE:
        return {
          since: schedule.dateRangeFrom,
          before: schedule.dateRangeTo,
        };

      case ProcessingType.RECURRING:
        // For recurring schedules, process emails since last execution
        const lastExecution = await this.getLastSuccessfulExecution(
          schedule.id
        );
        const since = lastExecution?.completedAt || schedule.createdAt;
        return { since, before: new Date() };

      case ProcessingType.SPECIFIC_DATES:
        // Process emails from the next specific date
        const nextDate = this.getNextSpecificDate(schedule);
        return {
          since: nextDate,
          before: new Date(nextDate.getTime() + 24 * 60 * 60 * 1000), // +1 day
        };

      default:
        throw new Error(
          `Unsupported processing type: ${schedule.processingType}`
        );
    }
  }

  /**
   * Finds schedules ready for execution (enabled and nextExecutionAt <= now).
   * Includes email account for downstream fetch context.
   */
  private async findSchedulesReadyForExecution(
    now: Date
  ): Promise<ProcessingSchedule[]> {
    return this.prisma.processingSchedule.findMany({
      where: {
        isEnabled: true,
        nextExecutionAt: {
          lte: now,
        },
      },
      include: {
        emailAccount: true,
      },
    });
  }

  /**
   * Groups schedules by their nextExecutionAt to coordinate locking and batch execution.
   */
  private groupSchedulesByExecutionTime(
    schedules: ProcessingSchedule[]
  ): Map<Date, ProcessingSchedule[]> {
    const groups = new Map<Date, ProcessingSchedule[]>();

    for (const schedule of schedules) {
      const executionTime = schedule.nextExecutionAt;
      const timeKey = new Date(executionTime.getTime());

      if (!groups.has(timeKey)) {
        groups.set(timeKey, []);
      }

      groups.get(timeKey).push(schedule);
    }

    return groups;
  }

  /**
   * Creates a new ScheduleExecution record with status RUNNING and start time.
   * Use ExecutionStatus enum for status values.
   */
  private async createScheduleExecution(
    schedule: ProcessingSchedule
  ): Promise<ScheduleExecution> {
    return this.prisma.scheduleExecution.create({
      data: {
        scheduleId: schedule.id,
        status: ExecutionStatus.RUNNING,
        startedAt: new Date(),
        maxAttempts: 3,
      },
    });
  }

  /**
   * Marks the ScheduleExecution as COMPLETED and records summary metrics and duration.
   * Note: This should use ExecutionStatus for the execution; ProcessingStatus applies to email records.
   */
  private async completeScheduleExecution(
    execution: ScheduleExecution,
    results: EmailBatchProcessingResult
  ): Promise<void> {
    const processingDuration = Date.now() - execution.startedAt.getTime();

    await this.prisma.scheduleExecution.update({
      where: { id: execution.id },
      data: {
        status: ProcessingStatus.COMPLETED,
        completedAt: new Date(),
        processedEmailsCount: results.processed,
        failedEmailsCount: results.failed,
        processingDurationMs: processingDuration,
      },
    });
  }

  /**
   * Marks the ScheduleExecution as FAILED and records error details and completion time.
   * Note: Use ExecutionStatus for execution status.
   */
  private async failScheduleExecution(
    execution: ScheduleExecution,
    error: Error
  ): Promise<void> {
    await this.prisma.scheduleExecution.update({
      where: { id: execution.id },
      data: {
        status: ProcessingStatus.FAILED,
        completedAt: new Date(),
        errorMessage: error.message,
        errorDetails: {
          stack: error.stack,
          timestamp: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Gets the last successful execution for a schedule, used to compute recurring windows.
   */
  private async getLastSuccessfulExecution(
    scheduleId: string
  ): Promise<ScheduleExecution | null> {
    return this.prisma.scheduleExecution.findFirst({
      where: {
        scheduleId,
        status: ProcessingStatus.COMPLETED,
      },
      orderBy: {
        completedAt: 'desc',
      },
    });
  }

  /**
   * Selects the next upcoming date from SPECIFIC_DATES configuration.
   * Throws when no future dates are present.
   */
  private getNextSpecificDate(schedule: ProcessingSchedule): Date {
    const specificDates = schedule.specificDates as string[];
    const now = new Date();

    const futureDates = specificDates
      .map((d) => new Date(d))
      .filter((d) => d > now)
      .sort((a, b) => a.getTime() - b.getTime());

    if (futureDates.length === 0) {
      throw new Error('No future dates available in schedule configuration');
    }

    return futureDates[0];
  }

  /**
   * Calculates and persists the nextExecutionAt for the schedule after a run.
   * - DATE_RANGE: disables schedule after one-time execution
   * - RECURRING: parses cron with timezone to compute next occurrence
   * - SPECIFIC_DATES: advances to the next future date or clears nextExecutionAt
   */
  private async updateScheduleNextExecution(
    schedule: ProcessingSchedule
  ): Promise<void> {
    let nextExecution: Date | null = null;

    switch (schedule.processingType) {
      case ProcessingType.DATE_RANGE:
        // One-time execution, disable after completion
        await this.prisma.processingSchedule.update({
          where: { id: schedule.id },
          data: { isEnabled: false },
        });
        return;

      case ProcessingType.RECURRING:
        if (!schedule.cronExpression) return;

        // Use cron parser to calculate next execution
        const parser = require('cron-parser');
        const interval = parser.parseExpression(schedule.cronExpression, {
          currentDate: new Date(),
          tz: schedule.timezone || 'UTC',
        });

        nextExecution = interval.next().toDate();
        break;

      case ProcessingType.SPECIFIC_DATES:
        const specificDates = schedule.specificDates as string[];
        const now = new Date();

        const futureDates = specificDates
          .map((d) => new Date(d))
          .filter((d) => d > now)
          .sort((a, b) => a.getTime() - b.getTime());

        nextExecution = futureDates.length > 0 ? futureDates[0] : null;
        break;
    }

    if (nextExecution) {
      await this.prisma.processingSchedule.update({
        where: { id: schedule.id },
        data: {
          nextExecutionAt: nextExecution,
          lastExecutedAt: new Date(),
          totalExecutions: { increment: 1 },
          successfulExecutions: { increment: 1 },
        },
      });
    }
  }

  /**
   * Fetches emails for the given schedule and computed date window.
   * Delegates to IMAP service with a bounded max per execution.
   */
  private async fetchEmailsForSchedule(
    schedule: ProcessingSchedule,
    dateRange: { since: Date; before?: Date }
  ): Promise<EmailMessage[]> {
    return this.imapService.fetchEmailsWithDateFilter(
      schedule.emailAccountId,
      dateRange.since,
      dateRange.before,
      1000 // Max emails per execution
    );
  }
}
