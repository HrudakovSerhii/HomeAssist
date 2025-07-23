import { useState, useCallback } from 'react';
import { ApiError } from '../types';

interface UseApiState<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
}

interface UseApiReturn<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
  execute: (...args: any[]) => Promise<T | null>;
  reset: () => void;
}

export function useApi<T = any>(
  apiFunction?: (...args: any[]) => Promise<T>
): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    loading: false,
    error: null,
    data: null,
  });

  const execute = useCallback(
    async (...args: any[]): Promise<T | null> => {
      if (!apiFunction) {
        setState((prev) => ({ ...prev, error: 'No API function provided' }));
        return null;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await apiFunction(...args);

        setState({
          loading: false,
          error: null,
          data: result,
        });
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred';

        // Handle API-specific errors
        if (error && typeof error === 'object' && 'status' in error) {
          const apiError = error as ApiError;
          setState({
            loading: false,
            error: apiError.message,
            data: null,
          });
        } else {
          setState({
            loading: false,
            error: errorMessage,
            data: null,
          });
        }
        return null;
      }
    },
    [apiFunction]
  );

  const reset = useCallback(() => {
    setState({
      loading: false,
      error: null,
      data: null,
    });
  }, []);

  return {
    loading: state.loading,
    error: state.error,
    data: state.data,
    execute,
    reset,
  };
}

// Hook for immediate API calls with proper typing
export function useApiCall<T = any>(
  apiFunction: (...args: any[]) => Promise<T>,
  immediate = false,
  ...args: any[]
): UseApiReturn<T> {
  const api = useApi<T>(apiFunction);

  // Execute immediately if requested
  useState(() => {
    if (immediate) {
      api.execute(...args);
    }
  });

  return api;
}

// Hook for mutation operations with better typing
export function useMutation<TData = any, TVariables = any>(
  mutationFunction: (variables: TVariables) => Promise<TData>
): {
  loading: boolean;
  error: string | null;
  data: TData | null;
  mutate: (variables: TVariables) => Promise<TData | null>;
  reset: () => void;
} {
  const [state, setState] = useState<UseApiState<TData>>({
    loading: false,
    error: null,
    data: null,
  });

  const mutate = useCallback(
    async (variables: TVariables): Promise<TData | null> => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await mutationFunction(variables);
        setState({
          loading: false,
          error: null,
          data: result,
        });
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred';

        setState({
          loading: false,
          error: errorMessage,
          data: null,
        });
        return null;
      }
    },
    [mutationFunction]
  );

  const reset = useCallback(() => {
    setState({
      loading: false,
      error: null,
      data: null,
    });
  }, []);

  return {
    loading: state.loading,
    error: state.error,
    data: state.data,
    mutate,
    reset,
  };
}
