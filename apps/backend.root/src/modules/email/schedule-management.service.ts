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
} from '../../types/email-processing.types';

@Injectable()
export class ScheduleManagementService {
  private readonly logger = new Logger(ScheduleManagementService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create default "Initial" schedule when user adds first email account
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
   * Create user-defined processing schedule
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
   * Update existing processing schedule
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
   * Delete processing schedule
   */
  async deleteProcessingSchedule(id: string): Promise<void> {
    await this.prisma.processingSchedule.delete({
      where: { id },
    });

    this.logger.log(`Deleted processing schedule: ${id}`);
  }

  /**
   * Get user's processing schedules
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

    return schedules as ProcessingScheduleWithAccount[];
  }

  /**
   * Get schedule execution status
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
   * Calculate next execution time based on schedule type
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
        const futureDates = (dto.specificDates as Date[])
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
   * Get cron job calendar for monitoring
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
