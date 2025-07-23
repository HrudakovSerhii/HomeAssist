import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { EmailCategory } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { TemplateValidatorService } from './template-validator.service';
import {
  EmailMessage,
  TemplateValidationResult,
} from '../../types/email.types';

@Injectable()
export class TemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateValidator: TemplateValidatorService
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
   * Select best template for an email based on content analysis
   */
  async selectBestTemplate(email: EmailMessage): Promise<any> {
    // Get all active templates
    const templates = await this.getActiveTemplates();

    if (templates.length === 0) {
      return null;
    }

    // Simple template selection logic based on keywords
    const emailText = `${email.subject} ${
      email.bodyText || email.bodyHtml || ''
    }`.toLowerCase();

    // Priority-based template selection
    const templateScores = templates.map((template) => ({
      template,
      score: this.calculateTemplateScore(emailText, template, email),
    }));

    // Sort by score and return best match
    templateScores.sort((a, b) => b.score - a.score);

    return templateScores[0]?.template || templates[0]; // Return best match or first template as fallback
  }

  /**
   * Calculate template matching score based on email content
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
    } = await import('./templates');

    const defaultTemplates = [
      GENERAL_EMAIL_ANALYSIS_TEMPLATE,
      INVOICE_PROCESSOR_TEMPLATE,
      MEETING_PROCESSOR_TEMPLATE,
      FINANCIAL_PROCESSOR_TEMPLATE,
      NEWS_PROCESSOR_TEMPLATE,
      MARKETING_PROCESSOR_TEMPLATE,
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
}
