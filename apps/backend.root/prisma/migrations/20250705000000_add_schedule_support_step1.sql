-- Add timezone support to email accounts
BEGIN;

ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS has_initial_schedule BOOLEAN DEFAULT false;

COMMIT; 