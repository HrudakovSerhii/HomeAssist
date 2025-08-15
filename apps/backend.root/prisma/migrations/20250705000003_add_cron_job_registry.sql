-- Create cron job registry table
BEGIN;

CREATE TABLE IF NOT EXISTS cron_job_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_time TIMESTAMP NOT NULL,
  schedule_ids UUID[] NOT NULL, -- Array of schedule IDs executing at this time
  is_locked BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Prevent exact time conflicts
  UNIQUE(execution_time)
);

-- Create index for performance
CREATE INDEX idx_cron_registry_time ON cron_job_registry(execution_time);

COMMIT; 