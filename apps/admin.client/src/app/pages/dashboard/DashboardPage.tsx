import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, useApi, useEmailIngestion } from '../../hooks';

import {
  PageContainer,
  AlertMessage,
  EmailIngestionProgressView,
} from '../../components';

import { dataService, authService } from '../../services';
import { DashboardFilterOptions } from '../../../../constants';
import { API_ENDPOINTS } from '../../../configuration';

import {
  DashboardHeader,
  DashboardAccountsInfo,
  DashboardFilters,
  DashboardTable,
  DashboardPagination,
  DashboardEmptyState,
  DashboardLoadingState,
} from './components';

import type { EmailData, FilterState } from '../../types';
import type {
  ExtractedDataResponse,
  UserAccountsResponse,
} from '@home-assist/api-types';

const initialFilters: FilterState = {
  search: '',
  category: '',
  priority: '',
  sentiment: '',
  minConfidence: '',
  entityType: '',
  actionType: '',
  dateFrom: '',
  dateTo: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  limit: 10,
};

const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  // State management
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [emailData, setEmailData] = useState<EmailData[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // API hooks
  const fetchDataApi = useApi<ExtractedDataResponse>(
    dataService.getExtractedEmailData
  );
  const updateActionApi = useApi<boolean>(dataService.updateActionItem);
  const fetchAccountsApi = useApi<UserAccountsResponse>(
    authService.getAccounts
  );

  // Email ingestion hook
  const {
    isIngesting,
    error: ingestionError,
    progress: ingestionProgress,
    startIngestion,
    clearError: clearIngestionError,
    clearProgress: clearIngestionProgress,
  } = useEmailIngestion({
    limit: 5,
    folder: 'INBOX',
    onSuccess: () => {
      fetchData();
    },
    onError: (errorMessage) => {
      setError(errorMessage);
    },
  });

  // Convert FilterState to API params
  const getApiParams = useCallback(() => {
    return {
      search: filters.search || undefined,
      category: filters.category || undefined,
      priority: filters.priority || undefined,
      sentiment: filters.sentiment || undefined,
      minConfidence: filters.minConfidence
        ? parseFloat(filters.minConfidence)
        : undefined,
      entityType: filters.entityType || undefined,
      actionType: filters.actionType || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      page: currentPage,
      limit: filters.limit,
    };
  }, [filters, currentPage]);

  // Fetch dashboard data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params = getApiParams();
      const response = await fetchDataApi.execute(params);

      if (response) {
        setEmailData(response.data);
        setTotalItems(response.pagination.total);
        setTotalPages(response.pagination.totalPages);
      }
    } catch (err) {
      setError('Failed to load dashboard data. Please try again.');
      console.error('Dashboard data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [getApiParams, fetchDataApi.execute]);

  // Effects
  useEffect(() => {
    if (user && !fetchAccountsApi.data) {
      fetchAccountsApi.execute(user.id).finally();
    }
  }, [user]);

  useEffect(() => {
    if (
      !fetchAccountsApi.loading &&
      fetchAccountsApi.data &&
      fetchAccountsApi.data.data.length > 0
    ) {
      fetchData();
    }
  }, [fetchAccountsApi.loading, fetchData]);

  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    } else {
      // fetchData();
    }
  }, [filters]);

  useEffect(() => {
    if (currentPage !== 1) {
      // fetchData();
    }
  }, [currentPage, fetchData]);

  // Event handlers
  const handleFilterChange = (
    field: keyof FilterState,
    value: string | number
  ) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleClearFilters = () => {
    setFilters(initialFilters);
    setCurrentPage(1);
  };

  const toggleRowExpansion = (id: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleActionToggle = async (
    emailId: string,
    actionIndex: number,
    isCompleted: boolean
  ) => {
    try {
      await updateActionApi.execute(emailId, actionIndex, isCompleted);

      setEmailData((prev) =>
        prev.map((email) => {
          if (email.id === emailId && email.actionItems) {
            const updatedActionItems = [...email.actionItems];
            updatedActionItems[actionIndex] = {
              ...updatedActionItems[actionIndex],
              isCompleted,
            };
            return { ...email, actionItems: updatedActionItems };
          }
          return email;
        })
      );
    } catch (err) {
      setError('Failed to update action item. Please try again.');
      console.error('Action update error:', err);
    }
  };

  const handleCloseProgress = useCallback(() => {
    clearIngestionProgress();
    clearIngestionError();
  }, [clearIngestionProgress, clearIngestionError]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Early returns for loading and empty states
  if (!user) {
    return (
      <PageContainer>
        <DashboardLoadingState />
      </PageContainer>
    );
  }

  if (fetchAccountsApi.loading) {
    return (
      <PageContainer>
        <DashboardLoadingState />
      </PageContainer>
    );
  }

  const userAccounts = fetchAccountsApi.data?.data || [];

  if (userAccounts.length === 0) {
    return (
      <PageContainer>
        <DashboardEmptyState addAccountPath={API_ENDPOINTS.auth.addAccount} />
      </PageContainer>
    );
  }
  console.log(ingestionError);
  return (
    <PageContainer>
      <div className="space-y-6">
        <DashboardHeader
          user={user}
          isIngesting={isIngesting}
          onIngestEmails={startIngestion}
          addAccountPath={API_ENDPOINTS.auth.addAccount}
        />

        <DashboardAccountsInfo accounts={userAccounts} />

        {/* Error Messages */}
        {error && (
          <AlertMessage
            type="error"
            message={error}
            show={true}
            onClose={() => setError('')}
          />
        )}
        {ingestionError && (
          <AlertMessage
            type="error"
            message={ingestionError}
            show={true}
            onClose={clearIngestionError}
          />
        )}

        <DashboardFilters
          filters={filters}
          loading={loading}
          totalItems={totalItems}
          emailDataLength={emailData.length}
          onFilterChange={handleFilterChange}
          onClearFilters={handleClearFilters}
          filterOptions={DashboardFilterOptions}
        />

        <DashboardTable
          emailData={emailData}
          loading={loading}
          expandedRows={expandedRows}
          filters={filters}
          onToggleRowExpansion={toggleRowExpansion}
          onActionToggle={handleActionToggle}
          updateActionLoading={updateActionApi.loading}
        />

        {!loading && emailData.length > 0 && (
          <DashboardPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            loading={loading}
            onPageChange={handlePageChange}
          />
        )}

        <EmailIngestionProgressView
          isOpen={!!ingestionProgress}
          onClose={handleCloseProgress}
          progress={ingestionProgress}
        />
      </div>
    </PageContainer>
  );
};

export default DashboardPage;
