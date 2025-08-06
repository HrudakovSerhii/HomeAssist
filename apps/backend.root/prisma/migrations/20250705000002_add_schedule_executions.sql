-- Create schedule executions table
BEGIN;

CREATE TYPE "ExecutionStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE IF NOT EXISTS schedule_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES processing_schedules(id) ON DELETE CASCADE,
  
  -- Execution Details
  status "ExecutionStatus" NOT NULL DEFAULT 'RUNNING',
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
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_executions_schedule_status ON schedule_executions(schedule_id, status);
CREATE INDEX idx_executions_started_at ON schedule_executions(started_at);
CREATE INDEX idx_executions_status ON schedule_executions(status);

-- Add reference to schedule executions in processed_emails
ALTER TABLE processed_emails ADD COLUMN IF NOT EXISTS schedule_execution_id UUID REFERENCES schedule_executions(id);

COMMIT; 