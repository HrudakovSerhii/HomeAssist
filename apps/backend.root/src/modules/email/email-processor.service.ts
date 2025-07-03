import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';

import { LLMService } from '../llm/llm.service';
import { TemplateService } from '../process-template/template.service';
import { PrismaService } from '../../common/prisma/prisma.service';

import {
  ParsedLLMResponse,
  EmailProcessingResult,
  EmailBatchProcessingResult,
} from '../../types/email.types';

import {
  ProcessingStatus,
  EmailCategory,
  Priority,
  Sentiment,
  Email,
  PromptTemplate,
} from '@prisma/client';

import config from '../../config/configuration';

@Injectable()
export class EmailProcessorService {
  private readonly logger = new Logger(EmailProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService: LLMService,
    private readonly templateService: TemplateService
  ) {}

  /**
   * Process a single email with LLM analysis
   */
  async processEmail(
    emailId: string,
    templateName?: string
  ): Promise<EmailProcessingResult> {
    const startTime = Date.now();
    let email: Email | null = null;

    try {
      // Get email data
      email = await this.prisma.email.findUnique({
        where: { id: emailId },
        include: { attachments: true },
      });

      if (!email) {
        throw new HttpException('Email not found', HttpStatus.NOT_FOUND);
      }

      // Update status to processing
      await this.prisma.email.update({
        where: { id: emailId },
        data: { processingStatus: ProcessingStatus.PROCESSING },
      });

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
        { temperature: 0.1 } // Low temperature for consistent structured output
      );

      const processingTime = Date.now() - startTime;

      // Save LLM response
      const savedLLMResponse = await this.prisma.lLMResponse.create({
        data: {
          emailId,
          promptTemplate: template.name,
          rawResponse: JSON.stringify(llmResponse),
          modelUsed: config().llm.defaultModel,
          processingTimeMs: processingTime,
        },
      });

      // Parse and validate LLM response
      const extractedData = this.parseLLMResponse(
        llmResponse.response || llmResponse.message?.content
      );

      // Save extracted data
      const savedExtractedData = await this.prisma.extractedEmailData.create({
        data: {
          emailId,
          llmResponseId: savedLLMResponse.id,
          category: extractedData.category,
          priority: extractedData.priority,
          sentiment: extractedData.sentiment,
          summary: extractedData.summary,
          tags: extractedData.tags || [],
          confidence: extractedData.confidence || 0.8,
          // Create related entities
          entities: {
            create:
              extractedData.entities?.map((entity) => ({
                entityType: entity.type,
                entityValue: entity.value,
                confidence: entity.confidence || 0.8,
                context: entity.context,
              })) || [],
          },
          // Create action items
          actionItems: {
            create:
              extractedData.actionItems?.map((action) => ({
                description: action.description,
                actionType: action.actionType,
                priority: action.priority,
                dueDate: action.dueDate ? new Date(action.dueDate) : null,
              })) || [],
          },
        },
      });

      // Update email status to completed
      await this.prisma.email.update({
        where: { id: emailId },
        data: {
          processingStatus: ProcessingStatus.COMPLETED,
          isProcessed: true,
        },
      });

      this.logger.log(`Successfully processed email: "${email.subject}"`);

      return {
        emailId,
        subject: email.subject,
        success: true,
        extractedData: savedExtractedData,
        processingTimeMs: processingTime,
      };
    } catch (error) {
      this.logger.error(`Failed to process email ${emailId}:`, error);

      // Update email status to failed
      await this.prisma.email.update({
        where: { id: emailId },
        data: { processingStatus: ProcessingStatus.FAILED },
      });

      return {
        emailId,
        subject: email?.subject || 'Unknown',
        success: false,
        error: error.message,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Process multiple emails in batch
   */
  async processEmailBatch(
    limit: number = 5
  ): Promise<EmailBatchProcessingResult> {
    const pendingEmails: Email[] = await this.prisma.email.findMany({
      where: {
        processingStatus: ProcessingStatus.PENDING,
        isProcessed: false,
      },
      take: limit,
      orderBy: { receivedAt: 'asc' },
    });

    const results: EmailBatchProcessingResult = {
      processed: 0,
      failed: 0,
      results: [],
    };

    for (const email of pendingEmails) {
      const result = await this.processEmail(email.id);
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
  private generatePrompt(email: Email, template: PromptTemplate): string {
    let prompt = template.template;

    // Replace template variables
    prompt = prompt.replace(/\{\{subject}}/g, email.subject || '');
    prompt = prompt.replace(/\{\{fromAddress}}/g, email.fromAddress || '');
    prompt = prompt.replace(
      /\{\{bodyText}}/g,
      email.bodyText || email.bodyHtml || ''
    );
    prompt = prompt.replace(
      /\{\{receivedAt}}/g,
      email.receivedAt?.toISOString() || ''
    );

    return prompt;
  }

  /**
   * Parse LLM response into structured data
   */
  private parseLLMResponse(response: string): ParsedLLMResponse {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*}/);
      if (jsonMatch) {
        const parsedData = JSON.parse(jsonMatch[0]);

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
   * Retry failed email processing
   */
  async retryFailedEmails(
    limit: number = 5
  ): Promise<EmailBatchProcessingResult> {
    const failedEmails = await this.prisma.email.findMany({
      where: { processingStatus: ProcessingStatus.FAILED },
      take: limit,
      orderBy: { updatedAt: 'asc' },
    });

    const results: EmailBatchProcessingResult = {
      processed: 0,
      failed: 0,
      results: [],
    };

    for (const email of failedEmails) {
      const result = await this.processEmail(email.id);
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
