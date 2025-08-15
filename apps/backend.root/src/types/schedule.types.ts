import { LlmFocus, ProcessingType, EmailCategory, Priority, Prisma } from '@prisma/client';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  ValidateIf,
  Matches,
  IsArray,
  ArrayMinSize,
  IsNumber,
  Min,
  Max,
  IsObject,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';

export interface ScheduleExecutionStatus {
  id: string;
  scheduleId: string;
  scheduleName: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PENDING';
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
    estimatedCompletion?: Date;
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
export class CreateProcessingScheduleDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  emailAccountId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(['DATE_RANGE', 'RECURRING', 'SPECIFIC_DATES'])
  processingType: ProcessingType;

  // Date Range fields
  @ValidateIf(o => o.processingType === 'DATE_RANGE')
  @IsDateString()
  dateRangeFrom?: string;

  @ValidateIf(o => o.processingType === 'DATE_RANGE')
  @IsOptional()
  @IsDateString()
  dateRangeTo?: string;

  // Recurring fields
  @ValidateIf(o => o.processingType === 'RECURRING')
  @IsString()
  @Matches(/^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/, {
    message: 'Invalid cron expression format'
  })
  cronExpression?: string;

  @ValidateIf(o => o.processingType === 'RECURRING')
  @IsString()
  timezone?: string;

  // Specific dates fields
  @ValidateIf(o => o.processingType === 'SPECIFIC_DATES')
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one specific date is required' })
  specificDates?: string[];

  // Processing preferences
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Batch size must be at least 1' })
  @Max(20, { message: 'Batch size cannot exceed 20' })
  batchSize?: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Transform(({ value }) => {
    // Validate email type priorities
    const validCategories = Object.values(EmailCategory);
    const validPriorities = Object.values(Priority);
    
    for (const [category, priority] of Object.entries(value || {})) {
      if (!validCategories.includes(category as EmailCategory)) {
        throw new BadRequestException(`Invalid email category: ${category}`);
      }
      if (!validPriorities.includes(priority as Priority)) {
        throw new BadRequestException(`Invalid priority: ${priority}`);
      }
    }
    return value;
  })
  emailTypePriorities?: Record<string, string>;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Transform(({ value }) => {
    // Validate sender priorities
    const validPriorities = Object.values(Priority);
    
    for (const [email, priority] of Object.entries(value || {})) {
      if (!email.includes('@')) {
        throw new BadRequestException(`Invalid email address: ${email}`);
      }
      if (!validPriorities.includes(priority as Priority)) {
        throw new BadRequestException(`Invalid priority: ${priority}`);
      }
    }
    return value;
  })
  senderPriorities?: Record<string, string>;

  @IsOptional()
  @IsEnum(['general', 'sentiment', 'urgency'])
  llmFocus?: 'general' | 'sentiment' | 'urgency';

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

// Update DTO - extends CreateProcessingScheduleDto with all fields optional
export class UpdateProcessingScheduleDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  emailAccountId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['DATE_RANGE', 'RECURRING', 'SPECIFIC_DATES'])
  processingType?: ProcessingType;

  @IsOptional()
  @IsDateString()
  dateRangeFrom?: string;

  @IsOptional()
  @IsDateString()
  dateRangeTo?: string;

  @IsOptional()
  @IsString()
  cronExpression?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsArray()
  specificDates?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  batchSize?: number;

  @IsOptional()
  @IsObject()
  emailTypePriorities?: Record<string, string>;

  @IsOptional()
  @IsObject()
  senderPriorities?: Record<string, string>;

  @IsOptional()
  @IsEnum(['general', 'sentiment', 'urgency'])
  llmFocus?: 'general' | 'sentiment' | 'urgency';

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

// Response type with all fields including relations
export type ProcessingScheduleWithAccount = Prisma.ProcessingScheduleGetPayload<{
  include: {
    emailAccount: {
      select: { email: true; displayName: true };
    };
  };
}>;

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

// ============================================================================
// ENHANCED API INTERFACES (from Stage 3 API endpoints document)
// ============================================================================

export interface CronJobCalendarEntry {
  configId: string;
  configName: string;
  userId: string;
  accountEmail: string;
  cronExpression: string;
  nextExecutions: Date[]; // Next 10 executions
  timezone: string;
  isEnabled: boolean;
  lastExecution?: {
    startedAt: Date;
    status: string;
    processingDuration?: number;
  };
}

// Enhanced ProcessingAnalytics with additional fields from Stage 3
export interface EnhancedProcessingAnalytics extends ProcessingAnalytics {
  successRate: number;
  processedEmailsToday: number;
  averageProcessingTime: number;
  upcomingExecutions: {
    scheduleId: string;
    scheduleName: string;
    nextExecutionAt: Date;
    accountEmail: string;
  }[];
}
