import { Injectable, Logger } from '@nestjs/common';

import { LLMService } from '../llm/llm.service';
import { TemplateService } from '../process-template/template.service';
import { EntityValueParserService } from '../process-template/entity-value-parser.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { PrismaService } from '../../common/prisma/prisma.service';

import { EmailMessage } from '../../types/email.types';
import { ParsedLLMResponse } from '../../types/llm.types';
import {
  EmailProcessingResult,
  EmailBatchProcessingResult,
  ProcessedEmailWithRelations,
} from '../../types/processed-email.types';
import {
  EnhancedEmailAnalysis,
  ScoringBreakdown,
} from '../../types/email-processing.types';
import { TemplateNames, LLM_FOCUS_TEMPLATE_MAP } from '../../types/template.types';

import {
  ProcessingStatus,
  EmailCategory,
  Priority,
  Sentiment,
  EmailAccount,
  PromptTemplate,
} from '@prisma/client';

import config from '../../config/configuration';

@Injectable()
/**
 * Canonical email analysis pipeline.
 * - Skips emails with COMPLETED status, re-processes emails with FAILED status.
 * - Uses upsert logic to handle both new emails and failed email re-processing.
 * - Selects a template, generates a prompt, invokes the LLM, parses the response,
 *   and persists a ProcessedEmail with ProcessingStatus.
 * - Provides batch processing helpers and enhanced parsing fallbacks.
 *
 * Note: This service uses ProcessingStatus for email records. Schedule execution lifecycle
 * state is managed by the scheduling module using ExecutionStatus.
 */
export class EmailProcessorService {
  private readonly logger = new Logger(EmailProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService: LLMService,
    private readonly templateService: TemplateService,
    private readonly entityValueParser: EntityValueParserService,
    private readonly embeddingService: EmbeddingService
  ) {}

  /**
   * Processes a single email through the analysis pipeline.
   * Skips processing if a ProcessedEmail exists for the same messageId.
   */
  async processEmail(
    accountId: EmailAccount['id'],
    email: EmailMessage,
    templateName?: string
  ): Promise<EmailProcessingResult> {
    const startTime = Date.now();
    let processedEmail: ProcessedEmailWithRelations | null = null;

    try {
      // Check if email has already been successfully processed (skip if COMPLETED)
      const existingProcessedEmail = await this.prisma.processedEmails.findUnique({
        where: { messageId: email.messageId },
        select: { processingStatus: true, id: true },
      });

      if (existingProcessedEmail?.processingStatus === ProcessingStatus.COMPLETED) {
        this.logger.log(`Email already successfully processed, skipping: "${email.subject}"`);
        const fullRecord = await this.prisma.processedEmails.findUnique({
          where: { id: existingProcessedEmail.id },
          include: { entities: true, actionItems: true },
        });
        return {
          messageId: email.messageId,
          subject: email.subject,
          success: true,
          processedEmail: fullRecord as ProcessedEmailWithRelations,
          processingTimeMs: Date.now() - startTime,
        };
      }

      // If FAILED status, log that we're re-processing
      if (existingProcessedEmail?.processingStatus === ProcessingStatus.FAILED) {
        this.logger.log(`Re-processing previously failed email: "${email.subject}"`);
      }

      // Select template based on email content or use specified template
      const template = templateName
        ? await this.templateService.getTemplateByName(templateName)
        : await this.templateService.selectBestTemplate(email);

      if (!template) {
        throw new Error('No suitable template found for email processing');
      }

      // Generate prompt from template
      const prompt = this.generatePrompt(email, template);

      // Call LLM service
      const llmResponse = await this.llmService.executeChat(
        prompt,
        config().llm.defaultModel,
        'local',
        { temperature: 0.1 }, // Low temperature for consistent structured output
        undefined,
        true
      );

      // Parse and validate LLM response
      const extractedData = await this.parseLLMResponse(
        llmResponse.response || llmResponse.message?.content
      );

      // Save processed email data with COMPLETED status
      processedEmail = await this.createProcessedEmail(
        accountId,
        email,
        ProcessingStatus.COMPLETED,
        extractedData
      );

      this.logger.log(`Successfully processed email: "${email.subject}"`);

      return {
        messageId: email.messageId,
        subject: email.subject,
        success: true,
        processedEmail,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Failed to process email "${email.subject}":`, error);

      try {
        // Still create a ProcessedEmail record with FAILED status
        processedEmail = await this.createProcessedEmail(
          accountId,
          email,
          ProcessingStatus.FAILED,
          null,
          error.message
        );
      } catch (saveError) {
        this.logger.error(
          'Failed to save failed email processing record:',
          saveError
        );
      }

      return {
        messageId: email.messageId,
        subject: email?.subject || 'Unknown',
        success: false,
        error: error.message,
        processedEmail,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Processes a single email using a template selected by schedule focus.
   * Delegates to processEmail with the derived template name.
   */
  async processEmailWithScheduleFocus(
    accountId: EmailAccount['id'],
    email: EmailMessage,
    schedule: { llmFocus?: string }
  ): Promise<EmailProcessingResult> {
    const templateName = LLM_FOCUS_TEMPLATE_MAP[schedule.llmFocus as keyof typeof LLM_FOCUS_TEMPLATE_MAP] 
      || TemplateNames.GENERAL_EMAIL_ANALYSIS;
    
    return this.processEmail(accountId, email, templateName);
  }

  /**
   * Processes a single email using embedding-based category classification.
   * Uses the EmbeddingService to classify the email subject and select the appropriate template.
   */
  async processEmailWithEmbeddingClassification(
    accountId: EmailAccount['id'],
    email: EmailMessage,
    schedule: { llmFocus?: string }
  ): Promise<EmailProcessingResult> {
    try {
      // Check if embedding service is ready
      if (!this.embeddingService.isReady()) {
        this.logger.warn('⚠️ EmbeddingService not ready, falling back to schedule focus');
        return this.processEmailWithScheduleFocus(accountId, email, schedule);
      }

      // Classify email subject using embeddings
      const classification = await this.embeddingService.classifyEmailSubject(email.subject);
      
      // Get template based on classified category
      let templateName = this.embeddingService.getCategoryTemplate(classification.category);
      
      // If llmFocus is specified and confidence is low, prefer llmFocus template
      if (schedule.llmFocus && classification.confidence < 0.7) {
        const focusTemplate = LLM_FOCUS_TEMPLATE_MAP[schedule.llmFocus as keyof typeof LLM_FOCUS_TEMPLATE_MAP];
        if (focusTemplate) {
          templateName = focusTemplate;
          this.logger.log(
            `🔄 Low confidence (${(classification.confidence * 100).toFixed(1)}%), using llmFocus template: ${templateName}`
          );
        }
      }

      this.logger.log(
        `🎯 Using template "${templateName}" for category "${classification.category}" (confidence: ${(classification.confidence * 100).toFixed(1)}%)`
      );

      return this.processEmail(accountId, email, templateName);
    } catch (error) {
      this.logger.error('❌ Embedding classification failed, falling back to schedule focus:', error);
      return this.processEmailWithScheduleFocus(accountId, email, schedule);
    }
  }

  /**
   * Creates or updates a ProcessedEmail record with the provided status and
   * optional extracted data and error message. Uses upsert to handle re-processing
   * of failed emails.
   */
  private async createProcessedEmail(
    accountId: EmailAccount['id'],
    email: EmailMessage,
    status: ProcessingStatus,
    extractedData?: ParsedLLMResponse | null,
    errorMessage?: string
  ): Promise<ProcessedEmailWithRelations> {
    const baseData = {
      messageId: email.messageId,
      subject: email.subject,
      fromAddress: email.from,
      toAddresses: email.to,
      ccAddresses: email.cc || [],
      bccAddresses: email.bcc || [],
      receivedAt: email.date,
      bodyText: email.bodyText,
      bodyHtml: email.bodyHtml,
      emailAccountId: accountId,
      processingStatus: status,
    };

    let categoryData, priorityData, sentimentData, summaryData, tagsData, confidenceData;

    if (extractedData) {
      // If we have extracted data, populate the fields
      categoryData = extractedData.category;
      priorityData = extractedData.priority;
      sentimentData = extractedData.sentiment;
      summaryData = extractedData.summary;
      tagsData = extractedData.tags || [];
      confidenceData = extractedData.confidence || 0.8;
    } else {
      // Failed processing - use default values
      categoryData = EmailCategory.PERSONAL;
      priorityData = Priority.MEDIUM;
      sentimentData = Sentiment.NEUTRAL;
      summaryData = errorMessage || 'Processing failed';
      tagsData = [];
      confidenceData = 0.0;
    }

    // Use upsert to handle both create and update scenarios
    const processedEmail = await this.prisma.processedEmails.upsert({
      where: { messageId: email.messageId },
      create: {
        ...baseData,
        category: categoryData,
        priority: priorityData,
        sentiment: sentimentData,
        summary: summaryData,
        tags: tagsData,
        confidence: confidenceData,
      },
      update: {
        // Update all fields on re-processing
        subject: email.subject,
        fromAddress: email.from,
        toAddresses: email.to,
        ccAddresses: email.cc || [],
        bccAddresses: email.bcc || [],
        receivedAt: email.date,
        bodyText: email.bodyText,
        bodyHtml: email.bodyHtml,
        processingStatus: status,
        category: categoryData,
        priority: priorityData,
        sentiment: sentimentData,
        summary: summaryData,
        tags: tagsData,
        confidence: confidenceData,
        updatedAt: new Date(),
      },
      include: {
        entities: true,
        actionItems: true,
      },
    });

    // Handle nested relations separately for upsert scenario
    if (extractedData && (extractedData.entities || extractedData.actionItems)) {
      // For re-processing, we need to clean up old relations and create new ones
      await this.updateNestedRelations(processedEmail.id, extractedData);
      
      // Fetch the updated record with all relations
      return await this.prisma.processedEmails.findUnique({
        where: { id: processedEmail.id },
        include: {
          entities: true,
          actionItems: true,
        },
      }) as ProcessedEmailWithRelations;
    }

    return processedEmail as ProcessedEmailWithRelations;
  }

  /**
   * Updates nested relations (entities and actionItems) for a processed email.
   * Deletes existing relations and creates new ones to ensure data consistency.
   */
  private async updateNestedRelations(
    processedEmailId: string,
    extractedData: ParsedLLMResponse
  ): Promise<void> {
    // Delete existing relations
    await this.prisma.entityExtraction.deleteMany({
      where: { processedEmailId },
    });
    await this.prisma.actionItem.deleteMany({
      where: { processedEmailId },
    });

    // Create new entities if they exist
    if (extractedData.entities && extractedData.entities.length > 0) {
      const entityData = extractedData.entities.map((entity) => {
        const serializedValue = this.entityValueParser.serializeForDatabase(
          entity.type,
          entity.value
        );

        return {
          processedEmailId,
          entityType: entity.type,
          entityValue: serializedValue,
          confidence: entity.confidence || 0.8,
          context: entity.context,
        };
      });

      await this.prisma.entityExtraction.createMany({
        data: entityData,
      });
    }

    // Create new action items if they exist
    if (extractedData.actionItems && extractedData.actionItems.length > 0) {
      const actionItemData = extractedData.actionItems.map((action) => ({
        processedEmailId,
        description: action.description,
        actionType: action.actionType,
        priority: action.priority,
        dueDate: action.dueDate ? new Date(action.dueDate) : null,
      }));

      await this.prisma.actionItem.createMany({
        data: actionItemData,
      });
    }
  }

  /**
   * Retrieves messageIds that have already been processed.
   */
  async getAlreadyProcessedMessageIds(messageIds: string[]): Promise<string[]> {
    if (messageIds.length === 0) return [];

    const existingEmails = await this.prisma.processedEmails.findMany({
      where: {
        messageId: {
          in: messageIds,
        },
      },
      select: {
        messageId: true,
      },
    });

    return existingEmails.map((email) => email.messageId);
  }

  /**
   * Processes multiple emails sequentially, reporting aggregated results.
   * Uses processEmail for each item to preserve idempotency and consistent behavior.
   */
  async processEmailBatch(
    accountId: EmailAccount['id'],
    emails: EmailMessage[],
    templateName?: string
  ): Promise<EmailBatchProcessingResult> {
    const results: EmailBatchProcessingResult = {
      processed: 0,
      failed: 0,
      results: [],
    };

    // Log batch start info
    const messageIds = emails.map((email) => email.messageId);
    const alreadyProcessed = await this.getAlreadyProcessedMessageIds(
      messageIds
    );

    this.logger.log(
      `Starting batch processing: ${emails.length} emails (${alreadyProcessed.length} already processed)`
    );

    for (const email of emails) {
      const result = await this.processEmail(accountId, email, templateName);
      results.results.push(result);

      if (result.success) {
        results.processed++;
      } else {
        results.failed++;
      }
    }

    this.logger.log(
      `Batch processing completed: ${results.processed} processed, ${results.failed} failed`
    );

    return results;
  }

  /**
   * Generates an LLM prompt from a template and raw email fields by simple token replacement.
   */
  private generatePrompt(
    email: EmailMessage,
    template: PromptTemplate
  ): string {
    let prompt = template.template;

    // Replace template variables
    prompt = prompt.replace(/\{\{subject}}/g, email.subject || '');
    prompt = prompt.replace(/\{\{fromAddress}}/g, email.from || '');
    prompt = prompt.replace(
      /\{\{bodyText}}/g,
      email.bodyText || email.bodyHtml || ''
    );
    prompt = prompt.replace(
      /\{\{receivedAt}}/g,
      email.date?.toISOString() || ''
    );

    return prompt;
  }

  /**
   * Parses a raw LLM response into structured data with validation and safe fallbacks.
   */
  private async parseLLMResponse(response: string): Promise<ParsedLLMResponse> {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*}/);
      if (jsonMatch) {
        const parsedData = JSON.parse(jsonMatch[0]);

        // Validate LLM response against schema types with dynamic entity handling
        const validationResult = await this.templateService.validateLLMResponse(
          parsedData
        );

        if (!validationResult.isValid) {
          this.logger.warn(
            `LLM response validation failed: ${validationResult.errors.join(
              ', '
            )}`
          );
        }

        // Log warnings (including dynamic entity type processing)
        if (validationResult.warnings.length > 0) {
          this.logger.log(
            `LLM response processing: ${validationResult.warnings.join(', ')}`
          );
        }

        // Validate required fields and set defaults
        return {
          category:
            this.validateCategory(parsedData.category) ||
            EmailCategory.PERSONAL,
          priority:
            this.validatePriority(parsedData.priority) || Priority.MEDIUM,
          sentiment:
            this.validateSentiment(parsedData.sentiment) || Sentiment.NEUTRAL,
          summary: parsedData.summary || 'No summary provided',
          tags: Array.isArray(parsedData.tags) ? parsedData.tags : [],
          confidence: parsedData.confidence || 0.8,
          entities: parsedData.entities || [],
          actionItems: parsedData.actionItems || [],
        };
      }

      // Fallback: Create basic structure from text response
      this.logger.warn(
        'No JSON found in LLM response, using fallback structure'
      );
      return {
        category: EmailCategory.PERSONAL,
        priority: Priority.MEDIUM,
        sentiment: Sentiment.NEUTRAL,
        summary: response.substring(0, 200),
        tags: [],
        confidence: 0.5,
        entities: [],
        actionItems: [],
      };
    } catch (error) {
      this.logger.error('Failed to parse LLM response:', error);
      this.logger.error('LLM response:', response);
      // Return fallback structure
      return {
        category: EmailCategory.PERSONAL,
        priority: Priority.MEDIUM,
        sentiment: Sentiment.NEUTRAL,
        summary: 'Failed to parse LLM response',
        tags: [],
        confidence: 0.3,
        entities: [],
        actionItems: [],
      };
    }
  }

  /**
   * Validate and convert category string to enum
   */
  private validateCategory(category: string): EmailCategory | null {
    return Object.values(EmailCategory).includes(category as EmailCategory)
      ? (category as EmailCategory)
      : null;
  }

  /**
   * Validate and convert priority string to enum
   */
  private validatePriority(priority: string): Priority | null {
    return Object.values(Priority).includes(priority as Priority)
      ? (priority as Priority)
      : null;
  }

  /**
   * Validate and convert sentiment string to enum
   */
  private validateSentiment(sentiment: string): Sentiment | null {
    return Object.values(Sentiment).includes(sentiment as Sentiment)
      ? (sentiment as Sentiment)
      : null;
  }

  /**
   * @deprecated Retry logic has been removed. Use regular processEmail method instead.
   * The idempotency check in processEmail will handle duplicate processing attempts.
   */
  async retryFailedEmails(
    accountId: EmailAccount['id'],
    failedEmails: EmailMessage[],
    templateName?: string
  ): Promise<EmailBatchProcessingResult> {
    this.logger.warn('retryFailedEmails is deprecated. Use processEmailBatch instead.');
    return this.processEmailBatch(accountId, failedEmails, templateName);
  }

  // ============================================================================
  // ENHANCED LLM RESPONSE PARSING METHODS (from enhanced-llm-response-parser.service.ts)
  // ============================================================================

  /**
   * ENHANCED: Parse enhanced LLM response with comprehensive validation
   * This method extends the basic parseLLMResponse with enhanced analysis features
   */
  async parseEnhancedLLMResponse(
    response: string,
    schedule?: any // ProcessingSchedule interface
  ): Promise<EnhancedEmailAnalysis> {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }

      const parsedData = JSON.parse(jsonMatch[0]);

      // Validate and normalize the response
      return {
        category: this.validateEnhancedEmailCategory(parsedData.category),
        priority: this.validateEnhancedPriority(parsedData.priority),
        importance_score: this.validateImportanceScore(
          parsedData.importance_score
        ),
        priority_reasoning:
          parsedData.priority_reasoning || 'No reasoning provided',
        scoring_breakdown: this.validateScoringBreakdown(
          parsedData.scoring_breakdown
        ),
        sentiment: this.validateEnhancedSentiment(parsedData.sentiment),
        summary: parsedData.summary || 'No summary provided',
        tags: Array.isArray(parsedData.tags) ? parsedData.tags : [],
        confidence: Math.max(0, Math.min(1, parsedData.confidence || 0.8)),
        entities: this.validateEnhancedEntities(parsedData.entities || []),
        actionItems: this.validateEnhancedActionItems(
          parsedData.actionItems || []
        ),
      };
    } catch (error) {
      this.logger.error('Failed to parse enhanced LLM response:', error);

      // Return fallback analysis
      return this.createEnhancedFallbackAnalysis(response);
    }
  }

  /**
   * ENHANCED: Validate email category (extends the basic validation)
   */
  private validateEnhancedEmailCategory(category: any): EmailCategory {
    const validCategories = Object.values(EmailCategory);
    if (validCategories.includes(category)) {
      return category;
    }
    this.logger.warn(
      `Invalid email category: ${category}, defaulting to PERSONAL`
    );
    return EmailCategory.PERSONAL;
  }

  /**
   * ENHANCED: Validate priority (extends the basic validation)
   */
  private validateEnhancedPriority(priority: any): Priority {
    const validPriorities = Object.values(Priority);
    if (validPriorities.includes(priority)) {
      return priority;
    }
    this.logger.warn(`Invalid priority: ${priority}, defaulting to MEDIUM`);
    return Priority.MEDIUM;
  }

  /**
   * ENHANCED: Validate sentiment (extends the basic validation)
   */
  private validateEnhancedSentiment(sentiment: any): Sentiment {
    const validSentiments = Object.values(Sentiment);
    if (validSentiments.includes(sentiment)) {
      return sentiment;
    }
    this.logger.warn(`Invalid sentiment: ${sentiment}, defaulting to NEUTRAL`);
    return Sentiment.NEUTRAL;
  }

  /**
   * ENHANCED: Validate importance score is within bounds
   */
  private validateImportanceScore(score: any): number {
    const numScore = Number(score);
    if (isNaN(numScore)) {
      this.logger.warn(`Invalid importance score: ${score}, defaulting to 50`);
      return 50;
    }
    return Math.max(0, Math.min(100, Math.round(numScore)));
  }

  /**
   * ENHANCED: Validate scoring breakdown structure
   */
  private validateScoringBreakdown(breakdown: any): ScoringBreakdown {
    if (!breakdown || typeof breakdown !== 'object') {
      this.logger.warn('Invalid scoring breakdown, using default values');
      return {
        base_score: 50,
        time_sensitivity: 0,
        content_type: 0,
        sender_importance: 0,
        urgency_language: 0,
        user_overrides: 0,
        penalties: 0,
        final_score: 50,
      };
    }

    return {
      base_score: Number(breakdown.base_score) || 50,
      time_sensitivity: Number(breakdown.time_sensitivity) || 0,
      content_type: Number(breakdown.content_type) || 0,
      sender_importance: Number(breakdown.sender_importance) || 0,
      urgency_language: Number(breakdown.urgency_language) || 0,
      user_overrides: Number(breakdown.user_overrides) || 0,
      penalties: Number(breakdown.penalties) || 0,
      final_score: Number(breakdown.final_score) || 50,
    };
  }

  /**
   * ENHANCED: Validate entities array (extends the basic validation)
   */
  private validateEnhancedEntities(entities: any[]): any[] {
    if (!Array.isArray(entities)) {
      return [];
    }

    return entities
      .filter((entity) => entity && typeof entity === 'object')
      .map((entity) => ({
        id: entity.id,
        entityType: entity.entityType, // Will be validated by existing entity processing
        entityValue: String(entity.entityValue || ''),
        confidence: Math.max(0, Math.min(1, Number(entity.confidence) || 0.5)),
        startPosition: entity.startPosition
          ? Number(entity.startPosition)
          : undefined,
        endPosition: entity.endPosition
          ? Number(entity.endPosition)
          : undefined,
        context: entity.context ? String(entity.context) : undefined,
      }))
      .filter((entity) => entity.entityValue); // Remove entities with empty values
  }

  /**
   * ENHANCED: Validate action items array (extends the basic validation)
   */
  private validateEnhancedActionItems(actionItems: any[]): any[] {
    if (!Array.isArray(actionItems)) {
      return [];
    }

    return actionItems
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        id: item.id,
        actionType: item.actionType, // Will be validated by existing action processing
        description: String(item.description || ''),
        priority: this.validateEnhancedPriority(item.priority),
        dueDate: item.dueDate ? String(item.dueDate) : undefined,
        completed: Boolean(item.completed),
      }))
      .filter((item) => item.description); // Remove items with empty descriptions
  }

  /**
   * ENHANCED: Create fallback analysis when parsing fails
   */
  private createEnhancedFallbackAnalysis(
    response: string
  ): EnhancedEmailAnalysis {
    this.logger.warn(
      'Creating enhanced fallback analysis due to parsing failure'
    );

    return {
      category: EmailCategory.PERSONAL,
      priority: Priority.MEDIUM,
      importance_score: 50,
      priority_reasoning: 'Failed to parse LLM response, using default scoring',
      scoring_breakdown: {
        base_score: 50,
        time_sensitivity: 0,
        content_type: 0,
        sender_importance: 0,
        urgency_language: 0,
        user_overrides: 0,
        penalties: 0,
        final_score: 50,
      },
      sentiment: Sentiment.NEUTRAL,
      summary: response.substring(0, 200),
      tags: ['parsing-error'],
      confidence: 0.3,
      entities: [],
      actionItems: [],
    };
  }

  /**
   * ENHANCED: Extract structured data from free text response (fallback method)
   */
  private extractStructuredDataFromText(
    response: string
  ): Partial<EnhancedEmailAnalysis> {
    const extracted: Partial<EnhancedEmailAnalysis> = {};

    // Try to extract category
    const categoryMatch = response.match(
      /category[:\s]+(PERSONAL|WORK|MARKETING|NEWSLETTER|SUPPORT|NOTIFICATION|INVOICE|RECEIPT|APPOINTMENT)/i
    );
    if (categoryMatch) {
      extracted.category = categoryMatch[1].toUpperCase() as EmailCategory;
    }

    // Try to extract priority
    const priorityMatch = response.match(
      /priority[:\s]+(LOW|MEDIUM|HIGH|URGENT)/i
    );
    if (priorityMatch) {
      extracted.priority = priorityMatch[1].toUpperCase() as Priority;
    }

    // Try to extract sentiment
    const sentimentMatch = response.match(
      /sentiment[:\s]+(POSITIVE|NEGATIVE|NEUTRAL|MIXED)/i
    );
    if (sentimentMatch) {
      extracted.sentiment = sentimentMatch[1].toUpperCase() as Sentiment;
    }

    // Try to extract importance score
    const scoreMatch = response.match(/(?:importance_score|score)[:\s]+(\d+)/i);
    if (scoreMatch) {
      extracted.importance_score = parseInt(scoreMatch[1]);
    }

    return extracted;
  }
}
