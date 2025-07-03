export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
export const API_PREFIX = import.meta.env.VITE_API_PREFIX || 'api';

// API Endpoints - aligned with OpenAPI schema
export const API_ENDPOINTS = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    testImap: '/auth/test-imap',
    addAccount: '/auth/add-account',
    // Note: logout and refresh are not implemented in backend yet
  },
  data: {
    extracted: '/data/extracted',
    filterOptions: '/data/filter-options',
    updateAction: (emailId: string, actionIndex: number) => 
      `/data/emails/${emailId}/actions/${actionIndex}`,
  },
  health: '/health',
  llm: {
    execute: '/llm/execute',
  },
} as const;
