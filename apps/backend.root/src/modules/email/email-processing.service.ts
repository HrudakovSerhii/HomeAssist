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
  EmailBatchProcessingResult,
  EmailProcessingResult,
  ProcessedEmail,
  ScoringBreakdown,
} from '../../types/email-processing.types';
import { EmailIngestionService } from './email-ingestion.service';
import { ConfigService } from '@nestjs/config';
import { Email, EmailMessage } from '../../types/email.types';

@Injectable()
export class EmailProcessingService extends EmailIngestionService {
  protected readonly logger = new Logger(EmailProcessingService.name);

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

  // ============================================================================
  // ENHANCED PRIORITY SCORING METHODS (from priority-score-calculator.service.ts)
  // ============================================================================

  /**
   * ENHANCED: Calculate comprehensive priority score with breakdown
   * This method extends the basic priority calculation with detailed scoring
   */
  calculateEnhancedPriorityScore(
    email: EmailMessage,
    schedule: ProcessingSchedule,
    baseAnalysis: any
  ): {
    importance_score: number;
    scoring_breakdown: ScoringBreakdown;
    priority_reasoning: string;
  } {
    let score = 50; // Base score
    const breakdown: ScoringBreakdown = {
      base_score: 50,
      time_sensitivity: 0,
      content_type: 0,
      sender_importance: 0,
      urgency_language: 0,
      user_overrides: 0,
      penalties: 0,
      final_score: 0
    };
    
    // Time sensitivity analysis
    const timeBoost = this.calculateTimeSensitivityBoost(email, baseAnalysis);
    score += timeBoost;
    breakdown.time_sensitivity = timeBoost;
    
    // Content type analysis
    const contentBoost = this.calculateContentTypeBoost(email, baseAnalysis);
    score += contentBoost;
    breakdown.content_type = contentBoost;
    
    // Sender importance
    const senderBoost = this.calculateSenderImportanceBoost(email, schedule);
    score += senderBoost;
    breakdown.sender_importance = senderBoost;
    
    // Urgency language detection
    const urgencyBoost = this.calculateUrgencyLanguageBoost(email);
    score += urgencyBoost;
    breakdown.urgency_language = urgencyBoost;
    
    // User-defined overrides
    const userBoost = this.applyEnhancedUserOverrides(email, schedule, baseAnalysis);
    score += userBoost;
    breakdown.user_overrides = userBoost;
    
    // Apply penalties
    const penalties = this.calculateEnhancedPenalties(email, baseAnalysis);
    score -= penalties;
    breakdown.penalties = -penalties;
    
    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));
    breakdown.final_score = score;
    
    return {
      importance_score: Math.round(score),
      scoring_breakdown: breakdown,
      priority_reasoning: this.generateEnhancedReasoningText(breakdown, email)
    };
  }

  /**
   * ENHANCED: Calculate time sensitivity boost
   */
  private calculateTimeSensitivityBoost(email: EmailMessage, analysis: any): number {
    const now = new Date();
    const received = email.date;
    const content = (email.subject + ' ' + (email.bodyText || '')).toLowerCase();
    
    let boost = 0;
    
    // Check for same-day indicators
    if (content.includes('today') || content.includes('due today')) {
      boost += 40;
    }
    
    // Check for this week indicators  
    if (content.includes('this week') || content.includes('by friday')) {
      boost += 25;
    }
    
    // Check for next week indicators
    if (content.includes('next week') || content.includes('by next')) {
      boost += 15;
    }
    
    // Check for overdue indicators
    if (content.includes('overdue') || content.includes('past due')) {
      boost += 45;
    }
    
    return boost;
  }

  /**
   * ENHANCED: Calculate content type importance boost
   */
  private calculateContentTypeBoost(email: EmailMessage, analysis: any): number {
    const content = (email.subject + ' ' + (email.bodyText || '')).toLowerCase();
    let boost = 0;
    
    // Meeting/appointment indicators
    if (content.includes('meeting') || content.includes('appointment') || 
        content.includes('calendar') || content.includes('schedule')) {
      boost += 20;
    }
    
    // Invoice/payment indicators
    if (content.includes('invoice') || content.includes('payment') || 
        content.includes('bill') || content.includes('due')) {
      boost += 20;
    }
    
    // Action required indicators
    if (content.includes('action required') || content.includes('please confirm') ||
        content.includes('approval needed')) {
      boost += 15;
    }
    
    // Reply requested indicators
    if (content.includes('reply') || content.includes('response required')) {
      boost += 10;
    }
    
    return boost;
  }

  /**
   * ENHANCED: Calculate sender importance boost
   */
  private calculateSenderImportanceBoost(email: EmailMessage, schedule: ProcessingSchedule): number {
    let boost = 0;
    const senderDomain = email.from?.split('@')[1] || '';
    
    // Check user-defined sender priorities
    const senderPriorities = schedule.senderPriorities || {};
    if (email.from && senderPriorities[email.from]) {
      boost += this.getEnhancedPriorityBoost(senderPriorities[email.from]);
    } else if (senderPriorities[senderDomain]) {
      boost += this.getEnhancedPriorityBoost(senderPriorities[senderDomain]);
    }
    
    // Work domain detection
    const workDomains = ['.com', '.org', '.edu', '.gov'];
    const personalDomains = ['gmail.com', 'yahoo.com', 'hotmail.com'];
    
    if (workDomains.some(domain => senderDomain.endsWith(domain)) && 
        !personalDomains.includes(senderDomain)) {
      boost += 15;
    }
    
    return boost;
  }

  /**
   * ENHANCED: Calculate urgency language boost
   */
  private calculateUrgencyLanguageBoost(email: EmailMessage): number {
    const content = (email.subject + ' ' + (email.bodyText || '')).toLowerCase();
    let boost = 0;
    
    // High urgency keywords
    const highUrgencyWords = ['urgent', 'asap', 'immediately', 'emergency'];
    if (highUrgencyWords.some(word => content.includes(word))) {
      boost += 15;
    }
    
    // Medium urgency keywords  
    const mediumUrgencyWords = ['deadline', 'due today', 'time sensitive'];
    if (mediumUrgencyWords.some(word => content.includes(word))) {
      boost += 10;
    }
    
    // Low urgency keywords
    const lowUrgencyWords = ['please confirm', 'response required'];
    if (lowUrgencyWords.some(word => content.includes(word))) {
      boost += 8;
    }
    
    return boost;
  }

  /**
   * ENHANCED: Apply user-defined priority overrides (extends the existing method)
   */
  private applyEnhancedUserOverrides(
    email: EmailMessage, 
    schedule: ProcessingSchedule, 
    analysis: any
  ): number {
    let boost = 0;
    
    // Check email type priorities
    const emailTypePriorities = schedule.emailTypePriorities || {};
    const detectedCategory = analysis.category;
    
    if (emailTypePriorities[detectedCategory]) {
      boost += this.getEnhancedPriorityBoost(emailTypePriorities[detectedCategory]);
    }
    
    return boost;
  }

  /**
   * ENHANCED: Calculate penalties for low-priority content
   */
  private calculateEnhancedPenalties(email: EmailMessage, analysis: any): number {
    const content = (email.subject + ' ' + (email.bodyText || '')).toLowerCase();
    let penalty = 0;
    
    // Marketing/promotional penalties
    const marketingKeywords = ['unsubscribe', 'promotional', 'offer', 'deal', 'sale'];
    if (marketingKeywords.some(word => content.includes(word))) {
      penalty += 25;
    }
    
    // Automated sender penalties
    if (email.from?.includes('no-reply') || email.from?.includes('noreply')) {
      penalty += 20;
    }
    
    // Newsletter penalties
    if (content.includes('newsletter') || content.includes('subscription')) {
      penalty += 15;
    }
    
    // Social media penalties
    const socialKeywords = ['facebook', 'twitter', 'linkedin', 'instagram'];
    if (socialKeywords.some(word => content.includes(word))) {
      penalty += 10;
    }
    
    return penalty;
  }

  /**
   * ENHANCED: Convert Priority enum to numerical boost (extends the existing method)
   */
  private getEnhancedPriorityBoost(priority: string): number {
    const boosts = {
      'URGENT': 30,
      'HIGH': 20,
      'MEDIUM': 10,
      'LOW': 0
    };
    
    return boosts[priority] || 0;
  }

  /**
   * ENHANCED: Generate human-readable priority reasoning (extends the existing method)
   */
  private generateEnhancedReasoningText(breakdown: ScoringBreakdown, email: EmailMessage): string {
    const parts = [];
    
    if (breakdown.time_sensitivity > 0) {
      parts.push(`+${breakdown.time_sensitivity} time sensitivity`);
    }
    
    if (breakdown.content_type > 0) {
      parts.push(`+${breakdown.content_type} content type`);
    }
    
    if (breakdown.sender_importance > 0) {
      parts.push(`+${breakdown.sender_importance} sender importance`);
    }
    
    if (breakdown.urgency_language > 0) {
      parts.push(`+${breakdown.urgency_language} urgency language`);
    }
    
    if (breakdown.user_overrides > 0) {
      parts.push(`+${breakdown.user_overrides} user overrides`);
    }
    
    if (breakdown.penalties > 0) {
      parts.push(`${breakdown.penalties} penalties`);
    }
    
    const reasoning = parts.length > 0 
      ? `Base score ${breakdown.base_score} (${parts.join(', ')}) = ${breakdown.final_score}/100`
      : `Base score ${breakdown.final_score}/100`;
    
    return reasoning;
  }
}
