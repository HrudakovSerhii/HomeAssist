import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ImapService } from '../imap/imap.service';
import {
  ProcessingStatus,
  ProcessingSchedule,
  ScheduleExecution,
} from '@prisma/client';
import { EmailMessage } from '../../types/email.types';
import {
  EmailBatchProcessingResult,
  EmailProcessingResult,
} from '../../types/email-processing.types';
import { EmailPriorityService } from './email-priority.service';
import { EmailProcessorService } from './email-processor.service';
import { ExecutionTrackingService } from '../processing-schedule/execution-tracking.service';

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
    private readonly processorService: EmailProcessorService,
    private readonly executionService: ExecutionTrackingService
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
      `🚀 Starting email processing: ${emails.length} emails in ${batches.length} batches (batchSize: ${batchSize}) for schedule: ${schedule.name}`
    );

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchStartTime = new Date();

      this.logger.log(
        `📦 Processing batch ${i + 1}/${batches.length} with ${batch.length} emails`
      );

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

        const batchDuration = Date.now() - batchStartTime.getTime();
        const successful = batchResults.filter(r => r.success).length;
        const failed = batchResults.filter(r => !r.success).length;
        
        this.logger.log(
          `✅ Batch ${i + 1}/${batches.length} completed in ${batchDuration}ms: ${successful} successful, ${failed} failed`
        );

        // Update results
        results.push(...batchResults);

        // Update execution progress
        await this.executionService.updateProgress(execution.id, {
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

    for (let emailIndex = 0; emailIndex < emails.length; emailIndex++) {
      const email = emails[emailIndex];
      const emailStartTime = Date.now();
      
      this.logger.log(
        `📧 Processing email ${emailIndex + 1}/${emails.length}: "${email.subject}" from ${email.from}`
      );

      try {
        // Apply user-defined priority configuration before LLM processing
        const preprocessedEmail =
          this.priorityService.applyUserPriorityPreprocessing(email, schedule);

        const llmStartTime = Date.now();
        this.logger.log(`🤖 Starting LLM processing for email: "${email.subject}"`);
        
        // Process with LLM (enhanced with schedule preferences and embedding classification)
        const llmResult =
          await this.processorService.processEmailWithEmbeddingClassification(
            schedule.emailAccountId,
            preprocessedEmail,
            { llmFocus: schedule.llmFocus as any }
          );

        const llmDuration = Date.now() - llmStartTime;
        this.logger.log(`🤖 LLM processing completed in ${llmDuration}ms for email: "${email.subject}"`);

        // Apply post-processing priority adjustments
        const finalResult =
          this.priorityService.applyUserPriorityPostprocessing(llmResult);

        // Store with execution tracking
        const processedEmail = await this.executionService.storeProcessedEmail(
          executionId,
          finalResult
        );

        const totalDuration = Date.now() - emailStartTime;
        this.logger.log(
          `✅ Email ${emailIndex + 1}/${emails.length} processed successfully in ${totalDuration}ms (LLM: ${llmDuration}ms)`
        );

        results.push({
          success: true,
          originalEmail: email,
          data: processedEmail,
        });
      } catch (error) {
        const totalDuration = Date.now() - emailStartTime;
        this.logger.error(
          `❌ Email ${emailIndex + 1}/${emails.length} failed after ${totalDuration}ms: "${email.subject}" - Error: ${error.message}`
        );
        
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
