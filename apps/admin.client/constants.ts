// Filter Options Constants
export const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'bills', label: 'Bills' },
  { value: 'receipts', label: 'Receipts' },
  { value: 'invoices', label: 'Invoices' },
  { value: 'statements', label: 'Statements' },
  { value: 'contracts', label: 'Contracts' },
  { value: 'other', label: 'Other' },
] as const;

export const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
] as const;

export const SENTIMENT_OPTIONS = [
  { value: '', label: 'All Sentiments' },
  { value: 'positive', label: 'Positive' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'negative', label: 'Negative' },
] as const;

// Pagination Constants
export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

// Application Constants
export const APP_NAME = 'HomeAI Assist';
export const COPYRIGHT_TEXT = '© 2025 HomeAIAssist. All rights reserved.';

// Account Type Constants
export const ACCOUNT_TYPES = {
  GMAIL: 'GMAIL',
  OUTLOOK: 'OUTLOOK',
  YAHOO: 'YAHOO',
  IMAP_GENERIC: 'IMAP_GENERIC',
} as const;

export const ACCOUNT_TYPE_OPTIONS = [
  { value: ACCOUNT_TYPES.GMAIL, label: 'Gmail' },
  { value: ACCOUNT_TYPES.OUTLOOK, label: 'Outlook' },
  { value: ACCOUNT_TYPES.YAHOO, label: 'Yahoo' },
  { value: ACCOUNT_TYPES.IMAP_GENERIC, label: 'Other IMAP' },
] as const;

// Form Validation Constants
export const VALIDATION = {
  email: {
    required: 'Email is required',
    invalid: 'Please enter a valid email address',
  },
  password: {
    required: 'Password is required',
    minLength: 'Password must be at least 8 characters',
    pattern:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  },
  required: 'This field is required',
} as const;
