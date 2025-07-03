import { apiClient } from './apiClient';
import { FilterState, EmailData, DataResponse } from '../types';
import type { FilterOptions } from '../types/dashboard';
import { DashboardFilterOptions } from '../../../constants';

export interface DashboardDataParams {
  search?: string;
  category?: string;
  priority?: string;
  sentiment?: string;
  minConfidence?: number;
  entityType?: string;
  actionType?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

class DataService {
  /**
   * Fetch extracted email data with filters and pagination
   */
  async getExtractedEmailData(
    params: DashboardDataParams
  ): Promise<DataResponse> {
    try {
      const queryParams = new URLSearchParams();

      // Add non-empty parameters to query string
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const response = await apiClient.get<DataResponse>(
        `/data/extracted?${queryParams.toString()}`
      );

      return response;
    } catch (error) {
      console.error('Error fetching extracted email data:', error);
      // Return empty data structure on error
      return {
        data: [],
        pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
      };
    }
  }

  /**
   * Get filter options (categories, priorities, etc.)
   */
  async getFilterOptions(): Promise<FilterOptions> {
    try {
      const response = await apiClient.get<FilterOptions>(
        '/data/filter-options'
      );
      return response;
    } catch (error) {
      console.error('Error fetching filter options:', error);
      // Return default options from constants on error
      return {
        categories: DashboardFilterOptions.categories.map(
          (option) => option.value
        ),
        priorities: DashboardFilterOptions.priorities.map(
          (option) => option.value
        ),
        sentiments: DashboardFilterOptions.sentiments.map(
          (option) => option.value
        ),
        entityTypes: DashboardFilterOptions.entityTypes.map(
          (option) => option.value
        ),
        actionTypes: DashboardFilterOptions.actionTypes.map(
          (option) => option.value
        ),
      };
    }
  }

  /**
   * Update action item completion status
   */
  async updateActionItem(
    emailId: string,
    actionIndex: number,
    isCompleted: boolean
  ): Promise<boolean> {
    try {
      await apiClient.patch(`/data/emails/${emailId}/actions/${actionIndex}`, {
        isCompleted,
      });
      return true;
    } catch (error) {
      console.error('Error updating action item:', error);
      throw error;
    }
  }

  /**
   * Export data with current filters
   */
  async exportData(
    params: DashboardDataParams,
    format: 'csv' | 'json' = 'csv'
  ): Promise<Blob> {
    try {
      const queryParams = new URLSearchParams();

      // Add non-empty parameters to query string
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      queryParams.append('format', format);

      const response = await fetch(
        `/api/data/export?${queryParams.toString()}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Export failed');
      }

      return await response.blob();
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<{
    totalEmails: number;
    totalActions: number;
    completedActions: number;
    avgConfidence: number;
    categoryCounts: Record<string, number>;
    priorityCounts: Record<string, number>;
  }> {
    try {
      const response = await apiClient.get<{
        totalEmails: number;
        totalActions: number;
        completedActions: number;
        avgConfidence: number;
        categoryCounts: Record<string, number>;
        priorityCounts: Record<string, number>;
      }>('/data/stats');

      return response;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      return {
        totalEmails: 0,
        totalActions: 0,
        completedActions: 0,
        avgConfidence: 0,
        categoryCounts: {},
        priorityCounts: {},
      };
    }
  }
}

export const dataService = new DataService();
