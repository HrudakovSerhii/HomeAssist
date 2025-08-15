import {
  EmailCategory,
  Priority,
  Sentiment,
  EntityType,
  ActionType,
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

// Stored IMAP/Gmail Email with priority assigned
export interface Email extends EmailMessage {
  priorityHints?: {
    senderPriority?: Priority;
    typePriority?: Priority;
    userConfiguredSender?: boolean;
    userConfiguredType?: boolean;
  };
}

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

// Email Processing Result Types (for email ingestion results)
export type EmailIngestResult = {
  ingested: number;
  skipped: number;
  errors: string[];
};

// Export enums for convenience
export { EmailCategory, Priority, Sentiment, EntityType, ActionType };
