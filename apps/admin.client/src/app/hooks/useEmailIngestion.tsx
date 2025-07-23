import { useCallback } from 'react';
import { useAuth } from './useAuth';
import { useApi } from './useApi';
import { apiClient } from '../services';
import { API_ENDPOINTS } from '../../configuration';

export interface EmailIngestionOptions {
  // Optional user override - if not provided, uses useAuth internally
  user?: { id: string };
  // Ingestion API parameters
  limit?: number;
  folder?: string;
  // Callbacks
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export interface EmailIngestionReturn {
  // State from useApi
  isIngesting: boolean;
  error: string | null;
  data: any;
  // Actions
  startIngestion: () => Promise<void>;
  clearError: () => void;
}

export function useEmailIngestion(
  options: EmailIngestionOptions = {}
): EmailIngestionReturn {
  const {
    user: userOverride,
    limit = 5,
    folder = 'INBOX',
    onSuccess,
    onError,
  } = options;

  // Get user from auth context if not provided
  const { user: authUser } = useAuth();
  const user = userOverride || authUser;

  // Create the API function for email ingestion
  const ingestEmailsApi = useCallback(async () => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('Executing email ingestion API call for user:', user.id);

    const response = await apiClient.post(API_ENDPOINTS.email.ingest, {
      userId: user.id,
      limit,
      folder,
    });

    console.log('Email ingestion API call completed');
    return response;
  }, [user, limit, folder]);

  // Use the useApi hook for state management
  const { loading, error, data, execute, reset } = useApi(ingestEmailsApi);

  const startIngestion = useCallback(async () => {
    try {
      await execute();
      onSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to ingest emails. Please try again.';
      onError?.(errorMessage);
    }
  }, [execute, onSuccess, onError]);

  const clearError = useCallback(() => {
    reset();
  }, [reset]);

  return {
    // State
    isIngesting: loading,
    error,
    data,
    // Actions
    startIngestion,
    clearError,
  };
}
