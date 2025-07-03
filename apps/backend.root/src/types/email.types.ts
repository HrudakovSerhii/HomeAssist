import {
  Email,
  EmailCategory,
  EmailAttachment,
  Priority,
  Sentiment,
  EntityType,
  ActionType,
  ActionItem,
  ExtractedEmailData,
  EntityExtraction,
  PromptTemplate,
  LLMResponse,
  ProcessingStatus,
} from '@prisma/client';

export type EmailCreateInput = Omit<Email, 'id' | 'createdAt' | 'updatedAt'> & {
  attachments?: EmailAttachmentCreateInput[];
};

export type EmailAttachmentCreateInput = Omit<
  EmailAttachment,
  'id' | 'emailId' | 'createdAt'
>;

export type ParsedGmailMessage = {
  subject: string;
  fromAddress: string;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  receivedAt: Date;
  bodyText?: string;
  bodyHtml?: string;
  attachments?: EmailAttachmentCreateInput[];
};

// Application-specific derived types
export type EmailWithRelations = Email & {
  attachments: EmailAttachment[];
  llmResponses: LLMResponse[];
  extractedData: ExtractedEmailData[];
};

export type EmailWithFullRelations = Email & {
  attachments: EmailAttachment[];
  llmResponses: LLMResponse[];
  extractedData: (ExtractedEmailData & {
    entities: EntityExtraction[];
    actionItems: ActionItem[];
  })[];
};

export type EmailSummary = Pick<
  Email,
  'id' | 'subject' | 'fromAddress' | 'receivedAt' | 'processingStatus'
>;

export type EmailProcessingResult = {
  emailId: string;
  subject: string;
  success: boolean;
  extractedData?: ExtractedEmailData;
  error?: string;
  processingTimeMs?: number;
};

export type EmailBatchProcessingResult = {
  processed: number;
  failed: number;
  results: EmailProcessingResult[];
};

export type TemplateTestResult = {
  template: PromptTemplate;
  generatedPrompt: string;
  estimatedScore: number;
};

export type EmailIngestResult = {
  ingested: number;
  skipped: number;
  errors: string[];
};

export type EmailFilters = {
  page?: number;
  limit?: number;
  processed?: boolean;
  category?: EmailCategory;
  priority?: Priority;
  sentiment?: Sentiment;
  fromDate?: Date;
  toDate?: Date;
  search?: string;
};

export type EmailPaginatedResult = {
  emails: EmailWithFullRelations[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

// LLM Processing Types
export type LLMProcessingInput = {
  emailId: string;
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

// Export enums for convenience
export {
  ProcessingStatus,
  EmailCategory,
  Priority,
  Sentiment,
  EntityType,
  ActionType,
};

// Prisma-specific helper types for better type safety
export type EmailCreateData = Omit<
  Email,
  'id' | 'createdAt' | 'updatedAt' | 'messageId'
> & {
  messageId: string;
  attachments?: {
    create: EmailAttachmentCreateInput[];
  };
};

export type EmailUpdateData = Partial<
  Pick<
    Email,
    'subject' | 'processingStatus' | 'isProcessed' | 'bodyText' | 'bodyHtml'
  >
>;

export type ExtractedEmailDataCreateData = Omit<
  ExtractedEmailData,
  'id' | 'createdAt' | 'updatedAt'
> & {
  entities?: {
    create: EntityExtractionCreateInput[];
  };
  actionItems?: {
    create: ActionItemCreateInput[];
  };
};

export type EntityExtractionCreateInput = Omit<
  EntityExtraction,
  'id' | 'extractedDataId' | 'createdAt'
>;
export type ActionItemCreateInput = Omit<
  ActionItem,
  'id' | 'extractedDataId' | 'createdAt' | 'updatedAt'
>;

export type LLMResponseCreateData = Omit<
  LLMResponse,
  'id' | 'createdAt' | 'processedAt'
> & {
  processedAt?: Date;
};

// Query result types with proper relations
export type EmailWithAttachments = Email & {
  attachments: EmailAttachment[];
};

export type EmailWithProcessingData = Email & {
  attachments: EmailAttachment[];
  llmResponses: LLMResponse[];
  extractedData: (ExtractedEmailData & {
    entities: EntityExtraction[];
    actionItems: ActionItem[];
  })[];
};

// Batch operation types
export type EmailBatchCreateInput = {
  emails: EmailCreateData[];
};

export type EmailBatchUpdateInput = {
  where: { id: string }[];
  data: EmailUpdateData;
};

// Template operation types
export type TemplateWithCategories = PromptTemplate & {
  categoryCount?: number;
  lastUsed?: Date;
};

export type TemplateSelectionCriteria = {
  emailContent: string;
  category?: EmailCategory;
  priority?: Priority;
  minConfidence?: number;
};

// Advanced filtering and search types
export type EmailAdvancedFilters = EmailFilters & {
  hasAttachments?: boolean;
  processingStatus?: ProcessingStatus[];
  minConfidence?: number;
  entityTypes?: EntityType[];
  actionTypes?: ActionType[];
  templateUsed?: string;
  processingTimeRange?: {
    min?: number;
    max?: number;
  };
};

export type EmailSearchResult = {
  emails: EmailWithProcessingData[];
  aggregations: {
    totalCount: number;
    byCategory: Record<EmailCategory, number>;
    byPriority: Record<Priority, number>;
    bySentiment: Record<Sentiment, number>;
    byStatus: Record<ProcessingStatus, number>;
    avgProcessingTime: number;
    avgConfidence: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

// Validation and transformation types
export type EmailValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  transformedData?: EmailCreateData;
};

export type GmailToEmailTransform = {
  gmailMessage: any; // Gmail API message object
  transform: (message: any) => ParsedGmailMessage;
  validate: (data: ParsedGmailMessage) => EmailValidationResult;
};

// Analytics and reporting types
export type EmailProcessingStats = {
  totalEmails: number;
  processedEmails: number;
  failedEmails: number;
  avgProcessingTime: number;
  successRate: number;
  categoryDistribution: Record<EmailCategory, number>;
  priorityDistribution: Record<Priority, number>;
  sentimentDistribution: Record<Sentiment, number>;
  topEntities: Array<{
    type: EntityType;
    value: string;
    count: number;
  }>;
  topActionTypes: Array<{
    type: ActionType;
    count: number;
  }>;
  processingTimeRange: {
    min: number;
    max: number;
    avg: number;
    median: number;
  };
};

export type EmailProcessingReport = {
  period: {
    start: Date;
    end: Date;
  };
  stats: EmailProcessingStats;
  trends: {
    dailyVolume: Array<{
      date: string;
      count: number;
      processed: number;
      failed: number;
    }>;
    categoryTrends: Array<{
      category: EmailCategory;
      trend: 'up' | 'down' | 'stable';
      changePercent: number;
    }>;
  };
  recommendations: Array<{
    type: 'template' | 'rule' | 'performance';
    message: string;
    priority: Priority;
  }>;
};

// Error handling types
export type EmailProcessingError = {
  emailId: string;
  error: string;
  errorType: 'validation' | 'llm' | 'database' | 'template' | 'unknown';
  timestamp: Date;
  context?: Record<string, any>;
  retryable: boolean;
};

export type EmailProcessingErrorSummary = {
  total: number;
  byType: Record<string, number>;
  recent: EmailProcessingError[];
  retryableCount: number;
};
