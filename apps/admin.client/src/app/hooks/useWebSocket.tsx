import { useEffect, useCallback, useState, useRef } from 'react';

import { API_ENDPOINTS } from '../../configuration';

export interface WebSocketMessage<T = any> {
  type: string;
  data: T;
}

interface UseWebSocketOptions {
  onMessage?: (data: any) => void;
  onError?: (error: Event) => void;
  onClose?: () => void;
  autoReconnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  error: string | null;
  sendMessage: (data: any) => void;
  disconnect: () => void;
}

export function useWebSocket(
  path: string,
  {
    onMessage,
    onError,
    onClose,
    autoReconnect = true,
    reconnectAttempts = 3,
    reconnectInterval = 5000,
  }: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | undefined>(undefined);
  const reconnectCount = useRef<number>(0);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    if (reconnectTimer.current !== undefined) {
      window.clearTimeout(reconnectTimer.current);
      reconnectTimer.current = undefined;
    }
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    cleanup();

    try {
      const wsUrl = `${API_ENDPOINTS.ws.baseUrl}${path}`;
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setIsConnected(true);
        setError(null);
        reconnectCount.current = 0;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage?.(data);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      socket.onerror = (event) => {
        setError('WebSocket connection error');
        onError?.(event);
      };

      socket.onclose = () => {
        setIsConnected(false);
        onClose?.();

        if (autoReconnect && reconnectCount.current < reconnectAttempts) {
          reconnectTimer.current = window.setTimeout(() => {
            reconnectCount.current += 1;
            connect();
          }, reconnectInterval);
        }
      };

      ws.current = socket;
    } catch (err) {
      setError('Failed to establish WebSocket connection');
      console.error('WebSocket connection error:', err);
    }
  }, [
    path,
    onMessage,
    onError,
    onClose,
    autoReconnect,
    reconnectAttempts,
    reconnectInterval,
    cleanup,
  ]);

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  const sendMessage = useCallback(
    (data: any) => {
      if (ws.current && isConnected) {
        ws.current.send(JSON.stringify(data));
      } else {
        console.warn('WebSocket is not connected');
      }
    },
    [isConnected]
  );

  const disconnect = useCallback(() => {
    cleanup();
  }, [cleanup]);

  return {
    isConnected,
    error,
    sendMessage,
    disconnect,
  };
} 