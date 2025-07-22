export const DASHBOARD_COLUMNS = [
  'Email',
  'Category',
  'Priority',
  'Sentiment',
  'Confidence',
  'Date',
  'Actions',
];

export const PRIORITY_COLORS = {
  urgent: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-gray-100 text-gray-800',
  default: 'bg-gray-100 text-gray-800',
} as const;

export const SENTIMENT_COLORS = {
  positive: 'bg-green-100 text-green-800',
  negative: 'bg-red-100 text-red-800',
  neutral: 'bg-blue-100 text-blue-800',
  default: 'bg-gray-100 text-gray-800',
} as const;

export const CATEGORY_COLORS = {
  Work: 'bg-purple-100 text-purple-800',
  Personal: 'bg-indigo-100 text-indigo-800',
  Finance: 'bg-emerald-100 text-emerald-800',
  default: 'bg-gray-100 text-gray-800',
} as const;

export const DASHBOARD_MESSAGES = {
  noAccountsTitle: 'No Email Accounts Found',
  noAccountsDescription: 'You need to add at least one email account to view your dashboard.',
  noAccountsButton: 'Add Your First Account',
  noEmailsTitle: 'No emails found',
  noEmailsFiltered: 'Try adjusting your filters to see more results',
  noEmailsAvailable: 'No processed emails are available yet',
  loadingAccounts: 'Loading your email accounts...',
  ingestEmails: 'Ingest Emails',
  addAccount: 'Add Account',
  clearFilters: 'Clear Filters',
  expandRow: '▼ Expand',
  collapseRow: '▲ Collapse',
  previous: 'Previous',
  next: 'Next',
} as const;

export const DASHBOARD_PLACEHOLDERS = {
  search: 'Search subjects, summaries...',
} as const;

export const DASHBOARD_LABELS = {
  filtersTitle: 'Filters',
  summaryTitle: 'Summary',
  entitiesTitle: 'Entities',
  actionItemsTitle: 'Action Items',
  dashboardTitle: 'Email Dashboard',
  dashboardSubtitle: 'Processed email insights and analytics',
} as const;

export const PAGINATION_CONFIG = {
  maxVisiblePages: 5,
  defaultPageSize: 10,
} as const;

export const EMPTY_STATE_EMOJI = '📭';

export const ACCOUNT_STATUS_COLORS = {
  active: 'bg-green-500',
  inactive: 'bg-red-500',
} as const;
