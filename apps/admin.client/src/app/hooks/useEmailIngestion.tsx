import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useWebSocket } from './useWebSocket';
import { apiClient } from '../services';
import { API_ENDPOINTS } from '../../configuration';

import type { EmailIngestionProgress } from '@home-assist/api-types';

export interface EmailIngestionOptions {
  // Optional user override - if not provided, uses useAuth internally
  user?: { id: string };
  // Ingestion API parameters
  limit?: number;
  folder?: string;
  // WebSocket configuration
  enableWebSocket?: boolean;
  websocketPath?: string;
  // Connection strategy
  connectOnMount?: boolean; // New option to control when to connect
  // Callbacks
  onSuccess?: () => void;
  onError?: (error: string) => void;
  onProgress?: (progress: EmailIngestionProgress) => void;
}

export interface EmailIngestionReturn {
  // State
  isIngesting: boolean;
  error: string | null;
  progress: EmailIngestionProgress | null;
  // WebSocket state (if enabled)
  isConnected: boolean;
  // Actions
  startIngestion: () => Promise<void>;
  stopIngestion: () => void;
  clearError: () => void;
  clearProgress: () => void;
  // WebSocket connection control
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
  // For manual WebSocket operations
  sendMessage?: (data: any) => void;
}

export function useEmailIngestion(
  options: EmailIngestionOptions = {}
): EmailIngestionReturn {
  const {
    user: userOverride,
    limit = 5,
    folder = 'INBOX',
    enableWebSocket = true,
    websocketPath = API_ENDPOINTS.ws.email.ingestion,
    connectOnMount = false, // Default to false for lazy connection
    onSuccess,
    onError,
    onProgress,
  } = options;

  // Get user from auth context if not provided
  const { user: authUser } = useAuth();
  const user = userOverride || authUser;

  // Local state management
  const [isIngesting, setIsIngesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<EmailIngestionProgress | null>(null);
  const [shouldConnect, setShouldConnect] = useState(connectOnMount);

  // WebSocket connection (conditionally enabled based on shouldConnect)
  const { isConnected, sendMessage, disconnect: wsDisconnect, connect: wsConnect } = useWebSocket(
    websocketPath,
    {
      onMessage: (data) => {
        const progressData: EmailIngestionProgress = data;
        setProgress(progressData);
        onProgress?.(progressData);

        if (progressData.stage === 'COMPLETED') {
          setIsIngesting(false);
          onSuccess?.();
        } else if (progressData.stage === 'FAILED') {
          setIsIngesting(false);
          const errorMessage = progressData.error || 'Email ingestion failed';
          setError(errorMessage);
          onError?.(errorMessage);
        }
      },
      onError: () => {
        const errorMessage = 'Lost connection to server. Please try again.';
        setError(errorMessage);
        setIsIngesting(false);
        onError?.(errorMessage);
      },
      onClose: () => {
        // Reset connection state when WebSocket closes
        setShouldConnect(false);
      },
      // Only connect when shouldConnect is true
      autoConnect: enableWebSocket && shouldConnect,
    }
  );

  const connectWebSocket = useCallback(() => {
    if (enableWebSocket && !isConnected) {
      setShouldConnect(true);
      wsConnect();
    }
  }, [enableWebSocket, isConnected, wsConnect]);

  const disconnectWebSocket = useCallback(() => {
    if (shouldConnect) {
      setShouldConnect(false);
      wsDisconnect();
    }
  }, [shouldConnect, wsDisconnect]);

  const startIngestion = useCallback(async () => {
    if (!user) {
      const errorMessage = 'User not authenticated';
      setError(errorMessage);
      onError?.(errorMessage);
      return;
    }

    try {
      setError(null);
      setIsIngesting(true);
      
      // Connect WebSocket before starting ingestion if enabled
      if (enableWebSocket && !isConnected) {
        connectWebSocket();
      }
      
      // Set initial progress state
      const initialProgress: EmailIngestionProgress = {
        stage: 'CONNECTING',
        emailAccountId: user.id,
        progress: 0,
        completedSteps: {
          fetched: false,
          stored: false,
          processed: false,
        },
      };
      
      setProgress(initialProgress);
      onProgress?.(initialProgress);

      // Wait a bit for WebSocket to connect if needed
      if (enableWebSocket && !isConnected) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Send initial message to WebSocket if connected and enabled
      if (enableWebSocket && isConnected && sendMessage) {
        sendMessage(user.id);
      }

      // Start the ingestion process
      await apiClient.post(API_ENDPOINTS.email.ingest, {
        userId: user.id,
        limit,
        folder,
      });

      // If WebSocket is disabled, we assume success immediately
      if (!enableWebSocket) {
        setIsIngesting(false);
        onSuccess?.();
      }
    } catch (apiError) {
      console.error('Failed to ingest emails:', apiError);
      const errorMessage = 'Failed to ingest emails. Please try again.';
      setError(errorMessage);
      setIsIngesting(false);
      setProgress(null);
      onError?.(errorMessage);
    }
  }, [user, limit, folder, enableWebSocket, isConnected, connectWebSocket, sendMessage, onSuccess, onError, onProgress]);

  const stopIngestion = useCallback(() => {
    setIsIngesting(false);
    setProgress(null);
    setError(null);
    // Optionally disconnect WebSocket when stopping
    if (enableWebSocket) {
      disconnectWebSocket();
    }
  }, [enableWebSocket, disconnectWebSocket]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearProgress = useCallback(() => {
    setProgress(null);
  }, []);

  return {
    // State
    isIngesting,
    error,
    progress,
    isConnected: enableWebSocket ? isConnected : false,
    // Actions
    startIngestion,
    stopIngestion,
    clearError,
    clearProgress,
    // WebSocket connection control
    connectWebSocket,
    disconnectWebSocket,
    // WebSocket actions (only if enabled)
    sendMessage: enableWebSocket ? sendMessage : undefined,
  };
} 