import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { EmailCategory, LlmFocus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { TemplateValidatorService } from './template-validator.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { EmailMessage } from '../../types/email.types';
import { TemplateValidationResult, TemplateNames } from '../../types/template.types';
import { TemplateConfig } from '../../types/email-processing.types';
import {
  ENHANCED_PRIORITY_TEMPLATE,
  SENTIMENT_FOCUSED_TEMPLATE,
  URGENCY_FOCUSED_TEMPLATE,
} from './templates/email-analysis.template';

// Processing schedule interface for user preferences
interface ProcessingSchedule {
  id: string;
  senderPriorities?: Record<string, string>;
  emailTypePriorities?: Record<string, string>;
  llmFocus?: LlmFocus;
}

@Injectable()
export class TemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateValidator: TemplateValidatorService,
    private readonly embeddingService: EmbeddingService
  ) {}

  /**
   * Get all active templates
   */
  async getActiveTemplates() {
    return this.prisma.promptTemplate.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get template by name
   */
  async getTemplateByName(name: string) {
    return this.prisma.promptTemplate.findFirst({
      where: {
        name,
        isActive: true,
      },
    });
  }

  /**
   * Get template by ID
   */
  async getTemplateById(id: string) {
    const template = await this.prisma.promptTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new HttpException('Template not found', HttpStatus.NOT_FOUND);
    }

    return template;
  }

  /**
   * Create new template with validation
   */
  async createTemplate(data: {
    name: string;
    description: string;
    template: string;
    expectedOutputSchema: any;
    categories: EmailCategory[];
    version?: string;
  }) {
    // Check if template with same name exists
    const existing = await this.prisma.promptTemplate.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new HttpException(
        'Template with this name already exists',
        HttpStatus.CONFLICT
      );
    }

    return this.prisma.promptTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        template: data.template,
        expectedOutputSchema: data.expectedOutputSchema,
        categories: data.categories,
        version: data.version || '1.0.0',
      },
    });
  }

  /**
   * Validate LLM response against schema types
   */
  async validateLLMResponse(response: any): Promise<TemplateValidationResult> {
    return await this.templateValidator.validateLLMResponse(response);
  }

  /**
   * Select best template for an email based on embedding-based semantic analysis
   */
  async selectBestTemplate(email: EmailMessage): Promise<any> {
    try {
      // Check if embedding service is ready
      if (!this.embeddingService.isReady()) {
        console.warn('⚠️ EmbeddingService not ready, falling back to basic template selection');
        return this.selectBestTemplateFallback(email);
      }

      // Use embedding service for intelligent category classification
      const classification = await this.embeddingService.classifyEmailSubject(email.subject);
      
      // Get the recommended template based on the classified category
      const recommendedTemplateName = this.embeddingService.getCategoryTemplate(classification.category);
      
      // Get all active templates
      const templates = await this.getActiveTemplates();
      
      if (templates.length === 0) {
        return null;
      }

      // Find the recommended template in our active templates
      const recommendedTemplate = templates.find(t => t.name === recommendedTemplateName);
      
      if (recommendedTemplate) {
        console.log(
          `🎯 Selected template "${recommendedTemplateName}" for category "${classification.category}" (confidence: ${(classification.confidence * 100).toFixed(1)}%)`
        );
        return recommendedTemplate;
      }

      // If recommended template not found, try to find a similar one
      const fallbackTemplate = this.findSimilarTemplate(templates, recommendedTemplateName, classification.category);
      
      if (fallbackTemplate) {
        console.log(
          `🔄 Using fallback template "${fallbackTemplate.name}" for category "${classification.category}"`
        );
        return fallbackTemplate;
      }

      // Final fallback to general email analysis
      const generalTemplate = templates.find(t => t.name === 'general-email-analysis');
      console.log(`⚠️ Using general template as final fallback`);
      return generalTemplate || templates[0];
      
    } catch (error) {
      console.error('❌ Embedding-based template selection failed:', error);
      return this.selectBestTemplateFallback(email);
    }
  }

  /**
   * Fallback template selection using basic keyword matching
   */
  private async selectBestTemplateFallback(email: EmailMessage): Promise<any> {
    const templates = await this.getActiveTemplates();
    
    if (templates.length === 0) {
      return null;
    }

    // Simple keyword-based selection as fallback
    const emailText = `${email.subject} ${email.bodyText || email.bodyHtml || ''}`.toLowerCase();
    
    // Basic template mapping based on keywords
    const keywordMappings = [
      { keywords: ['invoice', 'bill', 'payment', 'receipt'], templateName: 'invoice-processor' },
      { keywords: ['meeting', 'appointment', 'calendar', 'schedule'], templateName: 'meeting-processor' },
      { keywords: ['marketing', 'promotion', 'sale', 'offer'], templateName: 'marketing-processor' },
      { keywords: ['newsletter', 'digest', 'update'], templateName: 'news-processor' },
      { keywords: ['purchase', 'order', 'transaction'], templateName: 'financial-processor' },
    ];

    for (const mapping of keywordMappings) {
      if (mapping.keywords.some(keyword => emailText.includes(keyword))) {
        const template = templates.find(t => t.name === mapping.templateName);
        if (template) {
          console.log(`📝 Fallback: Selected template "${mapping.templateName}" based on keywords`);
          return template;
        }
      }
    }

    // Final fallback to general template
    const generalTemplate = templates.find(t => t.name === 'general-email-analysis');
    return generalTemplate || templates[0];
  }

  /**
   * Find a similar template when the exact recommended template is not available
   */
  private findSimilarTemplate(templates: any[], recommendedTemplateName: string, category: EmailCategory): any | null {
    // Template similarity mappings
    const similarityMappings: Record<string, string[]> = {
      'invoice-processor': ['financial-processor', 'general-email-analysis'],
      'meeting-processor': ['general-email-analysis'],
      'marketing-processor': ['general-email-analysis'],
      'news-processor': ['general-email-analysis'],
      'financial-processor': ['invoice-processor', 'general-email-analysis'],
      'general-email-analysis': ['enhanced-priority', 'sentiment-focused'],
      'sentiment-focused': ['general-email-analysis', 'enhanced-priority'],
    };

    const similarTemplates = similarityMappings[recommendedTemplateName] || [];
    
    for (const similarTemplateName of similarTemplates) {
      const template = templates.find(t => t.name === similarTemplateName);
      if (template) {
        return template;
      }
    }

    return null;
  }

  /**
   * Calculate template matching score based on email content
   * @deprecated This method is replaced by embedding-based selection
   */
  private calculateTemplateScore(
    emailText: string,
    template: any,
    email?: EmailMessage
  ): number {
    let score = 0;

    // 1. SENDER DOMAIN ANALYSIS (High confidence signals)
    if (email?.from) {
      score += this.scoreBySenderDomain(email.from, template);
    }

    // 2. SUBJECT LINE PATTERNS (Strong indicators)
    if (email?.subject) {
      score += this.scoreBySubjectPatterns(email.subject, template);
    }

    // 3. CONTENT STRUCTURE ANALYSIS (Format-based scoring)
    score += this.scoreByContentStructure(emailText, template);

    // 4. WEIGHTED KEYWORD MATCHING (Improved keyword system)
    score += this.scoreByWeightedKeywords(emailText, template);

    // 5. TEMPLATE NAME SIMILARITY (Existing logic, improved)
    score += this.scoreByTemplateNameSimilarity(emailText, template);

    return score;
  }

  /**
   * @deprecated This method is replaced by embedding-based selection
   */
  private scoreBySenderDomain(fromAddress: string, template: any): number {
    const domain = fromAddress.split('@')[1]?.toLowerCase() || '';
    let score = 0;

    // Domain-based template mapping (high confidence)
    const domainMappings: Record<
      string,
      { templates: string[]; score: number }
    > = {
      // Financial/Invoice domains
      'apple.com': { templates: ['invoice-processor'], score: 25 },
      'paypal.com': { templates: ['invoice-processor'], score: 25 },
      'stripe.com': { templates: ['invoice-processor'], score: 25 },
      'billing.': { templates: ['invoice-processor'], score: 20 }, // subdomain pattern

      // Meeting/Calendar domains
      'calendar.google.com': { templates: ['meeting-processor'], score: 25 },
      'outlook.live.com': { templates: ['meeting-processor'], score: 25 },
      'calendly.com': { templates: ['meeting-processor'], score: 25 },

      // News/Newsletter domains
      'newsletter.': { templates: ['news-processor'], score: 20 },
      'news.': { templates: ['news-processor'], score: 15 },
      'techcrunch.com': { templates: ['news-processor'], score: 25 },
      'bloomberg.com': { templates: ['financial-processor'], score: 25 },

      // Marketing domains
      'mailchimp.com': { templates: ['marketing-processor'], score: 20 },
      'constantcontact.com': { templates: ['marketing-processor'], score: 20 },
      unsubscribe: { templates: ['marketing-processor'], score: 15 }, // in domain
    };

    // Check exact domain matches
    if (domainMappings[domain]) {
      const mapping = domainMappings[domain];
      if (mapping.templates.includes(template.name)) {
        score += mapping.score;
      }
    }

    // Check subdomain patterns
    for (const [pattern, mapping] of Object.entries(domainMappings)) {
      if (pattern.includes('.') && domain.includes(pattern)) {
        if (mapping.templates.includes(template.name)) {
          score += mapping.score;
        }
      }
    }

    return score;
  }

  /**
   * @deprecated This method is replaced by embedding-based selection
   */
  private scoreBySubjectPatterns(subject: string, template: any): number {
    let score = 0;

    // Subject line patterns for each template type
    const subjectPatterns: Record<
      string,
      { patterns: RegExp[]; score: number }
    > = {
      'invoice-processor': {
        patterns: [
          /invoice|bill|payment|receipt/i,
          /your .+ subscription/i,
          /payment (due|failed|received)/i,
          /\$[\d,]+\.?\d*/, // Dollar amounts
        ],
        score: 15,
      },
      'meeting-processor': {
        patterns: [
          /meeting|appointment|calendar/i,
          /(invitation|invite).*meeting/i,
          /scheduled|reschedule/i,
          /(join|attend).*(call|meeting)/i,
        ],
        score: 15,
      },
      'financial-processor': {
        patterns: [
          /market|stock|trading/i,
          /(earnings|financial) (report|update)/i,
          /portfolio|investment/i,
          /(market|stock) alert/i,
        ],
        score: 15,
      },
      'news-processor': {
        patterns: [
          /newsletter|news|update/i,
          /weekly|daily|monthly (digest|roundup)/i,
          /breaking|latest news/i,
        ],
        score: 15,
      },
      'marketing-processor': {
        patterns: [
          /(sale|discount|offer|deal)/i,
          /\d+% off|save \d+/i,
          /limited time|expires/i,
          /unsubscribe/i,
        ],
        score: 15,
      },
    };

    const templatePatterns = subjectPatterns[template.name];
    if (templatePatterns) {
      for (const pattern of templatePatterns.patterns) {
        if (pattern.test(subject)) {
          score += templatePatterns.score;
        }
      }
    }

    return score;
  }

  private scoreByContentStructure(content: string, template: any): number {
    let score = 0;

    // Content structure indicators
    const structureIndicators = {
      'invoice-processor': [
        /amount.*due/i,
        /total.*\$[\d,]+/i,
        /payment.*method/i,
        /billing.*address/i,
      ],
      'meeting-processor': [
        /\d{1,2}:\d{2} (am|pm)/i, // Time format
        /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
        /conference.*room|zoom|teams/i,
        /attendees?:/i,
      ],
      'news-processor': [
        /read more|continue reading/i,
        /in this (issue|edition)/i,
        /subscribe|unsubscribe/i,
      ],
      'marketing-processor': [
        /shop now|buy now|click here/i,
        /terms.*conditions/i,
        /valid until|expires/i,
      ],
    };

    const indicators = structureIndicators[template.name] || [];
    for (const indicator of indicators) {
      if (indicator.test(content)) {
        score += 8;
      }
    }

    return score;
  }

  private scoreByWeightedKeywords(content: string, template: any): number {
    let score = 0;

    // Enhanced weighted keywords (replacing the old simple system)
    const weightedKeywords: Record<string, Record<string, number>> = {
      'invoice-processor': {
        invoice: 15,
        bill: 12,
        payment: 15,
        amount: 10,
        due: 12,
        subscription: 15,
        apple: 8,
        google: 8,
        paypal: 12,
        stripe: 12,
        total: 8,
        charged: 10,
        billing: 12,
      },
      'meeting-processor': {
        meeting: 15,
        appointment: 15,
        schedule: 12,
        calendar: 12,
        reminder: 10,
        conference: 10,
        zoom: 8,
        teams: 8,
        agenda: 10,
        attendees: 8,
      },
      'financial-processor': {
        market: 15,
        stock: 12,
        trading: 12,
        portfolio: 15,
        investment: 15,
        earnings: 12,
        financial: 10,
        fund: 10,
        analyst: 8,
        recommendation: 8,
      },
      'news-processor': {
        newsletter: 15,
        news: 12,
        update: 10,
        weekly: 8,
        daily: 8,
        breaking: 12,
        article: 10,
        read: 8,
      },
      'marketing-processor': {
        sale: 15,
        discount: 12,
        offer: 12,
        deal: 12,
        promo: 10,
        coupon: 10,
        limited: 8,
        expires: 10,
        unsubscribe: 15,
      },
    };

    const keywords = weightedKeywords[template.name] || {};
    for (const [keyword, weight] of Object.entries(keywords)) {
      const occurrences = (content.match(new RegExp(keyword, 'gi')) || [])
        .length;
      score += occurrences * weight;
    }

    return score;
  }

  private scoreByTemplateNameSimilarity(
    content: string,
    template: any
  ): number {
    let score = 0;
    const templateNameWords = template.name.toLowerCase().split(/[-_\s]+/);

    for (const word of templateNameWords) {
      if (word.length > 3 && content.includes(word)) {
        // Skip short words
        score += 5;
      }
    }

    return score;
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(category: EmailCategory) {
    return this.prisma.promptTemplate.findMany({
      where: {
        categories: {
          has: category,
        },
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Seed default templates
   */
  async seedDefaultTemplates() {
    // Import all templates from dedicated files
    const {
      GENERAL_EMAIL_ANALYSIS_TEMPLATE,
      INVOICE_PROCESSOR_TEMPLATE,
      MEETING_PROCESSOR_TEMPLATE,
      FINANCIAL_PROCESSOR_TEMPLATE,
      NEWS_PROCESSOR_TEMPLATE,
      MARKETING_PROCESSOR_TEMPLATE,
      ENHANCED_PRIORITY_TEMPLATE,
      SENTIMENT_FOCUSED_TEMPLATE,
      URGENCY_FOCUSED_TEMPLATE,
    } = await import('./templates');

    const defaultTemplates = [
      GENERAL_EMAIL_ANALYSIS_TEMPLATE,
      INVOICE_PROCESSOR_TEMPLATE,
      MEETING_PROCESSOR_TEMPLATE,
      FINANCIAL_PROCESSOR_TEMPLATE,
      NEWS_PROCESSOR_TEMPLATE,
      MARKETING_PROCESSOR_TEMPLATE,
      ENHANCED_PRIORITY_TEMPLATE,
      SENTIMENT_FOCUSED_TEMPLATE,
      URGENCY_FOCUSED_TEMPLATE,
    ];

    const results = [];

    for (const templateData of defaultTemplates) {
      try {
        const existing = await this.prisma.promptTemplate.findUnique({
          where: { name: templateData.name },
        });

        if (!existing) {
          // Extract only the fields that exist in the Prisma schema
          const dbData = {
            name: templateData.name,
            description: templateData.description,
            template: templateData.template,
            expectedOutputSchema: templateData.expectedOutputSchema,
            categories: templateData.categories,
            // Optional fields with defaults will be handled by Prisma
          };

          const created = await this.prisma.promptTemplate.create({
            data: dbData,
          });

          results.push({ created: created.name });
        } else {
          results.push({ skipped: templateData.name });
        }
      } catch (error) {
        results.push({ error: `${templateData.name}: ${error.message}` });
      }
    }

    return results;
  }

  /**
   * Generate prompt from template with data
   */
  async generatePrompt(
    templateName: string,
    data: {
      email: EmailMessage;
      priorityHints?: any;
      userPreferences?: any;
    }
  ): Promise<string> {
    const template = await this.getTemplateByName(templateName);
    if (!template) {
      throw new HttpException(`Template ${templateName} not found`, HttpStatus.NOT_FOUND);
    }

    // Replace template variables with data
    let prompt = template.template;
    
    // Replace email data
    prompt = prompt.replace('{{subject}}', data.email.subject || '');
    prompt = prompt.replace('{{from}}', data.email.from || '');
    prompt = prompt.replace('{{to}}', Array.isArray(data.email.to) ? data.email.to.join(', ') : data.email.to || '');
    prompt = prompt.replace('{{body}}', data.email.bodyText || data.email.bodyHtml || '');

    // Add priority hints if available
    if (data.priorityHints) {
      prompt = prompt.replace('{{priorityHints}}', JSON.stringify(data.priorityHints, null, 2));
    } else {
      prompt = prompt.replace('{{priorityHints}}', '{}');
    }

    // Add user preferences if available
    if (data.userPreferences) {
      prompt = prompt.replace('{{userPreferences}}', JSON.stringify(data.userPreferences, null, 2));
    } else {
      prompt = prompt.replace('{{userPreferences}}', '{}');
    }

    return prompt;
  }

  /**
   * Parse LLM response according to template schema
   */
  async parseResponse(templateName: string, response: string): Promise<any> {
    const template = await this.getTemplateByName(templateName);
    if (!template) {
      throw new HttpException(`Template ${templateName} not found`, HttpStatus.NOT_FOUND);
    }

    try {
      // Parse JSON response
      const parsed = JSON.parse(response);

      // Validate against schema
      const validationResult = await this.validateLLMResponse(parsed);
      if (!validationResult.isValid) {
        throw new Error(`Invalid response format: ${validationResult.errors.join(', ')}`);
      }

      return parsed;
    } catch (error) {
      throw new HttpException(
        `Failed to parse LLM response: ${error.message}`,
        HttpStatus.BAD_REQUEST
      );
    }
  }

  // ============================================================================
  // ENHANCED LLM TEMPLATE METHODS (from enhanced-template.service.ts)
  // ============================================================================

  /**
   * ENHANCED: Select appropriate template based on user focus preference
   * This method provides enhanced template selection with LLM focus support
   */
  selectTemplateByFocus(focus: LlmFocus | string): TemplateConfig {
    const templates = {
      'general': {
        name: TemplateNames.ENHANCED_PRIORITY,
        template: ENHANCED_PRIORITY_TEMPLATE.template,
        description: 'Comprehensive priority analysis with scoring breakdown'
      },
      'sentiment': {
        name: TemplateNames.SENTIMENT_FOCUSED,
        template: SENTIMENT_FOCUSED_TEMPLATE.template,
        description: 'Sentiment-driven priority assessment'
      },
      'urgency': {
        name: TemplateNames.URGENCY_FOCUSED, 
        template: URGENCY_FOCUSED_TEMPLATE.template,
        description: 'Time-critical urgency detection'
      }
    };
    
    return templates[focus as string] || templates['general'];
  }

  /**
   * ENHANCED: Generate enhanced prompt with user configuration
   * This method extends the basic generatePrompt with advanced user preferences
   */
  generateEnhancedPrompt(
    email: EmailMessage,
    schedule: ProcessingSchedule,
    templateConfig: TemplateConfig
  ): string {
    let prompt = templateConfig.template;
    
    // Replace email variables
    prompt = prompt.replace(/\{\{subject\}\}/g, email.subject || '');
    prompt = prompt.replace(/\{\{fromAddress\}\}/g, email.from || '');
    prompt = prompt.replace(/\{\{receivedAt\}\}/g, email.date?.toISOString() || '');
    prompt = prompt.replace(/\{\{bodyText\}\}/g, email.bodyText || email.bodyHtml || '');
    
    // Handle Handlebars-style conditional blocks for user preferences
    if (schedule.senderPriorities && Object.keys(schedule.senderPriorities).length > 0) {
      const senderConfig = JSON.stringify(schedule.senderPriorities);
      prompt = prompt.replace(
        /\{\{#if senderPriorities\}\}[\s\S]*?\{\{senderPriorities\}\}[\s\S]*?\{\{\/if\}\}/g,
        `Sender Priority Overrides: ${senderConfig}`
      );
    } else {
      prompt = prompt.replace(
        /\{\{#if senderPriorities\}\}[\s\S]*?\{\{\/if\}\}/g,
        ''
      );
    }
    
    if (schedule.emailTypePriorities && Object.keys(schedule.emailTypePriorities).length > 0) {
      const typeConfig = JSON.stringify(schedule.emailTypePriorities);
      prompt = prompt.replace(
        /\{\{#if emailTypePriorities\}\}[\s\S]*?\{\{emailTypePriorities\}\}[\s\S]*?\{\{\/if\}\}/g,
        `Email Type Priority Overrides: ${typeConfig}`
      );
    } else {
      prompt = prompt.replace(
        /\{\{#if emailTypePriorities\}\}[\s\S]*?\{\{\/if\}\}/g,
        ''
      );
    }
    
    if (schedule.llmFocus) {
      prompt = prompt.replace(
        /\{\{#if llmFocus\}\}[\s\S]*?\{\{llmFocus\}\}[\s\S]*?\{\{\/if\}\}/g,
        `Analysis Focus: ${schedule.llmFocus} (adjust scoring emphasis accordingly)`
      );
    } else {
      prompt = prompt.replace(
        /\{\{#if llmFocus\}\}[\s\S]*?\{\{\/if\}\}/g,
        ''
      );
    }
    
    // Clean up any remaining template variables
    prompt = prompt.replace(/\{\{[^}]+\}\}/g, '');
    
    return prompt;
  }

  /**
   * ENHANCED: Get all available enhanced templates
   * This method provides access to the new enhanced LLM templates
   */
  getAvailableEnhancedTemplates(): TemplateConfig[] {
    return [
      this.selectTemplateByFocus('general'),
      this.selectTemplateByFocus('sentiment'),
      this.selectTemplateByFocus('urgency'),
    ];
  }

  /**
   * ENHANCED: Get enhanced template by name
   * This method extends the basic getTemplateByName for enhanced templates
   */
  getEnhancedTemplateByName(name: string): TemplateConfig | null {
    const templates = this.getAvailableEnhancedTemplates();
    return templates.find(template => template.name === name) || null;
  }

  /**
   * ENHANCED: Validate template configuration
   * This method provides validation for enhanced template configurations
   */
  validateEnhancedTemplate(templateConfig: TemplateConfig): boolean {
    return !!(
      templateConfig.name &&
      templateConfig.template &&
      templateConfig.description
    );
  }
}
