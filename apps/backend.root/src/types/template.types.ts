// Template Management Types
import {
  ActionType,
  EmailCategory,
  EntityType,
  Priority,
  PromptTemplate,
  Sentiment,
} from '@prisma/client';

export type TemplateCreateInput = {
  name: string;
  description: string;
  template: string;
  expectedOutputSchema: object;
  categories: EmailCategory[];
  version?: string;
};

export type TemplateUpdateInput = {
  name?: string;
  description?: string;
  template?: string;
  expectedOutputSchema?: object;
  categories?: EmailCategory[];
  isActive?: boolean;
  version?: string;
};

export type TemplateTestResult = {
  template: PromptTemplate;
  generatedPrompt: string;
  estimatedScore: number;
};

// Template validation result
export interface TemplateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Template name constants to ensure consistency across the codebase
 */
export enum TemplateNames {
  // Enhanced analysis templates
  GENERAL_EMAIL_ANALYSIS = 'general-email-analysis',
  ENHANCED_PRIORITY = 'enhanced-priority',
  SENTIMENT_FOCUSED = 'sentiment-focused',
  URGENCY_FOCUSED = 'urgency-focused',
  
  // Specialized processor templates
  INVOICE_PROCESSOR = 'invoice-processor',
  MEETING_PROCESSOR = 'meeting-processor',
  FINANCIAL_PROCESSOR = 'financial-processor',
  NEWS_PROCESSOR = 'news-processor',
  MARKETING_PROCESSOR = 'marketing-processor',
}

/**
 * LLM Focus to Template mapping
 */
export const LLM_FOCUS_TEMPLATE_MAP = {
  general: TemplateNames.GENERAL_EMAIL_ANALYSIS,
  sentiment: TemplateNames.SENTIMENT_FOCUSED,
  urgency: TemplateNames.URGENCY_FOCUSED,
} as const;
