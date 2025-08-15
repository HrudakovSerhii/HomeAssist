import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProcessingSchedule } from '@prisma/client';
import { LLMService } from '../llm/llm.service';
import { TemplateService } from '../process-template/template.service';
import { Email } from '../../types/email.types';
import { EmailProcessingResult } from '../../types/email-processing.types';
import { TemplateNames, LLM_FOCUS_TEMPLATE_MAP } from '../../types/template.types';

@Injectable()
export class EmailAnalysisService {
  private readonly logger = new Logger(EmailAnalysisService.name);

  constructor(
    private readonly llmService: LLMService,
    private readonly templateService: TemplateService,
    private readonly config: ConfigService
  ) {}

  /**
   * Enhanced LLM processing with schedule-specific focus
   */
  async processEmailWithEnhancedPriority(
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
   * Select LLM template based on focus preference
   */
  selectTemplateByFocus(focus: string): string {
    return LLM_FOCUS_TEMPLATE_MAP[focus as keyof typeof LLM_FOCUS_TEMPLATE_MAP] 
      || TemplateNames.GENERAL_EMAIL_ANALYSIS;
  }
} 