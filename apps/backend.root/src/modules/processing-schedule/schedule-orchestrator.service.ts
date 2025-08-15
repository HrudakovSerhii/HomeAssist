import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ImapService } from '../imap/imap.service';
import { EmailProcessingService } from '../email/email-processing.service';
import { LLMService } from '../llm/llm.service';
import {
  ExecutionStatus,
  Prisma,
  ProcessingSchedule,
  ProcessingType,
  ScheduleExecution,
} from '@prisma/client';
import { EmailBatchProcessingResult } from '../../types/email-processing.types';
import { EmailMessage } from '../../types/email.types';
import { CronJob } from 'cron';
import { ConfigService } from '@nestjs/config';

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
    private readonly imapService: ImapService,
    private readonly configService: ConfigService,
    private readonly llmService: LLMService
  ) {}

  /**
   * Cron entry point: checks for due schedules and executes them in conflict-free groups.
   * Runs every minute by design; lightweight when there are no due schedules.
   */
  @Cron(CronExpression.EVERY_MINUTE)
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
    schedules: ProcessingSchedule[]
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

      // Check LLM availability before processing
      if (!(await this.checkLLMAvailability())) {
        throw new Error('LLM service is not available');
      }

      // Determine per-execution limit
      const envCap = this.configService.get<number>('processing.maxEmailsPerExecution');
      const scheduleBatchSize = schedule.batchSize || 5; // Default to 5 if not set
      const limit = Math.min(scheduleBatchSize, envCap || Number.MAX_SAFE_INTEGER);

      this.logger.log(
        `📊 Processing limits - Schedule batchSize: ${scheduleBatchSize}, Environment cap: ${envCap}, Final limit: ${limit}`
      );

      // Fetch emails for processing
      const dateRange = await this.calculateDateRangeForSchedule(schedule);
      this.logger.log(
        `📅 Date range: ${dateRange.since.toISOString()} to ${dateRange.before.toISOString()}`
      );
      
      const emails = await this.fetchEmailsForSchedule(schedule, dateRange, limit);
      this.logger.log(`📬 Fetched ${emails.length} emails for processing`);

      // Process emails in batches
      const results =
        await this.emailProcessingService.processEmailsWithScheduleConfig(
          schedule,
          emails,
          execution
        );

      // Update execution as completed
      await this.completeScheduleExecution(execution, results);

      // Update account markers
      await this.prisma.emailAccount.update({
        where: { id: schedule.emailAccountId },
        data: { lastProcessedAt: new Date() },
      });

      // Update schedule's next execution time
      await this.updateScheduleNextExecution(schedule);

      return execution;
    } catch (error) {
      await this.failScheduleExecution(execution, error);
      throw error;
    }
  }

  /**
   * Determines what emails to process for a given schedule execution.
   * Currently implements "last successfully processed email" strategy.
   * Future expansions: specific sender, topic filtering, custom date ranges.
   */
  private async determineEmailSelectionStrategy(
    schedule: ProcessingSchedule
  ): Promise<{ since: Date; before: Date }> {
    const now = new Date();
    
    // Strategy: Process from last COMPLETED processed email for this account
    const lastProcessed = await this.prisma.processedEmails.findFirst({
      where: {
        emailAccountId: schedule.emailAccountId,
        processingStatus: 'COMPLETED',
      },
      orderBy: { receivedAt: 'desc' },
      select: { receivedAt: true },
    });

    if (lastProcessed?.receivedAt) {
      this.logger.log(`Using last processed email strategy: since ${lastProcessed.receivedAt.toISOString()}`);
      return { since: lastProcessed.receivedAt, before: now };
    }

    // Initial-run fallback: short lookback window
    const lookbackDays = this.configService.get<number>('processing.initialLookbackDays') || 7;
    const since = new Date(now);
    since.setDate(since.getDate() - lookbackDays);
    this.logger.log(`Using initial lookback strategy: ${lookbackDays} days (since ${since.toISOString()})`);
    return { since, before: now };
  }

  /**
   * Returns the date window for email selection.
   * Simplified to use a single email selection strategy regardless of schedule type.
   * ProcessingType is now only used for schedule timing validation and UI navigation.
   */
  private async calculateDateRangeForSchedule(
    schedule: ProcessingSchedule
  ): Promise<{ since: Date; before: Date }> {
    return this.determineEmailSelectionStrategy(schedule);
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
        status: ExecutionStatus.COMPLETED,
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
        status: ExecutionStatus.FAILED,
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
        status: ExecutionStatus.COMPLETED,
      },
      orderBy: {
        completedAt: 'desc',
      },
    });
  }



  /**
   * Calculates and persists the nextExecutionAt for the schedule after a run.
   * ProcessingType determines WHEN to run next (schedule timing), not what emails to process.
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

      case ProcessingType.RECURRING: {
        if (!schedule.cronExpression) return;

        // Use CronJob to calculate next execution honoring timezone
        const job = new CronJob(
          schedule.cronExpression,
          () => null,
          undefined,
          false,
          schedule.timezone || 'UTC'
        );
        nextExecution = job.nextDate().toJSDate();
        break;
      }

      case ProcessingType.SPECIFIC_DATES: {
        const specificDates = schedule.specificDates as string[];
        const now = new Date();

        const futureDates = specificDates
          .map((d) => new Date(d))
          .filter((d) => d > now)
          .sort((a, b) => a.getTime() - b.getTime());

        nextExecution = futureDates.length > 0 ? futureDates[0] : null;
        break;
      }
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
   * NEW IMPROVED FLOW:
   * 1. First check DB for failed/pending emails in date range
   * 2. If fewer than limit, fetch additional emails from IMAP
   * 3. Always return exactly 'limit' emails, prioritizing failed ones
   */
  private async fetchEmailsForSchedule(
    schedule: ProcessingSchedule,
    dateRange: { since: Date; before: Date },
    limit: number
  ): Promise<EmailMessage[]> {
    const startTime = Date.now();
    this.logger.log(
      `🔍 Smart email fetching: looking for ${limit} emails from ${dateRange.since.toISOString()} to ${dateRange.before.toISOString()}`
    );

    // Step 1: Check DB for failed/pending emails in date range
    const failedEmails = await this.getFailedEmailsFromDB(
      schedule.emailAccountId,
      dateRange.since,
      dateRange.before,
      limit
    );

    this.logger.log(
      `📊 Found ${failedEmails.length} failed/pending emails in DB`
    );

    // Step 2: If we have enough failed emails, return them
    if (failedEmails.length >= limit) {
      this.logger.log(
        `✅ Using ${limit} failed emails from DB (prioritizing retries)`
      );
      return failedEmails.slice(0, limit);
    }

    // Step 3: Fetch additional emails from IMAP to reach the limit
    const remainingNeeded = limit - failedEmails.length;
    this.logger.log(
      `📥 Need ${remainingNeeded} more emails, fetching from IMAP...`
    );

    // Get messageIds of failed emails to exclude them from IMAP fetch
    const failedMessageIds = failedEmails.map(email => email.messageId);

    const freshEmails = await this.fetchFreshEmailsFromIMAP(
      schedule.emailAccountId,
      dateRange.since,
      dateRange.before,
      remainingNeeded,
      failedMessageIds
    );

    this.logger.log(
      `📬 Fetched ${freshEmails.length} fresh emails from IMAP`
    );

    // Combine failed emails (priority) + fresh emails
    const combinedEmails = [...failedEmails, ...freshEmails];

    const totalTime = Date.now() - startTime;
    this.logger.log(
      `🎯 Smart fetch completed in ${totalTime}ms: ${failedEmails.length} failed + ${freshEmails.length} fresh = ${combinedEmails.length} total emails`
    );

    return combinedEmails;
  }

  /**
   * Retrieves failed/pending emails from database within date range
   */
  private async getFailedEmailsFromDB(
    emailAccountId: string,
    since: Date,
    before: Date,
    limit: number
  ): Promise<EmailMessage[]> {
    const processedEmails = await this.prisma.processedEmails.findMany({
      where: {
        emailAccountId,
        receivedAt: {
          gte: since,
          lte: before,
        },
        processingStatus: {
          in: ['FAILED', 'PENDING'], // Include both failed and pending
        },
      },
      orderBy: [
        { processingStatus: 'asc' }, // FAILED first, then PENDING
        { receivedAt: 'desc' }, // Most recent first
      ],
      take: limit,
    });

    // Convert ProcessedEmail records back to EmailMessage format
    return processedEmails.map(pe => ({
      messageId: pe.messageId,
      subject: pe.subject || '',
      from: pe.fromAddress || '',
      to: pe.toAddresses || [],
      cc: pe.ccAddresses || [],
      bcc: pe.bccAddresses || [],
      date: pe.receivedAt,
      bodyText: pe.bodyText || '',
      bodyHtml: pe.bodyHtml || '',
      uid: 0, // Not available from DB
      seq: 0, // Not available from DB
      flags: [], // Not available from DB, use empty array
    }));
  }

  /**
   * Fetches fresh emails from IMAP, excluding already processed ones
   */
  private async fetchFreshEmailsFromIMAP(
    emailAccountId: string,
    since: Date,
    before: Date,
    limit: number,
    excludeMessageIds: string[]
  ): Promise<EmailMessage[]> {
    if (limit <= 0) {
      return [];
    }

    // Fetch more emails than needed to account for exclusions
    const fetchLimit = Math.min(limit * 3, 1000); // Fetch up to 3x limit but cap at 1000

    const allEmails = await this.imapService.fetchEmailsWithDateFilter(
      emailAccountId,
      since,
      before,
      fetchLimit
    );

    // Filter out already processed emails
    const freshEmails = allEmails.filter(
      email => !excludeMessageIds.includes(email.messageId)
    );

    // Get already processed messageIds to exclude completed emails too
    const allMessageIds = freshEmails.map(email => email.messageId);
    const processedMessageIds = await this.getProcessedMessageIds(
      emailAccountId,
      allMessageIds
    );

    // Filter out all processed emails (not just failed ones)
    const trulyFreshEmails = freshEmails.filter(
      email => !processedMessageIds.includes(email.messageId)
    );

    this.logger.log(
      `📋 IMAP filtering: ${allEmails.length} total → ${freshEmails.length} not failed → ${trulyFreshEmails.length} truly fresh`
    );

    return trulyFreshEmails.slice(0, limit);
  }

  /**
   * Get messageIds that have already been processed (any status)
   */
  private async getProcessedMessageIds(
    emailAccountId: string,
    messageIds: string[]
  ): Promise<string[]> {
    if (messageIds.length === 0) return [];

    const processedEmails = await this.prisma.processedEmails.findMany({
      where: {
        emailAccountId,
        messageId: {
          in: messageIds,
        },
      },
      select: {
        messageId: true,
      },
    });

    return processedEmails.map(pe => pe.messageId);
  }

  /**
   * Simple check for LLM availability using configured URL
   * @returns Promise<boolean> - true if LLM is available, false otherwise
   */
  private async checkLLMAvailability(): Promise<boolean> {
    try {
      const ollamaUrl = this.configService.get('llm.ollamaUrl');
      if (!ollamaUrl) {
        this.logger.error('LLM URL not configured');
        return false;
      }

      // Simple ping to check if Ollama is running
      const response = await fetch(`${ollamaUrl.replace(/\/$/, '')}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000), // 3 second timeout
      });

      const isAvailable = response.ok;
      if (!isAvailable) {
        this.logger.error(`LLM service check failed with status: ${response.status}`);
      }
      
      return isAvailable;
    } catch (error) {
      this.logger.error(`LLM service is not available: ${error.message}`);
      return false;
    }
  }
}
