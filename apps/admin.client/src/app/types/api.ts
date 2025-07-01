// Authentication Types
export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  user?: User;
  hasActiveAccounts?: boolean;
  token?: string;
}

export interface RegisterData {
  username: string;
  password: string;
  displayName: string;
  email?: string;
}

export interface RegisterResponse {
  success: boolean;
  message?: string;
  user?: User;
}

// Account Management Types
export interface AccountData {
  email: string;
  appPassword: string;
  displayName: string;
  accountType: 'GMAIL' | 'OUTLOOK' | 'YAHOO' | 'IMAP_GENERIC';
  userId: string;
  imapHost?: string;
  imapPort?: number;
  useSSL?: boolean;
}

export interface AddAccountResponse {
  success: boolean;
  message?: string;
  account?: EmailAccount;
}

export interface ImapTestData {
  email: string;
  appPassword: string;
  imapHost?: string;
  imapPort?: number;
  useSSL?: boolean;
}

export interface ImapTestResponse {
  success: boolean;
  message?: string;
  connectionDetails?: {
    host: string;
    port: number;
    secure: boolean;
  };
}

// User and Account Types
export interface User {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  accounts?: EmailAccount[];
  createdAt?: string;
  lastLoginAt?: string;
}

export interface EmailAccount {
  id: string;
  email: string;
  displayName: string;
  accountType: 'GMAIL' | 'OUTLOOK' | 'YAHOO' | 'IMAP_GENERIC';
  isActive: boolean;
  lastSyncAt?: string;
  connectionStatus?: 'connected' | 'disconnected' | 'error';
  errorMessage?: string;
}

// Data and Search Types
export interface DataSearchRequest {
  query?: string;
  category?: string;
  priority?: string;
  sentiment?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DataSearchResponse {
  success: boolean;
  data: DataItem[];
  pagination: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
  };
  message?: string;
}

export interface DataItem {
  id: string;
  subject: string;
  sender: string;
  date: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  sentiment: 'positive' | 'negative' | 'neutral';
  content: string;
  attachments?: number;
  accountEmail: string;
  extractedData?: Record<string, any>;
}

// Generic API Response
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string>;
}

// Error Types
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: Record<string, any>;
} 