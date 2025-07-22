export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
export const API_PREFIX = import.meta.env.VITE_API_PREFIX || 'api';
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'http://localhost:4000';

// API Endpoints - aligned with OpenAPI schema
export const API_ENDPOINTS = {
  app: {
    status: '/', // App status endpoint
  },
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    testImap: '/auth/test-imap',
    addAccount: '/auth/add-account',
    accounts: '/auth/accounts',
    // Note: logout and refresh are not implemented in backend yet
  },
  data: {
    processedEmails: '/data/processed-emails', // Fixed: was '/data/extracted'
    filterOptions: '/data/filter-options',
    updateAction: (emailId: string, actionIndex: number) =>
      `/data/emails/${emailId}/actions/${actionIndex}`,
  },
  email: {
    ingest: '/email/ingest',
    ingestUser: (userId: string) => `/email/ingest/${userId}`,
    process: (id: string) => `/email/${id}/process`,
    processBatch: '/email/process/batch',
    status: (userId: string) => `/email/status/${userId}`,
  },
  health: '/health',
  llm: {
    execute: '/llm/execute',
  },
  ws: {
    baseUrl: WS_BASE_URL,
    email: {
      ingestion: '/email-ingestion',
    },
  },
} as const;

export const APP_ENDPOINTS = {
  login: '/login',
  addAccount: '/add-account',
  dashboard: '/dashboard',
};
