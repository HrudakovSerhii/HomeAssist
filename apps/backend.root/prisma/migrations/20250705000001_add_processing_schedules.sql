-- Create processing schedules table
BEGIN;

CREATE TYPE "ProcessingType" AS ENUM ('DATE_RANGE', 'RECURRING', 'SPECIFIC_DATES');
CREATE TYPE "LlmFocus" AS ENUM ('general', 'sentiment', 'urgency');

CREATE TABLE IF NOT EXISTS processing_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  
  -- Schedule Identity
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  
  -- Processing Type & Configuration
  processing_type "ProcessingType" NOT NULL,
  date_range_from TIMESTAMP,
  date_range_to TIMESTAMP,
  cron_expression VARCHAR(50),
  timezone VARCHAR(50) DEFAULT 'UTC',
  specific_dates JSONB,
  
  -- Processing Preferences
  batch_size INTEGER DEFAULT 5,
  email_type_priorities JSONB DEFAULT '{}',
  sender_priorities JSONB DEFAULT '{}',
  llm_focus "LlmFocus" DEFAULT 'general',
  
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
  UNIQUE(user_id, name)
);

-- Create indexes for performance
CREATE INDEX idx_schedules_execution ON processing_schedules(next_execution_at, is_enabled);
CREATE INDEX idx_schedules_user_account ON processing_schedules(user_id, email_account_id);
CREATE INDEX idx_schedules_type ON processing_schedules(processing_type, is_enabled);

COMMIT; 