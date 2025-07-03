import { apiClient } from './apiClient';
import { API_ENDPOINTS } from '../../configuration';
import {
  ExtractedDataQueryDto,
  ExtractedDataResponse,
  FilterOptions,
  UpdateActionItemDto,
} from '@home-assist/api-types';

import { DashboardFilterOptions } from '../../../constants';

class DataService {
  /**
   * Fetch extracted email data with filters and pagination
   */
  async getExtractedEmailData(
    params: ExtractedDataQueryDto
  ): Promise<ExtractedDataResponse> {
    try {
      const queryParams = new URLSearchParams();

      // Add non-empty parameters to query string
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const endpoint = queryParams.toString()
        ? `${API_ENDPOINTS.data.extracted}?${queryParams.toString()}`
        : API_ENDPOINTS.data.extracted;

      return await apiClient.get<ExtractedDataResponse>(endpoint);
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
      return await apiClient.get<FilterOptions>(
        API_ENDPOINTS.data.filterOptions
      );
    } catch (error) {
      console.error('Error fetching filter options:', error);
      // Return default options from constants on error
      return {
        categories: DashboardFilterOptions.categories.map(
          (option) => option.value
        ) as FilterOptions['categories'],
        priorities: DashboardFilterOptions.priorities.map(
          (option) => option.value
        ) as FilterOptions['priorities'],
        sentiments: DashboardFilterOptions.sentiments.map(
          (option) => option.value
        ) as FilterOptions['sentiments'],
        entityTypes: DashboardFilterOptions.entityTypes.map(
          (option) => option.value
        ) as FilterOptions['entityTypes'],
        actionTypes: DashboardFilterOptions.actionTypes.map(
          (option) => option.value
        ) as FilterOptions['actionTypes'],
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
      const updateData: UpdateActionItemDto = { isCompleted };
      const endpoint = API_ENDPOINTS.data.updateAction(emailId, actionIndex);

      await apiClient.patch(endpoint, updateData);
      return true;
    } catch (error) {
      console.error('Error updating action item:', error);
      throw error;
    }
  }

  /**
   * Export data with current filters
   * Note: Export endpoint not implemented in backend yet
   */
  async exportData(
    params: ExtractedDataQueryDto,
    format: 'csv' | 'json' = 'csv'
  ): Promise<Blob> {
    try {
      // Note: Export functionality not implemented in backend yet
      throw new Error('Export functionality not implemented in backend yet');
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  /**
   * Get dashboard statistics
   * Note: Stats endpoint not implemented in backend yet
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
      // Note: Stats functionality not implemented in backend yet
      throw new Error('Dashboard stats not implemented in backend yet');
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
