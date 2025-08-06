# Enhanced Email Processing - Database Schema

## Overview
Database design for unified email processing system with scheduling, execution tracking, and priority analysis.

## Core Tables

### Enhanced EmailAccount Table

```sql
-- Enhanced EmailAccount table  
ALTER TABLE email_accounts ADD COLUMN timezone VARCHAR(50) DEFAULT 'UTC';
ALTER TABLE email_accounts ADD COLUMN has_initial_schedule BOOLEAN DEFAULT false;
```

### Main ProcessingSchedule Table

```sql
-- Main ProcessingSchedule table (replaces separate job types)
CREATE TABLE processing_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  
  -- Schedule Identity
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- for auto-created "Initial" schedules
  
  -- Processing Type & Configuration
  processing_type VARCHAR(20) NOT NULL, -- 'DATE_RANGE' | 'RECURRING' | 'SPECIFIC_DATES'
  
  -- Date Range Processing (for historical emails)
  date_range_from TIMESTAMP,
  date_range_to TIMESTAMP,
  
  -- Recurring Processing (for daily/weekly schedules)
  cron_expression VARCHAR(50),
  timezone VARCHAR(50) DEFAULT 'UTC',
  
  -- Specific Dates Processing
  specific_dates JSONB, -- Array of ISO date strings
  
  -- Processing Preferences
  batch_size INTEGER DEFAULT 5,
  email_type_priorities JSONB DEFAULT '{}', -- { "APPOINTMENT": "HIGH", "INVOICE": "HIGH" }
  sender_priorities JSONB DEFAULT '{}', -- { "boss@company.com": "HIGH" }
  llm_focus VARCHAR(50) DEFAULT 'general', -- 'general' | 'sentiment' | 'urgency'
  
  -- Execution Tracking
  last_executed_at TIMESTAMP,
  next_execution_at TIMESTAMP,
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints & Indexes
  UNIQUE(user_id, name),
  INDEX idx_schedules_execution (next_execution_at, is_enabled),
  INDEX idx_schedules_user_account (user_id, email_account_id),
  INDEX idx_schedules_type (processing_type, is_enabled)
);
```

### Job Execution History

```sql
-- Job Execution History (for monitoring and debugging)
CREATE TABLE schedule_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES processing_schedules(id) ON DELETE CASCADE,
  
  -- Execution Details
  status VARCHAR(20) NOT NULL DEFAULT 'RUNNING', -- 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Progress Tracking
  total_batches INTEGER DEFAULT 0,
  completed_batches INTEGER DEFAULT 0,
  total_emails INTEGER DEFAULT 0,  
  processed_emails INTEGER DEFAULT 0,
  failed_emails INTEGER DEFAULT 0,
  last_processed_uid VARCHAR(255),
  
  -- Error Handling
  attempt_count INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  error_details JSONB,
  
  -- Performance Metrics
  processing_duration_ms INTEGER,
  average_email_processing_time_ms INTEGER,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_executions_schedule_status (schedule_id, status),
  INDEX idx_executions_started_at (started_at),
  INDEX idx_executions_status (status)
);
```

### Enhanced ProcessedEmails Table

```sql
-- Enhanced ProcessedEmails table
ALTER TABLE processed_emails ADD COLUMN importance_score INTEGER DEFAULT 50 CHECK (importance_score >= 0 AND importance_score <= 100);
ALTER TABLE processed_emails ADD COLUMN priority_reasoning TEXT;
ALTER TABLE processed_emails ADD COLUMN schedule_execution_id UUID REFERENCES schedule_executions(id);
```

### Cron Job Registry

```sql
-- Cron Job Registry (prevents overlapping executions)
CREATE TABLE cron_job_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_time TIMESTAMP NOT NULL,
  schedule_ids UUID[] NOT NULL, -- Array of schedule IDs executing at this time
  is_locked BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Prevent exact time conflicts
  UNIQUE(execution_time),
  INDEX idx_cron_registry_time (execution_time)
);
```

### Performance Indexes

```sql
-- Indexes for performance
CREATE INDEX idx_processed_emails_received_at ON processed_emails(received_at);
CREATE INDEX idx_processed_emails_importance_score ON processed_emails(importance_score DESC);
CREATE INDEX idx_email_accounts_last_processed_at ON email_accounts(last_processed_at);
```

## Migration Scripts

### Migration: Add Schedule Support

```sql
-- Migration: 001_add_schedule_support.sql
BEGIN;

-- Add timezone support to email accounts
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS has_initial_schedule BOOLEAN DEFAULT false;

-- Create processing schedules table
CREATE TABLE IF NOT EXISTS processing_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  processing_type VARCHAR(20) NOT NULL,
  date_range_from TIMESTAMP,
  date_range_to TIMESTAMP,
  cron_expression VARCHAR(50),
  timezone VARCHAR(50) DEFAULT 'UTC',
  specific_dates JSONB,
  batch_size INTEGER DEFAULT 5,
  email_type_priorities JSONB DEFAULT '{}',
  sender_priorities JSONB DEFAULT '{}',
  llm_focus VARCHAR(50) DEFAULT 'general',
  last_executed_at TIMESTAMP,
  next_execution_at TIMESTAMP,
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name)
);

-- Create schedule executions table
CREATE TABLE IF NOT EXISTS schedule_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES processing_schedules(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  total_batches INTEGER DEFAULT 0,
  completed_batches INTEGER DEFAULT 0,
  total_emails INTEGER DEFAULT 0,
  processed_emails INTEGER DEFAULT 0,
  failed_emails INTEGER DEFAULT 0,
  last_processed_uid VARCHAR(255),
  attempt_count INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  error_details JSONB,
  processing_duration_ms INTEGER,
  average_email_processing_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create cron job registry
CREATE TABLE IF NOT EXISTS cron_job_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_time TIMESTAMP NOT NULL UNIQUE,
  schedule_ids UUID[] NOT NULL,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
```

### Migration: Add Priority Enhancement

```sql
-- Migration: 002_add_priority_enhancement.sql
BEGIN;

-- Enhance processed emails with importance scoring
ALTER TABLE processed_emails ADD COLUMN IF NOT EXISTS importance_score INTEGER DEFAULT 50 CHECK (importance_score >= 0 AND importance_score <= 100);
ALTER TABLE processed_emails ADD COLUMN IF NOT EXISTS priority_reasoning TEXT;
ALTER TABLE processed_emails ADD COLUMN IF NOT EXISTS schedule_execution_id UUID REFERENCES schedule_executions(id);

COMMIT;
```

### Migration: Add Performance Indexes

```sql
-- Migration: 003_add_performance_indexes.sql
BEGIN;

-- Scheduling indexes
CREATE INDEX IF NOT EXISTS idx_schedules_execution ON processing_schedules(next_execution_at, is_enabled);
CREATE INDEX IF NOT EXISTS idx_schedules_user_account ON processing_schedules(user_id, email_account_id);
CREATE INDEX IF NOT EXISTS idx_schedules_type ON processing_schedules(processing_type, is_enabled);

-- Execution tracking indexes
CREATE INDEX IF NOT EXISTS idx_executions_schedule_status ON schedule_executions(schedule_id, status);
CREATE INDEX IF NOT EXISTS idx_executions_started_at ON schedule_executions(started_at);
CREATE INDEX IF NOT EXISTS idx_executions_status ON schedule_executions(status);

-- Cron registry indexes
CREATE INDEX IF NOT EXISTS idx_cron_registry_time ON cron_job_registry(execution_time);

-- Email processing indexes
CREATE INDEX IF NOT EXISTS idx_processed_emails_received_at ON processed_emails(received_at);
CREATE INDEX IF NOT EXISTS idx_processed_emails_importance_score ON processed_emails(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_email_accounts_last_processed_at ON email_accounts(last_processed_at);

COMMIT;
```

## Data Models (TypeScript)

### ProcessingSchedule Model

```typescript
interface ProcessingSchedule {
  id: string;
  userId: string;
  emailAccountId: string;
  name: string;
  description?: string;
  isEnabled: boolean;
  isDefault: boolean;
  
  // Processing Configuration
  processingType: 'DATE_RANGE' | 'RECURRING' | 'SPECIFIC_DATES';
  dateRangeFrom?: Date;
  dateRangeTo?: Date;
  cronExpression?: string;
  timezone: string;
  specificDates?: Date[];
  
  // Processing Preferences
  batchSize: number;
  emailTypePriorities: Record<EmailCategory, Priority>;
  senderPriorities: Record<string, Priority>;
  llmFocus: 'general' | 'sentiment' | 'urgency';
  
  // Execution Tracking
  lastExecutedAt?: Date;
  nextExecutionAt?: Date;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}
```

### ScheduleExecution Model

```typescript
interface ScheduleExecution {
  id: string;
  scheduleId: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  startedAt: Date;
  completedAt?: Date;
  
  // Progress Tracking
  totalBatches: number;
  completedBatches: number;
  totalEmails: number;
  processedEmails: number;
  failedEmails: number;
  lastProcessedUid?: string;
  
  // Error Handling
  attemptCount: number;
  maxAttempts: number;
  errorMessage?: string;
  errorDetails?: any;
  
  // Performance Metrics
  processingDurationMs?: number;
  averageEmailProcessingTimeMs?: number;
  
  createdAt: Date;
}
```

### CronJobRegistry Model

```typescript
interface CronJobRegistry {
  id: string;
  executionTime: Date;
  scheduleIds: string[];
  isLocked: boolean;
  createdAt: Date;
}
```

## Database Utilities

### Schedule Query Helpers

```typescript
// Find schedules ready for execution
const findSchedulesReadyForExecution = async (now: Date) => {
  return prisma.processingSchedule.findMany({
    where: {
      isEnabled: true,
      nextExecutionAt: {
        lte: now
      }
    },
    include: {
      emailAccount: true
    }
  });
};

// Get schedule execution history
const getScheduleExecutionHistory = async (scheduleId: string, limit = 10) => {
  return prisma.scheduleExecution.findMany({
    where: { scheduleId },
    orderBy: { startedAt: 'desc' },
    take: limit
  });
};

// Check for execution conflicts
const checkExecutionTimeConflicts = async (executionTime: Date) => {
  return prisma.cronJobRegistry.findUnique({
    where: { executionTime }
  });
};
```

---

**Result**: Complete database schema supporting unified email processing with scheduling, execution tracking, priority enhancement, and conflict prevention. 