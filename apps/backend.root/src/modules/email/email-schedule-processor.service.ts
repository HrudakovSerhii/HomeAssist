import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ImapService } from '../imap/imap.service';
import { ProcessingStatus, ProcessingSchedule, ScheduleExecution } from '@prisma/client';
import { EmailMessage } from '../../types/email.types';
import {
  EmailBatchProcessingResult,
  EmailProcessingResult,
} from '../../types/email-processing.types';
import { EmailPriorityService } from './email-priority.service';
import { EmailAnalysisService } from './email-analysis.service';
import { ScheduleExecutionService } from './schedule-execution.service';

@Injectable()
/**
 * Applies schedule-aware processing to emails in batches.
 * - Ensures healthy IMAP connection per batch.
 * - Applies user-defined priority preprocessing and postprocessing.
 * - Invokes analysis pipeline and stores results linked to ScheduleExecution.
 * - Pushes batch progress to execution tracking.
 *
 * Note: This service does not own schedule lifecycle; it only transforms emails under a given schedule.
 */
export class EmailScheduleProcessorService {
  private readonly logger = new Logger(EmailScheduleProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly imapService: ImapService,
    private readonly priorityService: EmailPriorityService,
    private readonly analysisService: EmailAnalysisService,
    private readonly executionService: ScheduleExecutionService
  ) {}

  /**
   * Processes emails according to the schedule configuration.
   * Splits into batches, reports progress after each batch, and aggregates results.
   */
  async processEmailsWithScheduleConfig(
    schedule: ProcessingSchedule,
    emails: EmailMessage[],
    execution: ScheduleExecution
  ): Promise<EmailBatchProcessingResult> {
    const results: EmailProcessingResult[] = [];

    // Process in batches according to schedule configuration
    const batchSize = schedule.batchSize || 5;
    const batches = this.chunkArray(emails, batchSize);

    this.logger.log(
      `Processing ${emails.length} emails in ${batches.length} batches for schedule: ${schedule.name}`
    );

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchStartTime = new Date();

      try {
        // Ensure healthy IMAP connection before batch
        await this.imapService.ensureHealthyConnection(
          schedule.emailAccountId,
          batchStartTime
        );

        // Process batch with schedule-specific configuration
        const batchResults = await this.processBatchWithScheduleConfig(
          schedule,
          batch,
          execution.id
        );

        // Update results
        results.push(...batchResults);

        // Update execution progress
        await this.executionService.updateExecutionProgress(execution.id, {
          completedBatchesCount: i + 1,
          totalBatchesCount: batches.length,
          processedEmailsCount: results.filter((r) => r.success).length,
          failedEmailsCount: results.filter((r) => !r.success).length,
          totalEmailsCount: emails.length,
        });

        this.logger.log(
          `Batch ${i + 1}/${batches.length} completed: ${
            batchResults.length
          } processed`
        );
      } catch (batchError) {
        this.logger.error(`Batch ${i + 1} failed:`, batchError);

        // Add failed results for all emails in batch
        results.push(
          ...batch.map((email) => ({
            success: false,
            error: batchError.message,
            originalEmail: email,
            data: {
              messageId: email.messageId,
              subject: email.subject,
              processingStatus: ProcessingStatus.FAILED,
            },
          }))
        );
      }
    }

    return {
      processed: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * Processes a single batch of emails under the schedule configuration.
   * Applies priority rules, runs analysis, persists results under execution, and returns per-email outcomes.
   */
  private async processBatchWithScheduleConfig(
    schedule: ProcessingSchedule,
    emails: EmailMessage[],
    executionId: string
  ): Promise<EmailProcessingResult[]> {
    const results: EmailProcessingResult[] = [];

    for (const email of emails) {
      try {
        // Check if already processed
        const existing = await this.prisma.processedEmails.findUnique({
          where: { messageId: email.messageId },
        });

        if (existing) {
          this.logger.debug(
            `Email already processed, skipping: ${email.messageId}`
          );
          results.push({
            success: true,
            originalEmail: email,
            data: {
              messageId: email.messageId,
              subject: email.subject,
              processingStatus: 'COMPLETED',
            },
          });
          continue;
        }

        // Apply user-defined priority configuration before LLM processing
        const preprocessedEmail = this.priorityService.applyUserPriorityPreprocessing(
          email,
          schedule
        );

        // Process with LLM (enhanced with schedule preferences)
        const llmResult = await this.analysisService.processEmailWithEnhancedPriority(
          schedule.emailAccountId,
          preprocessedEmail,
          schedule
        );

        // Apply post-processing priority adjustments
        const finalResult = this.priorityService.applyUserPriorityPostprocessing(llmResult);

        // Store with execution tracking
        const processedEmail = await this.executionService.storeProcessedEmail(
          finalResult,
          executionId
        );

        results.push({
          success: true,
          originalEmail: email,
          data: processedEmail,
        });
      } catch (error) {
        this.logger.error(`Failed to process email ${email.messageId}:`, error);
        results.push({
          success: false,
          error: error.message,
          originalEmail: email,
          data: {
            messageId: email.messageId,
            subject: email.subject,
            processingStatus: 'FAILED',
          },
        });
      }
    }

    return results;
  }

  /**
   * Utility: splits an array into fixed-size chunks.
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
} 