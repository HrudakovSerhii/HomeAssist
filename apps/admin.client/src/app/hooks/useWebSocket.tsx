import { useEffect, useCallback, useState } from 'react';

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
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  const connect = useCallback(() => {
    try {
      const wsUrl = `${API_ENDPOINTS.ws.baseUrl}${path}`;
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setIsConnected(true);
        setError(null);
        setReconnectCount(0);
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

        if (autoReconnect && reconnectCount < reconnectAttempts) {
          setTimeout(() => {
            setReconnectCount((prev) => prev + 1);
            connect();
          }, reconnectInterval);
        }
      };

      setWs(socket);
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
    reconnectCount,
  ]);

  useEffect(() => {
    connect();
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback(
    (data: any) => {
      if (ws && isConnected) {
        ws.send(JSON.stringify(data));
      } else {
        console.warn('WebSocket is not connected');
      }
    },
    [ws, isConnected]
  );

  const disconnect = useCallback(() => {
    if (ws) {
      ws.close();
    }
  }, [ws]);

  return {
    isConnected,
    error,
    sendMessage,
    disconnect,
  };
} 