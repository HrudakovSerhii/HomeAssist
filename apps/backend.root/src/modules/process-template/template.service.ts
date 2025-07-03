import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { EmailCategory } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class TemplateService {
  constructor(private readonly prisma: PrismaService) {}

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
   * Create new template
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
   * Update template
   */
  async updateTemplate(
    id: string,
    data: {
      name?: string;
      description?: string;
      template?: string;
      expectedOutputSchema?: any;
      categories?: EmailCategory[];
      isActive?: boolean;
      version?: string;
    }
  ) {
    const template = await this.getTemplateById(id);

    // If updating name, check for conflicts
    if (data.name && data.name !== template.name) {
      const existing = await this.prisma.promptTemplate.findUnique({
        where: { name: data.name },
      });

      if (existing) {
        throw new HttpException(
          'Template with this name already exists',
          HttpStatus.CONFLICT
        );
      }
    }

    return this.prisma.promptTemplate.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete template
   */
  async deleteTemplate(id: string) {
    await this.getTemplateById(id); // Verify exists
    return this.prisma.promptTemplate.delete({
      where: { id },
    });
  }

  /**
   * Select best template for an email based on content analysis
   */
  async selectBestTemplate(email: any): Promise<any> {
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
      score: this.calculateTemplateScore(emailText, template),
    }));

    // Sort by score and return best match
    templateScores.sort((a, b) => b.score - a.score);

    return templateScores[0]?.template || templates[0]; // Return best match or first template as fallback
  }

  /**
   * Calculate template matching score based on email content
   */
  private calculateTemplateScore(emailText: string, template: any): number {
    let score = 0;

    // Check category-based keywords
    const categoryKeywords: Record<EmailCategory, string[]> = {
      [EmailCategory.INVOICE]: [
        'invoice',
        'bill',
        'payment',
        'amount',
        'due',
        'subscription',
        'apple',
        'google',
      ],
      [EmailCategory.RECEIPT]: [
        'receipt',
        'purchase',
        'order',
        'transaction',
        'paid',
      ],
      [EmailCategory.APPOINTMENT]: [
        'appointment',
        'meeting',
        'schedule',
        'calendar',
        'reminder',
      ],
      [EmailCategory.SUPPORT]: [
        'support',
        'help',
        'issue',
        'problem',
        'ticket',
        'assistance',
      ],
      [EmailCategory.MARKETING]: [
        'unsubscribe',
        'offer',
        'sale',
        'discount',
        'promotion',
      ],
      [EmailCategory.NEWSLETTER]: [
        'newsletter',
        'updates',
        'news',
        'weekly',
        'monthly',
      ],
      [EmailCategory.WORK]: [
        'project',
        'deadline',
        'team',
        'office',
        'colleague',
      ],
      [EmailCategory.NOTIFICATION]: [
        'notification',
        'alert',
        'update',
        'status',
        'confirmed',
      ],
      [EmailCategory.PERSONAL]: ['personal', 'family', 'friend', 'social'],
    };

    // Score based on category matches
    for (const category of template.categories as EmailCategory[]) {
      const keywords = categoryKeywords[category] || [];
      for (const keyword of keywords) {
        if (emailText.includes(keyword)) {
          score += 10;
        }
      }
    }

    // Bonus for exact keyword matches in template name
    const templateNameWords = template.name.toLowerCase().split(/[-_\s]+/);
    for (const word of templateNameWords) {
      if (emailText.includes(word)) {
        score += 5;
      }
    }

    return score;
  }

  /**
   * Test template with sample email content
   */
  async testTemplate(
    templateId: string,
    sampleEmail: {
      subject: string;
      fromAddress: string;
      bodyText?: string;
      bodyHtml?: string;
    }
  ): Promise<{
    template: any;
    generatedPrompt: string;
    estimatedScore: number;
  }> {
    const template = await this.getTemplateById(templateId);

    // Generate prompt
    let prompt = template.template;
    prompt = prompt.replace(/\{\{subject}}/g, sampleEmail.subject || '');
    prompt = prompt.replace(
      /\{\{fromAddress}}/g,
      sampleEmail.fromAddress || ''
    );
    prompt = prompt.replace(
      /\{\{bodyText}}/g,
      sampleEmail.bodyText || sampleEmail.bodyHtml || ''
    );
    prompt = prompt.replace(/\{\{receivedAt}}/g, new Date().toISOString());

    // Calculate score
    const emailText = `${sampleEmail.subject} ${
      sampleEmail.bodyText || sampleEmail.bodyHtml || ''
    }`.toLowerCase();
    const score = this.calculateTemplateScore(emailText, template);

    return {
      template,
      generatedPrompt: prompt,
      estimatedScore: score,
    };
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
    } = await import('./templates');

    const defaultTemplates = [
      GENERAL_EMAIL_ANALYSIS_TEMPLATE,
      INVOICE_PROCESSOR_TEMPLATE,
      MEETING_PROCESSOR_TEMPLATE,
    ];

    const results = [];

    for (const templateData of defaultTemplates) {
      try {
        const existing = await this.prisma.promptTemplate.findUnique({
          where: { name: templateData.name },
        });

        if (!existing) {
          const created = await this.prisma.promptTemplate.create({
            data: templateData,
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
