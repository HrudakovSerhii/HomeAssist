import { LlmFocus, ProcessingType } from '@prisma/client';

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
export interface UpdateProcessingScheduleDto
  extends Partial<CreateProcessingScheduleDto> {}

// Response type with all fields including relations
export interface ProcessingScheduleWithAccount
  extends Required<BaseProcessingSchedule> {
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

// Validation result interface
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  cronConflicts?: {
    conflictTime: Date;
    conflictingSchedules: string[];
    suggestedAlternatives: Date[];
  }[];
}

// Processing analytics interface
export interface ProcessingAnalytics {
  userId: string;
  totalSchedules: number;
  activeSchedules: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageProcessingTime: number;
  emailsProcessedToday: number;
  emailsProcessedThisWeek: number;
  emailsProcessedThisMonth: number;
  recentExecutions: {
    id: string;
    scheduleName: string;
    status: string;
    startedAt: Date;
    completedAt?: Date;
    processedEmails: number;
    failedEmails: number;
  }[];
}
