export interface FilterState {
  search: string;
  category: string;
  priority: string;
  sentiment: string;
  minConfidence: string;
  entityType: string;
  actionType: string;
  dateFrom: string;
  dateTo: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  limit: number;
}

export interface EmailData {
  id: string;
  subject: string;
  fromAddress: string;
  category: string;
  priority: string;
  sentiment: string;
  confidence: number;
  summary: string;
  createdAt: string;
  entities?: Array<{
    entityType: string;
    entityValue: string;
    confidence: number;
  }>;
  actionItems?: Array<{
    actionType: string;
    description: string;
    priority: string;
    isCompleted: boolean;
  }>;
}

export interface DataResponse {
  data: EmailData[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface FilterOptions {
  categories: string[];
  priorities: string[];
  sentiments: string[];
  entityTypes: string[];
  actionTypes: string[];
}
