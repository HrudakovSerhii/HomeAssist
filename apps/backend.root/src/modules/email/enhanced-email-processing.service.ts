import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ImapService } from '../imap/imap.service';
import { EmailProcessorService } from './email-processor.service';
import { LLMService } from '../llm/llm.service';
import { TemplateService } from '../process-template/template.service';
import {
  EmailCategory,
  Priority,
  ProcessingSchedule,
  ProcessingStatus,
} from '@prisma/client';
import {
  Email,
  EmailBatchProcessingResult,
  EmailProcessingResult,
  ProcessedEmail,
} from '../../types/email-processing.types';
import { EmailIngestionService } from './email-ingestion.service';
import { ConfigService } from '@nestjs/config';
import { EmailMessage } from '../../types/email.types';

@Injectable()
export class EnhancedEmailProcessingService extends EmailIngestionService {
  protected readonly logger = new Logger(EnhancedEmailProcessingService.name);

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly imapService: ImapService,
    protected readonly emailProcessor: EmailProcessorService,
    private readonly llmService: LLMService,
    private readonly templateService: TemplateService,
    private readonly config: ConfigService
  ) {
    super(prisma, imapService, emailProcessor);
  }

  /**
   * Process emails with user-specific schedule configuration
   */
  async processEmailsWithScheduleConfig(
    schedule: any, // ProcessingSchedule is removed, so use 'any' for now
    emails: EmailMessage[],
    execution: any // ScheduleExecution is removed, so use 'any' for now
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
        await this.updateExecutionProgress(execution.id, {
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

        // Continue with next batch (resilient processing)
        continue;
      }
    }

    return {
      processed: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * Process single batch with schedule-specific configuration
   */
  private async processBatchWithScheduleConfig(
    schedule: ProcessingSchedule, // ProcessingSchedule is removed, so use 'any' for now
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
        const preprocessedEmail = this.applyUserPriorityPreprocessing(
          email,
          schedule
        );

        // Process with LLM (enhanced with schedule preferences)
        const llmResult = await this.processEmailWithEnhancedPriority(
          schedule.emailAccountId,
          preprocessedEmail,
          schedule
        );

        // Apply post-processing priority adjustments
        const finalResult = this.applyUserPriorityPostprocessing(
          llmResult,
          schedule
        );

        // Store with execution tracking
        const processedEmail = await this.storeProcessedEmail(
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
   * Apply user-defined priority rules before LLM processing
   */
  private applyUserPriorityPreprocessing(
    email: EmailMessage,
    schedule: ProcessingSchedule
  ): Email {
    let emailWithPriority: Email = { ...email, priorityHints: null };
    // Check sender priorities
    const senderPriorities = schedule.senderPriorities as Record<
      string,
      Priority
    >;
    const senderDomain = email.from.split('@')[1];

    if (senderPriorities[email.from] || senderPriorities[senderDomain]) {
      // Add priority hints to email for LLM processing
      emailWithPriority.priorityHints = {
        senderPriority:
          senderPriorities[email.from] || senderPriorities[senderDomain],
        userConfiguredSender: true,
      };
    }

    // Check email type priorities based on subject/content
    const emailTypePriorities = schedule.emailTypePriorities as Record<
      EmailCategory,
      Priority
    >;
    const detectedType = this.detectEmailType(email);

    if (emailTypePriorities[detectedType]) {
      emailWithPriority.priorityHints = {
        ...emailWithPriority.priorityHints,
        typePriority: emailTypePriorities[detectedType],
        userConfiguredType: true,
      };
    }

    return emailWithPriority;
  }

  /**
   * Enhanced LLM processing with schedule-specific focus
   */
  private async processEmailWithEnhancedPriority(
    accountId: string,
    email: Email,
    schedule: ProcessingSchedule
  ): Promise<EmailProcessingResult> {
    // Select template based on LLM focus preference
    const templateName = this.selectTemplateByFocus(schedule.llmFocus);

    // Generate enhanced prompt with priority scoring
    const prompt = await this.templateService.generatePrompt(templateName, {
      email,
      priorityHints: email.priorityHints,
      userPreferences: {
        senderPriorities: schedule.senderPriorities,
        emailTypePriorities: schedule.emailTypePriorities,
      },
    });

    // Process with LLM
    const llmResponse = await this.llmService.executeChat(
      prompt,
      this.config.get('llm.defaultModel'),
      'local',
      { temperature: 0.1 }
    );

    // Parse response with importance scoring
    const analysis = await this.templateService.parseResponse(
      templateName,
      llmResponse.response
    );

    return {
      success: true,
      originalEmail: email,
      data: {
        messageId: email.messageId,
        emailAccountId: accountId,
        subject: email.subject,
        fromAddress: email.from,
        toAddresses: email.to,
        ccAddresses: email.cc || [],
        bccAddresses: email.bcc || [],
        receivedAt: email.date,
        bodyText: email.bodyText,
        bodyHtml: email.bodyHtml,
        processingStatus: 'COMPLETED',
        ...analysis,
      },
    };
  }

  /**
   * Apply post-processing priority adjustments based on user configuration
   */
  private applyUserPriorityPostprocessing(
    result: EmailProcessingResult,
    schedule: ProcessingSchedule
  ): EmailProcessingResult {
    if (!result.success || !result.data) return result;

    const data = result.data;
    let importanceScore = data.importanceScore || 50;
    let priorityReasoning = data.priorityReasoning || '';

    // Apply user priority overrides
    if (result.originalEmail?.priorityHints?.senderPriority) {
      const overridePriority =
        result.originalEmail.priorityHints.senderPriority;
      const priorityBoost = this.calculatePriorityBoost(overridePriority);

      importanceScore = Math.min(100, importanceScore + priorityBoost);
      priorityReasoning += ` [User override: +${priorityBoost} for sender priority]`;
    }

    if (result.originalEmail?.priorityHints?.typePriority) {
      const overridePriority = result.originalEmail.priorityHints.typePriority;
      const priorityBoost = this.calculatePriorityBoost(overridePriority);

      importanceScore = Math.min(100, importanceScore + priorityBoost);
      priorityReasoning += ` [User override: +${priorityBoost} for email type]`;
    }

    return {
      ...result,
      data: {
        ...data,
        importanceScore,
        priorityReasoning: priorityReasoning.trim(),
      },
    };
  }

  /**
   * Store processed email with execution tracking
   */
  private async storeProcessedEmail(
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
   * Update execution progress
   */
  private async updateExecutionProgress(
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

  /**
   * Calculate priority boost based on user priority setting
   */
  private calculatePriorityBoost(priority: Priority): number {
    const boosts = {
      URGENT: 30,
      HIGH: 20,
      MEDIUM: 10,
      LOW: 0,
    };

    return boosts[priority] || 0;
  }

  /**
   * Detect email type from content
   */
  private detectEmailType(email: EmailMessage): EmailCategory {
    const subject = email.subject.toLowerCase();
    const content = (email.bodyText || '').toLowerCase();

    if (
      subject.includes('meeting') ||
      subject.includes('appointment') ||
      content.includes('calendar')
    ) {
      return 'APPOINTMENT';
    }

    if (
      subject.includes('invoice') ||
      subject.includes('bill') ||
      subject.includes('payment')
    ) {
      return 'INVOICE';
    }

    // Add more detection logic
    return 'PERSONAL';
  }

  /**
   * Select LLM template based on focus preference
   */
  private selectTemplateByFocus(focus: string): string {
    const templates = {
      sentiment: 'sentiment-analysis',
      urgency: 'urgency-detector',
      general: 'email-analysis',
    };

    return templates[focus] || templates['general'];
  }

  /**
   * Utility: Chunk array into batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
