// Frontend-specific API types that extend or differ from the backend API types
// For backend API types, import from '@home-assist/api-types'

/* 
REMOVED REDUNDANT TYPES (now available in @home-assist/api-types):
- LoginCredentials → Use LoginDto
- LoginResponse → Use AuthResponse  
- RegisterData → Use CreateUserDto
- RegisterResponse → Use AuthResponse
- AccountData → Use AddEmailAccountDto
- AddAccountResponse → Use AddAccountResponse
- ImapTestData → Use TestImapDto
- ImapTestResponse → Use ImapTestResponse
- User → Use User

Import these from '@home-assist/api-types' instead:
import { 
  LoginDto, 
  AuthResponse, 
  CreateUserDto, 
  AddEmailAccountDto, 
  TestImapDto, 
  ImapTestResponse,
  User,
  // ... other types
} from '@home-assist/api-types';
*/

// Extended EmailAccount with frontend-specific fields for UI state management
export interface EmailAccount {
  id: string;
  email: string;
  displayName: string;
  accountType: 'GMAIL' | 'OUTLOOK' | 'YAHOO' | 'IMAP_GENERIC';
  isActive: boolean;
  lastSyncAt?: string;
  // Frontend-specific fields for UI state
  connectionStatus?: 'connected' | 'disconnected' | 'error';
  errorMessage?: string;
}

// Legacy types - Consider removing these and using API types directly
// TODO: Evaluate if these frontend-specific search types are still needed

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

// DEPRECATED: All API responses now have consistent structure from '@home-assist/api-types'
// Use specific response types like AuthResponse, ProcessedEmailsResponse, etc. instead
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string>;
}

// DEPRECATED: Use ErrorResponse from '@home-assist/api-types' instead
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: Record<string, any>;
}
