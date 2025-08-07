import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ProcessingStatus } from '@prisma/client';
import { EmailProcessingResult, ProcessedEmail } from '../../types/email-processing.types';

@Injectable()
/**
 * Manages persistence linked to a ScheduleExecution from the email pipeline perspective.
 * - Stores processed email records attached to an execution.
 * - Updates execution progress counters during batch processing.
 *
 * Note: ScheduleExecution.status should use ExecutionStatus enum in execution lifecycle services.
 * This service updates counts and processed email statuses (ProcessingStatus) only.
 */
export class ScheduleExecutionService {
  private readonly logger = new Logger(ScheduleExecutionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persists a successful email processing result and links it to a ScheduleExecution.
   * Throws for unsuccessful results to prevent partial/invalid persistence.
   */
  async storeProcessedEmail(
    result: EmailProcessingResult,
    executionId: string
  ): Promise<ProcessedEmail> {
    if (!result.success || !result.data) {
      throw new Error('Cannot store unsuccessful processing result');
    }

    return this.prisma.processedEmails.create({
      data: {
        ...(result.data as ProcessedEmail),
        scheduleExecutionId: executionId,
      },
    });
  }

  /**
   * Atomically updates execution progress counters and marks any stored processed emails as COMPLETED.
   * This does not modify ScheduleExecution.status; lifecycle state is managed by the orchestrator service.
   */
  async updateExecutionProgress(
    executionId: string,
    progress: {
      completedBatchesCount: number;
      totalBatchesCount: number;
      processedEmailsCount: number;
      failedEmailsCount: number;
      totalEmailsCount: number;
    }
  ): Promise<void> {
    await this.prisma.$transaction([
      // Update execution progress
      this.prisma.scheduleExecution.update({
        where: { id: executionId },
        data: progress,
      }),
      // Update processed emails count
      this.prisma.processedEmails.updateMany({
        where: { scheduleExecutionId: executionId },
        data: { processingStatus: ProcessingStatus.COMPLETED },
      }),
    ]);
  }
} 