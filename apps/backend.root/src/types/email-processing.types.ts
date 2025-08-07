import {
  EmailCategory,
  Priority,
  Sentiment,
  ProcessingStatus,
} from '@prisma/client';

import { Email } from './email.types';

export type ProcessedEmail = {
  messageId: string;
  emailAccountId: string;
  subject: string;
  fromAddress: string;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  receivedAt: Date;
  bodyText?: string;
  bodyHtml?: string;
  processingStatus: ProcessingStatus;
  category: EmailCategory;
  priority: Priority;
  sentiment: Sentiment;
  summary: string;
  tags: string[];
  confidence: number;
  importanceScore: number;
  priorityReasoning?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export interface EmailProcessingResult {
  success: boolean;
  error?: string;
  originalEmail?: Email;
  data: Partial<ProcessedEmail> & {
    processingStatus: ProcessingStatus;
  };
}

export interface EmailBatchProcessingResult {
  processed: number;
  failed: number;
  results: EmailProcessingResult[];
}
