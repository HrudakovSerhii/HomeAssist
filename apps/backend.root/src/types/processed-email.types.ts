import {
  ProcessedEmails,
  EntityExtraction,
  ActionItem,
  ProcessingStatus,
  EmailCategory,
  Priority,
  Sentiment,
} from '@prisma/client';

export type ProcessedEmailWithRelations = ProcessedEmails & {
  entities: EntityExtraction[];
  actionItems: ActionItem[];
};

export type ParsedGmailMessage = {
  messageId: string;
  subject: string;
  fromAddress: string;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  receivedAt: Date;
  bodyText?: string;
  bodyHtml?: string;
};

export type ProcessedEmailCreateInput = Omit<ProcessedEmails, 'id' | 'createdAt' | 'updatedAt'>;

export type ProcessedEmailSummary = Pick<
  ProcessedEmails,
  'id' | 'subject' | 'fromAddress' | 'receivedAt' | 'processingStatus'
>;

export type ProcessedEmailsPaginatedResult = {
  processedEmails: ProcessedEmailWithRelations[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type EmailProcessingResult = {
  messageId: string;
  subject: string;
  success: boolean;
  processedEmail?: ProcessedEmailWithRelations;
  error?: string;
  processingTimeMs?: number;
};

export type EmailBatchProcessingResult = {
  processed: number;
  failed: number;
  results: EmailProcessingResult[];
};

export type EmailIngestionResults = Array<{
  accountId: string;
  fetched: number;
  stored: number;
  processed: number;
  failed: number;
  error?: string;
  emails: Array<{
    id: string;
    subject: string;
    processed: boolean;
  }>;
}>;

// Export enums for convenience
export {
  ProcessingStatus,
  EmailCategory,
  Priority,
  Sentiment,
}; 