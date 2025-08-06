-- Enhance processed emails with importance scoring
BEGIN;

-- Add importance scoring and reasoning
ALTER TABLE processed_emails 
  ADD COLUMN IF NOT EXISTS importance_score INTEGER DEFAULT 50 CHECK (importance_score >= 0 AND importance_score <= 100),
  ADD COLUMN IF NOT EXISTS priority_reasoning TEXT;

-- Create index for importance score
CREATE INDEX IF NOT EXISTS idx_processed_emails_importance_score ON processed_emails(importance_score DESC);

-- Add additional performance indexes
CREATE INDEX IF NOT EXISTS idx_processed_emails_received_at ON processed_emails(received_at);
CREATE INDEX IF NOT EXISTS idx_email_accounts_last_processed_at ON email_accounts(last_processed_at);

COMMIT; 