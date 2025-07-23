import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';

import { LLMService } from '../llm/llm.service';
import { TemplateService } from '../process-template/template.service';
import { EntityValueParserService } from '../process-template/entity-value-parser.service';
import { PrismaService } from '../../common/prisma/prisma.service';

import { EmailMessage, ParsedLLMResponse } from '../../types/email.types';
import {
  EmailProcessingResult,
  EmailBatchProcessingResult,
  ProcessedEmailWithRelations,
} from '../../types/processed-email.types';

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
      const existingProcessedEmail = await this.prisma.processedEmails.findUnique({
        where: { messageId: email.messageId },
        include: {
          entities: true,
          actionItems: true,
        },
      });

      if (existingProcessedEmail) {
        this.logger.log(`Email already processed, skipping: "${email.subject}" (messageId: ${email.messageId})`);
        
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

    return existingEmails.map(email => email.messageId);
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
    const messageIds = emails.map(email => email.messageId);
    const alreadyProcessed = await this.getAlreadyProcessedMessageIds(messageIds);
    
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
}
