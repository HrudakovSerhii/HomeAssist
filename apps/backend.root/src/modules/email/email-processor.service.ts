import { Injectable, Logger } from '@nestjs/common';

import { LLMService } from '../llm/llm.service';
import { TemplateService } from '../process-template/template.service';
import { EntityValueParserService } from '../process-template/entity-value-parser.service';
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
export class EmailProcessorService {
  private readonly logger = new Logger(EmailProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService: LLMService,
    private readonly templateService: TemplateService,
    private readonly entityValueParser: EntityValueParserService
  ) {}

  /**
   * Process a single email with LLM analysis
   */
  async processEmail(
    accountId: EmailAccount['id'],
    email: EmailMessage,
    templateName?: string
  ): Promise<EmailProcessingResult> {
    const startTime = Date.now();
    let processedEmail: ProcessedEmailWithRelations | null = null;

    try {
      // Check if email has already been processed
      const existingProcessedEmail =
        await this.prisma.processedEmails.findUnique({
          where: { messageId: email.messageId },
          include: {
            entities: true,
            actionItems: true,
          },
        });

      if (existingProcessedEmail) {
        this.logger.log(
          `Email already processed, skipping: "${email.subject}" (messageId: ${email.messageId})`
        );

        return {
          messageId: email.messageId,
          subject: email.subject,
          success: true,
          processedEmail: existingProcessedEmail,
          processingTimeMs: Date.now() - startTime,
        };
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
   * Create a ProcessedEmails record with the given status and optional extracted data
   */
  private async createProcessedEmail(
    accountId: EmailAccount['id'],
    email: EmailMessage,
    status: ProcessingStatus,
    extractedData?: ParsedLLMResponse | null,
    errorMessage?: string
  ): Promise<ProcessedEmailWithRelations> {
    const data: any = {
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

    if (extractedData) {
      // If we have extracted data, populate the fields
      data.category = extractedData.category;
      data.priority = extractedData.priority;
      data.sentiment = extractedData.sentiment;
      data.summary = extractedData.summary;
      data.tags = extractedData.tags || [];
      data.confidence = extractedData.confidence || 0.8;

      // Create related entities
      data.entities = {
        create:
          extractedData.entities?.map((entity) => {
            const serializedValue = this.entityValueParser.serializeForDatabase(
              entity.type,
              entity.value
            );

            return {
              entityType: entity.type,
              entityValue: serializedValue,
              confidence: entity.confidence || 0.8,
              context: entity.context,
            };
          }) || [],
      };

      // Create action items
      data.actionItems = {
        create:
          extractedData.actionItems?.map((action) => ({
            description: action.description,
            actionType: action.actionType,
            priority: action.priority,
            dueDate: action.dueDate ? new Date(action.dueDate) : null,
          })) || [],
      };
    } else {
      // Failed processing - use default values
      data.category = EmailCategory.PERSONAL;
      data.priority = Priority.MEDIUM;
      data.sentiment = Sentiment.NEUTRAL;
      data.summary = errorMessage || 'Processing failed';
      data.tags = [];
      data.confidence = 0.0;
      data.entities = { create: [] };
      data.actionItems = { create: [] };
    }

    return await this.prisma.processedEmails.create({
      data,
      include: {
        entities: true,
        actionItems: true,
      },
    });
  }

  /**
   * Check which emails have already been processed
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
   * Process multiple emails in batch
   * Note: This method now processes EmailMessage objects directly from IMAP
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
   * Generate LLM prompt from email and template
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
   * Parse LLM response into structured data with validation
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
   * Retry failed email processing by re-processing from Gmail/IMAP
   * Note: This now requires re-fetching emails from the email service
   */
  async retryFailedEmails(
    accountId: EmailAccount['id'],
    failedEmails: EmailMessage[],
    templateName?: string
  ): Promise<EmailBatchProcessingResult> {
    const results: EmailBatchProcessingResult = {
      processed: 0,
      failed: 0,
      results: [],
    };

    for (const email of failedEmails) {
      // First, delete the failed processed email record if it exists
      try {
        await this.prisma.processedEmails.delete({
          where: { messageId: email.messageId },
        });
      } catch (error) {
        // Record might not exist, continue
      }

      // Reprocess the email
      const result = await this.processEmail(accountId, email, templateName);

      results.results.push(result);

      if (result.success) {
        results.processed++;
      } else {
        results.failed++;
      }
    }

    this.logger.log(
      `Retry processing completed: ${results.processed} processed, ${results.failed} failed`
    );

    return results;
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
        importance_score: this.validateImportanceScore(parsedData.importance_score),
        priority_reasoning: parsedData.priority_reasoning || 'No reasoning provided',
        scoring_breakdown: this.validateScoringBreakdown(parsedData.scoring_breakdown),
        sentiment: this.validateEnhancedSentiment(parsedData.sentiment),
        summary: parsedData.summary || 'No summary provided',
        tags: Array.isArray(parsedData.tags) ? parsedData.tags : [],
        confidence: Math.max(0, Math.min(1, parsedData.confidence || 0.8)),
        entities: this.validateEnhancedEntities(parsedData.entities || []),
        actionItems: this.validateEnhancedActionItems(parsedData.actionItems || [])
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
    this.logger.warn(`Invalid email category: ${category}, defaulting to PERSONAL`);
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
        final_score: 50
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
      final_score: Number(breakdown.final_score) || 50
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
      .filter(entity => entity && typeof entity === 'object')
      .map(entity => ({
        id: entity.id,
        entityType: entity.entityType, // Will be validated by existing entity processing
        entityValue: String(entity.entityValue || ''),
        confidence: Math.max(0, Math.min(1, Number(entity.confidence) || 0.5)),
        startPosition: entity.startPosition ? Number(entity.startPosition) : undefined,
        endPosition: entity.endPosition ? Number(entity.endPosition) : undefined,
        context: entity.context ? String(entity.context) : undefined,
      }))
      .filter(entity => entity.entityValue); // Remove entities with empty values
  }

  /**
   * ENHANCED: Validate action items array (extends the basic validation)
   */
  private validateEnhancedActionItems(actionItems: any[]): any[] {
    if (!Array.isArray(actionItems)) {
      return [];
    }

    return actionItems
      .filter(item => item && typeof item === 'object')
      .map(item => ({
        id: item.id,
        actionType: item.actionType, // Will be validated by existing action processing
        description: String(item.description || ''),
        priority: this.validateEnhancedPriority(item.priority),
        dueDate: item.dueDate ? String(item.dueDate) : undefined,
        completed: Boolean(item.completed)
      }))
      .filter(item => item.description); // Remove items with empty descriptions
  }

  /**
   * ENHANCED: Create fallback analysis when parsing fails
   */
  private createEnhancedFallbackAnalysis(response: string): EnhancedEmailAnalysis {
    this.logger.warn('Creating enhanced fallback analysis due to parsing failure');
    
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
        final_score: 50
      },
      sentiment: Sentiment.NEUTRAL,
      summary: response.substring(0, 200),
      tags: ['parsing-error'],
      confidence: 0.3,
      entities: [],
      actionItems: []
    };
  }

  /**
   * ENHANCED: Extract structured data from free text response (fallback method)
   */
  private extractStructuredDataFromText(response: string): Partial<EnhancedEmailAnalysis> {
    const extracted: Partial<EnhancedEmailAnalysis> = {};
    
    // Try to extract category
    const categoryMatch = response.match(/category[:\s]+(PERSONAL|WORK|MARKETING|NEWSLETTER|SUPPORT|NOTIFICATION|INVOICE|RECEIPT|APPOINTMENT)/i);
    if (categoryMatch) {
      extracted.category = categoryMatch[1].toUpperCase() as EmailCategory;
    }
    
    // Try to extract priority
    const priorityMatch = response.match(/priority[:\s]+(LOW|MEDIUM|HIGH|URGENT)/i);
    if (priorityMatch) {
      extracted.priority = priorityMatch[1].toUpperCase() as Priority;
    }
    
    // Try to extract sentiment
    const sentimentMatch = response.match(/sentiment[:\s]+(POSITIVE|NEGATIVE|NEUTRAL|MIXED)/i);
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
