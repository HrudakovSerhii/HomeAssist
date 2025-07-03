// Re-export API types
export type {
  EmailAccount,
  DataItem,
  DataSearchRequest,
  DataSearchResponse,
  ApiResponse,
  ApiError,
} from './api';

export * from './dashboard';

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
