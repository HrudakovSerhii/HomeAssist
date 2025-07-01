// Re-export API types
export type { 
  User, 
  EmailAccount, 
  DataItem,
  LoginCredentials,
  LoginResponse,
  RegisterData,
  RegisterResponse,
  AccountData,
  AddAccountResponse,
  ImapTestData,
  ImapTestResponse,
  DataSearchRequest,
  DataSearchResponse,
  ApiResponse,
  ApiError
} from './api';

export interface FilterOptions {
  search: string;
  category: string;
  priority: string;
  sentiment: string;
  dateRange: {
    from: string;
    to: string;
  };
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
}

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
} 