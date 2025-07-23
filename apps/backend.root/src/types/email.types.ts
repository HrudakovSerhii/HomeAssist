import {
  EmailCategory,
  Priority,
  Sentiment,
  EntityType,
  ActionType,
  PromptTemplate,
} from '@prisma/client';

// IMAP/Gmail Email Message structure (before processing)
export interface EmailMessage {
  uid: number;
  messageId: string;
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  date: Date;
  bodyText?: string;
  bodyHtml?: string;
  flags: string[];
}

// LLM Processing Types
export type LLMProcessingInput = {
  messageId: string;
  templateName?: string;
  modelName?: string;
  temperature?: number;
};

export type LLMRawResponse = {
  response?: string;
  message?: {
    content: string;
    role: string;
  };
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type ParsedLLMResponse = {
  category: EmailCategory;
  priority: Priority;
  sentiment: Sentiment;
  summary: string;
  tags: string[];
  confidence: number;
  entities: {
    type: EntityType;
    value: string;
    confidence: number;
    context?: string;
  }[];
  actionItems: {
    description: string;
    actionType: ActionType;
    priority: Priority;
    dueDate?: string;
  }[];
};

// Rule Processing Types
export type RuleCondition = {
  field: string; // 'fromAddress', 'subject', 'bodyText', etc.
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'regex';
  value: string;
};

export type RuleAction = {
  type:
    | 'setCategory'
    | 'setPriority'
    | 'addTag'
    | 'skipProcessing'
    | 'useTemplate';
  value: string;
};

// Template Management Types
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

// Template type safety interface
export interface EmailAnalysisTemplate {
  name: string;
  description: string;
  categories: EmailCategory[];
  template: string;
  expectedOutputSchema: {
    type: 'object';
    required: string[];
    properties: Record<string, any>;
  };
  // Type-safe example response structure
  exampleResponse: {
    category: EmailCategory;
    priority: Priority;
    sentiment: Sentiment;
    summary: string;
    entities: Array<{
      type: EntityType;
      value: string | string[];
      confidence: number;
      context?: string;
    }>;
    actionItems: Array<{
      actionType: ActionType;
      description: string;
      priority: Priority;
      dueDate?: string;
    }>;
    tags: string[];
    confidence: number;
  };
}

// Template validation result
export interface TemplateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Email Processing Result Types (for email ingestion results)
export type EmailIngestResult = {
  ingested: number;
  skipped: number;
  errors: string[];
};

// Export enums for convenience
export {
  EmailCategory,
  Priority,
  Sentiment,
  EntityType,
  ActionType,
};
