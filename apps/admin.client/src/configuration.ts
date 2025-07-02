export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
export const API_PREFIX = import.meta.env.VITE_API_PREFIX || 'api';

// API Endpoints (to be used later)
export const API_ENDPOINTS = {
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    logout: '/auth/logout',
    refresh: '/auth/refresh',
    testImap: '/auth/test-imap',
    addAccount: '/auth/add-account',
  },
  accounts: {
    list: '/accounts',
    test: '/accounts/test',
    delete: (id: string) => `/accounts/${id}`,
  },
  data: {
    list: '/data',
    search: '/data/search',
    export: '/data/export',
  },
} as const;
