import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ExecutionStatus, ProcessingStatus, ScheduleExecution } from '@prisma/client';
import { EmailProcessingResult, ProcessedEmail } from '../../types/email-processing.types';

@Injectable()
/**
 * Centralized execution lifecycle and tracking for processing schedules.
 * - Owns creation, progress updates, completion/failure of ScheduleExecution records.
 * - Provides a domain-neutral method to store processed emails linked to an execution.
 */
export class ExecutionTrackingService {
  private readonly logger = new Logger(ExecutionTrackingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new ScheduleExecution with RUNNING status and start time.
   */
  async createExecution(scheduleId: string): Promise<ScheduleExecution> {
    return this.prisma.scheduleExecution.create({
      data: {
        scheduleId,
        status: ExecutionStatus.RUNNING,
        startedAt: new Date(),
        maxAttempts: 3,
      },
    });
  }

  /**
   * Updates execution progress counters atomically.
   */
  async updateProgress(
    executionId: string,
    progress: {
      completedBatchesCount: number;
      totalBatchesCount: number;
      processedEmailsCount: number;
      failedEmailsCount: number;
      totalEmailsCount: number;
    }
  ): Promise<void> {
    await this.prisma.scheduleExecution.update({
      where: { id: executionId },
      data: progress,
    });
  }

  /**
   * Marks execution as COMPLETED and records duration and summary metrics.
   */
  async completeExecution(
    executionId: string,
    summary: {
      processed: number;
      failed: number;
      processingDurationMs?: number;
    }
  ): Promise<void> {
    await this.prisma.scheduleExecution.update({
      where: { id: executionId },
      data: {
        status: ExecutionStatus.COMPLETED,
        completedAt: new Date(),
        processedEmailsCount: summary.processed,
        failedEmailsCount: summary.failed,
        ...(summary.processingDurationMs !== undefined && {
          processingDurationMs: summary.processingDurationMs,
        }),
      },
    });
  }

  /**
   * Marks execution as FAILED and records error information.
   */
  async failExecution(executionId: string, error: Error): Promise<void> {
    await this.prisma.scheduleExecution.update({
      where: { id: executionId },
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
   * Stores a processed email linked to the given ScheduleExecution.
   * Expects a successful EmailProcessingResult with data present.
   */
  async storeProcessedEmail(
    executionId: string,
    result: EmailProcessingResult
  ): Promise<ProcessedEmail> {
    if (!result.success || !result.data) {
      throw new Error('Cannot store unsuccessful processing result');
    }

    return this.prisma.processedEmails.create({
      data: {
        ...(result.data as ProcessedEmail),
        scheduleExecutionId: executionId,
        processingStatus: ProcessingStatus.COMPLETED,
      },
    });
  }
} 