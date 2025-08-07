import {
  EmailCategory,
  Priority,
  Sentiment,
  ProcessingStatus,
  ProcessedEmails,
  ProcessingType,
  LlmFocus,
} from '@prisma/client';
import { EmailMessage } from './email.types';

export interface Email extends EmailMessage {
  priorityHints?: {
    senderPriority?: Priority;
    typePriority?: Priority;
    userConfiguredSender?: boolean;
    userConfiguredType?: boolean;
  };
}

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

export interface ScheduleExecutionStatus {
  id: string;
  scheduleId: string;
  scheduleName: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: {
    totalBatches: number;
    completedBatches: number;
    totalEmails: number;
    processedEmails: number;
    failedEmails: number;
    completionPercentage: number;
  };
  timing: {
    startedAt: Date;
    completedAt?: Date;
    processingDuration?: number;
  };
  error?: {
    message: string;
    details?: any;
  };
}

// Base interface for processing schedule types
export interface BaseProcessingSchedule {
  // Required fields
  name: string;
  emailAccountId: string;
  processingType: ProcessingType;
  
  // Optional fields
  description?: string;
  isEnabled?: boolean;
  isDefault?: boolean;
  
  // Processing Configuration
  dateRangeFrom?: Date;
  dateRangeTo?: Date;
  cronExpression?: string;
  timezone?: string;
  specificDates?: any; // JSON type in Prisma

  // Processing Preferences
  batchSize?: number;
  emailTypePriorities?: any; // JSON type in Prisma
  senderPriorities?: any; // JSON type in Prisma
  llmFocus?: LlmFocus;
}

// DTO for creating a new processing schedule
export interface CreateProcessingScheduleDto extends BaseProcessingSchedule {
  userId: string; // Required for creation
}

// Update DTO - same as create but all fields are optional
export interface UpdateProcessingScheduleDto extends Partial<CreateProcessingScheduleDto> {}

// Response type with all fields including relations
export interface ProcessingScheduleWithAccount extends Required<BaseProcessingSchedule> {
  // Additional fields not in DTO
  id: string;
  userId: string;
  
  // Execution Tracking
  lastExecutedAt?: Date;
  nextExecutionAt?: Date;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;

  // Metadata
  createdAt: Date;
  updatedAt: Date;

  // Included relation
  emailAccount: {
    email: string;
    displayName?: string;
  };
}

export interface CronJobCalendarEntry {
  configId: string;
  configName: string;
  userId: string;
  accountEmail: string;
  cronExpression: string;
  nextExecutions: Date[];
  timezone: string;
}
