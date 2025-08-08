import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  Priority,
  EmailCategory,
  ProcessingType,
  LlmFocus,
  ProcessingSchedule,
} from '@prisma/client';
import { CronJob } from 'cron';
import {
  CreateProcessingScheduleDto,
  ScheduleExecutionStatus,
  ProcessingScheduleWithAccount,
  UpdateProcessingScheduleDto,
  ValidationResult,
  ProcessingAnalytics,
} from '../../types/schedule.types';

@Injectable()
/**
 * Manages processing schedule configurations (CRUD), validation, conflict checks,
 * and next-execution calculation. Does not perform email processing; delegates to orchestrator.
 *
 * First-version behavior notes:
 * - New email accounts should get a default schedule that covers the last month.
 * - That default should not auto-execute until user manually triggers it (e.g., set isEnabled=false).
 */
export class ProcessingScheduleService {
  private readonly logger = new Logger(ProcessingScheduleService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a default initial schedule for a new email account covering the last month.
   * Intended to be disabled by default so it won't run until manually triggered.
   */
  async createDefaultScheduleForNewAccount(
    userId: string,
    accountId: string
  ): Promise<ProcessingSchedule> {
    // Check if user already has default schedule for this account
    const existingDefault = await this.prisma.processingSchedule.findFirst({
      where: {
        userId,
        emailAccountId: accountId,
        isDefault: true,
      },
    });

    if (existingDefault) {
      return existingDefault;
    }

    // Create default "Initial" schedule (1 month historical processing)
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const defaultSchedule = await this.prisma.processingSchedule.create({
      data: {
        userId,
        emailAccountId: accountId,
        name: 'Initial',
        description:
          'Initial processing of historical emails from the past month',
        isDefault: true,
        isEnabled: false,
        processingType: ProcessingType.DATE_RANGE,
        dateRangeFrom: oneMonthAgo,
        dateRangeTo: new Date(),
        batchSize: 5,
        emailTypePriorities: {
          [EmailCategory.APPOINTMENT]: Priority.HIGH,
          [EmailCategory.INVOICE]: Priority.HIGH,
          [EmailCategory.WORK]: Priority.MEDIUM,
        },
        llmFocus: LlmFocus.general,
      },
    });

    // Mark account as having initial schedule
    await this.prisma.emailAccount.update({
      where: { id: accountId },
      data: { hasInitialSchedule: true },
    });

    this.logger.log(`Created default schedule for email account: ${accountId}`);
    return defaultSchedule;
  }

  /**
   * Creates a user-defined processing schedule and computes nextExecutionAt.
   * Validation should be performed by validateScheduleConfiguration before calling this.
   */
  async createProcessingSchedule(
    dto: CreateProcessingScheduleDto
  ): Promise<ProcessingSchedule> {
    // Calculate next execution time
    const nextExecution = await this.calculateNextExecutionTime(dto);

    const schedule = await this.prisma.processingSchedule.create({
      data: {
        ...dto,
        nextExecutionAt: nextExecution,
      },
    });

    this.logger.log(`Created processing schedule: ${schedule.name}`);
    return schedule;
  }

  /**
   * Updates a processing schedule. If timing-related fields change, recomputes nextExecutionAt.
   */
  async updateProcessingSchedule(
    id: string,
    dto: UpdateProcessingScheduleDto
  ): Promise<ProcessingSchedule> {
    // Recalculate next execution if timing changed
    let nextExecution: Date | null | undefined = undefined;
    if (dto.cronExpression || dto.timezone || dto.specificDates) {
      nextExecution = await this.calculateNextExecutionTime(dto);
    }

    const schedule = await this.prisma.processingSchedule.update({
      where: { id },
      data: {
        ...dto,
        ...(nextExecution !== undefined && { nextExecutionAt: nextExecution }),
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Updated processing schedule: ${schedule.name}`);
    return schedule;
  }

  /**
   * Deletes a processing schedule by ID.
   */
  async deleteProcessingSchedule(id: string): Promise<void> {
    await this.prisma.processingSchedule.delete({
      where: { id },
    });

    this.logger.log(`Deleted processing schedule: ${id}`);
  }

  /**
   * Returns the latest execution status summary for a schedule.
   * Uses the most recent ScheduleExecution to compute progress metrics.
   */
  async getScheduleExecutionStatus(
    scheduleId: string
  ): Promise<ScheduleExecutionStatus> {
    const schedule = await this.prisma.processingSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    const latestExecution = schedule.executions[0];

    if (!latestExecution) {
      return {
        id: schedule.id,
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        status: 'CANCELLED',
        progress: {
          totalBatches: 0,
          completedBatches: 0,
          totalEmails: 0,
          processedEmails: 0,
          failedEmails: 0,
          completionPercentage: 0,
        },
        timing: {
          startedAt: schedule.createdAt,
        },
      };
    }

    return {
      id: latestExecution.id,
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      status: latestExecution.status,
      progress: {
        totalBatches: latestExecution.totalBatchesCount,
        completedBatches: latestExecution.completedBatchesCount,
        totalEmails: latestExecution.totalEmailsCount,
        processedEmails: latestExecution.processedEmailsCount,
        failedEmails: latestExecution.failedEmailsCount,
        completionPercentage:
          latestExecution.totalEmailsCount > 0
            ? Math.round(
                (latestExecution.processedEmailsCount /
                  latestExecution.totalEmailsCount) *
                  100
              )
            : 0,
      },
      timing: {
        startedAt: latestExecution.startedAt,
        completedAt: latestExecution.completedAt,
        processingDuration: latestExecution.processingDurationMs,
      },
      error: latestExecution.errorMessage
        ? {
            message: latestExecution.errorMessage,
            details: latestExecution.errorDetails,
          }
        : undefined,
    };
  }

  /**
   * Validates schedule configuration for required fields per processingType,
   * and checks for duplicates/conflicts within the same user and email account.
   */
  async validateScheduleConfiguration(
    dto: CreateProcessingScheduleDto | UpdateProcessingScheduleDto,
    excludeId?: string
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (dto.processingType === ProcessingType.RECURRING) {
      if (!dto.cronExpression) {
        errors.push('Cron expression is required for recurring schedules.');
      } else {
        try {
          new CronJob(dto.cronExpression, () => {
            // Empty function for validation only
          });
        } catch (error) {
          errors.push(
            `Invalid cron expression: ${error.message}. Please check the format.`
          );
        }
      }
    }

    if (dto.processingType === ProcessingType.SPECIFIC_DATES) {
      if (!dto.specificDates || dto.specificDates.length === 0) {
        errors.push('Specific dates are required for specific date schedules.');
      } else {
        const now = new Date();
        const futureDates = (dto.specificDates as unknown as (string | Date)[])
          .map((d) => new Date(d))
          .filter((d) => d > now);

        if (futureDates.length === 0) {
          errors.push('No future specific dates found.');
        }
      }
    }

    if (dto.processingType === ProcessingType.DATE_RANGE) {
      if (!dto.dateRangeFrom || !dto.dateRangeTo) {
        errors.push('Date range is required for date range schedules.');
      } else {
        if (dto.dateRangeFrom >= dto.dateRangeTo) {
          errors.push('Date range from must be before date range to.');
        }
      }
    }

    // Check for conflicts only if userId and emailAccountId are provided
    if (dto.userId && dto.emailAccountId) {
      if (dto.processingType === ProcessingType.RECURRING && dto.cronExpression) {
        const existingRecurringSchedules = await this.prisma.processingSchedule.findMany({
          where: {
            userId: dto.userId,
            emailAccountId: dto.emailAccountId,
            cronExpression: dto.cronExpression,
            ...(excludeId && { id: { not: excludeId } }),
          },
        });

        if (existingRecurringSchedules.length > 0) {
          errors.push(
            `A recurring schedule with the same cron expression already exists for this account.`
          );
        }
      }

      if (dto.processingType === ProcessingType.SPECIFIC_DATES && dto.specificDates) {
        const existingSpecificDateSchedules = await this.prisma.processingSchedule.findMany({
          where: {
            userId: dto.userId,
            emailAccountId: dto.emailAccountId,
            specificDates: {
              array_contains: (dto.specificDates as unknown as (string | Date)[]),
            },
            ...(excludeId && { id: { not: excludeId } }),
          },
        });

        if (existingSpecificDateSchedules.length > 0) {
          errors.push(
            `A specific date schedule with the same dates already exists for this account.`
          );
        }
      }

      if (dto.processingType === ProcessingType.DATE_RANGE && dto.dateRangeFrom && dto.dateRangeTo) {
        const existingDateRangeSchedules = await this.prisma.processingSchedule.findMany({
          where: {
            userId: dto.userId,
            emailAccountId: dto.emailAccountId,
            dateRangeFrom: dto.dateRangeFrom,
            dateRangeTo: dto.dateRangeTo,
            ...(excludeId && { id: { not: excludeId } }),
          },
        });

        if (existingDateRangeSchedules.length > 0) {
          errors.push(
            `A date range schedule with the same dates already exists for this account.`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get schedule by ID
   */
  async getScheduleById(id: string): Promise<ProcessingSchedule | null> {
    return this.prisma.processingSchedule.findUnique({
      where: { id },
    });
  }

  /**
   * Returns user's processing schedules with linked account info for display.
   */
  async getUserSchedules(
    userId: string
  ): Promise<ProcessingScheduleWithAccount[]> {
    const schedules = await this.prisma.processingSchedule.findMany({
      where: { userId },
      include: {
        emailAccount: {
          select: { email: true, displayName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return schedules;
  }

  /**
   * Returns schedules for a specific email account ID.
   */
  async getAccountSchedules(accountId: string): Promise<ProcessingSchedule[]> {
    return this.prisma.processingSchedule.findMany({
      where: { emailAccountId: accountId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Checks for cron execution time conflicts for the same timezone and returns
   * conflicting schedule names and suggested alternative times.
   */
  async checkCronExecutionConflicts(
    cronExpression: string,
    timezone: string,
    excludeId?: string
  ): Promise<{
    conflictTime: Date;
    conflictingSchedules: string[];
    suggestedAlternatives: Date[];
  }[]> {
    const existingSchedules = await this.prisma.processingSchedule.findMany({
      where: {
        cronExpression: cronExpression,
        timezone: timezone,
        isEnabled: true,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });

    if (existingSchedules.length === 0) {
      return [];
    }

    try {
      const job = new CronJob(cronExpression, () => {
        // Empty function for validation only
      });
      const nextExecution = job.nextDate().toJSDate();

      return [{
        conflictTime: nextExecution,
        conflictingSchedules: existingSchedules.map(s => s.name),
        suggestedAlternatives: this.suggestAlternativeExecutionTimes(nextExecution),
      }];
    } catch (error) {
      this.logger.error('Invalid cron expression:', error);
      return [];
    }
  }

  /**
   * Checks for overlaps in specific scheduled dates and returns the conflicting dates.
   */
  async checkSpecificDateConflicts(
    specificDates: Date[],
    excludeId?: string
  ): Promise<Date[]> {
    const conflicts: Date[] = [];

    for (const date of specificDates) {
      const existingSchedules = await this.prisma.processingSchedule.findMany({
        where: {
          processingType: ProcessingType.SPECIFIC_DATES,
          isEnabled: true,
          ...(excludeId && { id: { not: excludeId } }),
        },
      });

      // Check if any existing schedule has this specific date
      for (const schedule of existingSchedules) {
        const scheduleDates = schedule.specificDates ? 
          (schedule.specificDates as unknown as Date[]).map(d => new Date(d)) : 
          [];
        if (scheduleDates.some(d => d.getTime() === date.getTime())) {
          conflicts.push(date);
          break;
        }
      }
    }

    return conflicts;
  }

  /**
   * Suggests alternative execution times relative to a base date.
   * Currently suggests +1h, +2h, +3h, and same time next day.
   */
  suggestAlternativeExecutionTimes(baseDate: Date): Date[] {
    const alternatives: Date[] = [];
    const base = new Date(baseDate);

    // Suggest times 1, 2, 3 hours later
    for (let i = 1; i <= 3; i++) {
      const alternative = new Date(base);
      alternative.setHours(alternative.getHours() + i);
      alternatives.push(alternative);
    }

    // Suggest same time next day
    const nextDay = new Date(base);
    nextDay.setDate(nextDay.getDate() + 1);
    alternatives.push(nextDay);

    return alternatives;
  }

  /**
   * Aggregates analytics across a user's schedules and recent executions.
   */
  async getProcessingAnalytics(userId: string): Promise<ProcessingAnalytics> {
    const schedules = await this.prisma.processingSchedule.findMany({
      where: { userId },
      include: {
        executions: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
      },
    });

    const totalSchedules = schedules.length;
    const activeSchedules = schedules.filter(s => s.isEnabled).length;

    const allExecutions = schedules.flatMap(s => s.executions);
    const totalExecutions = allExecutions.length;
    const successfulExecutions = allExecutions.filter(e => e.status === 'COMPLETED').length;
    const failedExecutions = allExecutions.filter(e => e.status === 'FAILED').length;

    const totalProcessingTime = allExecutions.reduce(
      (sum, execution) => sum + (execution.processingDurationMs || 0),
      0
    );
    const averageProcessingTime = totalExecutions > 0 ? totalProcessingTime / totalExecutions : 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const emailsProcessedToday = allExecutions
      .filter(e => e.startedAt >= today)
      .reduce((sum, e) => sum + (e.processedEmailsCount || 0), 0);

    const emailsProcessedThisWeek = allExecutions
      .filter(e => e.startedAt >= weekAgo)
      .reduce((sum, e) => sum + (e.processedEmailsCount || 0), 0);

    const emailsProcessedThisMonth = allExecutions
      .filter(e => e.startedAt >= monthAgo)
      .reduce((sum, e) => sum + (e.processedEmailsCount || 0), 0);

    const recentExecutions = allExecutions.slice(0, 5).map(execution => ({
      id: execution.id,
      scheduleName: schedules.find(s => s.id === execution.scheduleId)?.name || 'Unknown',
      status: execution.status,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      processedEmails: execution.processedEmailsCount || 0,
      failedEmails: execution.failedEmailsCount || 0,
    }));

    return {
      userId,
      totalSchedules,
      activeSchedules,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      averageProcessingTime,
      emailsProcessedToday,
      emailsProcessedThisWeek,
      emailsProcessedThisMonth,
      recentExecutions,
    };
  }

  /**
   * Computes nextExecutionAt from processingType:
   * - DATE_RANGE: immediate (one-time)
   * - RECURRING: next occurrence by cron expression
   * - SPECIFIC_DATES: next future date
   */
  private async calculateNextExecutionTime(
    dto: CreateProcessingScheduleDto | UpdateProcessingScheduleDto
  ): Promise<Date | null> {
    switch (dto.processingType) {
      case ProcessingType.DATE_RANGE:
        // Date range schedules execute immediately
        return new Date();

      case ProcessingType.RECURRING: {
        if (!dto.cronExpression) return null;
        try {
          const job = new CronJob(dto.cronExpression, () => {
            /* This is a placeholder function as we only need to calculate the next execution date */
          });
          return job.nextDate().toJSDate();
        } catch (error) {
          this.logger.error('Invalid cron expression:', error);
          return null;
        }
      }
      case ProcessingType.SPECIFIC_DATES: {
        if (!dto.specificDates || dto.specificDates.length === 0) return null;

        // Find next future date
        const now = new Date();
        const futureDates = (dto.specificDates as unknown as (string | Date)[])
          .map((d) => new Date(d))
          .filter((d) => d > now)
          .sort((a, b) => a.getTime() - b.getTime());

        return futureDates.length > 0 ? futureDates[0] : null;
      }
      default:
        return null;
    }
  }

  /**
   * Returns a calendar-like preview of future cron executions for enabled recurring schedules.
   */
  async getCronJobCalendar(): Promise<any[]> {
    // Changed from CronJobCalendarEntry to any[]
    const schedules = await this.prisma.processingSchedule.findMany({
      where: {
        isEnabled: true,
        processingType: ProcessingType.RECURRING,
        cronExpression: { not: null },
      },
      include: {
        emailAccount: {
          select: { email: true },
        },
      },
    });

    return schedules.map((schedule) => {
      try {
        const job = new CronJob(schedule.cronExpression, () => {
          /* This is a placeholder function as we only need to calculate the next execution date */
        });
        const nextExecutions = [];
        for (let i = 0; i < 10; i++) {
          nextExecutions.push(job.nextDate().toJSDate());
        }

        return {
          configId: schedule.id,
          configName: schedule.name,
          userId: schedule.userId,
          accountEmail: schedule.emailAccount.email,
          cronExpression: schedule.cronExpression,
          nextExecutions,
          timezone: schedule.timezone,
        };
      } catch (error) {
        this.logger.error(
          `Invalid cron expression for schedule ${schedule.id}: ${schedule.cronExpression}`
        );
        return {
          configId: schedule.id,
          configName: schedule.name,
          userId: schedule.userId,
          accountEmail: schedule.emailAccount.email,
          cronExpression: schedule.cronExpression,
          nextExecutions: [],
          timezone: schedule.timezone,
          error: 'Invalid cron expression',
        };
      }
    });
  }
}
