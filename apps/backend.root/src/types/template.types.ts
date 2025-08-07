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
