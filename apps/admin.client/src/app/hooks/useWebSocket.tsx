import { useEffect, useCallback, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

import { API_ENDPOINTS } from '../../configuration';

export interface WebSocketMessage<T = any> {
  type: string;
  data: T;
}

interface UseWebSocketOptions {
  onMessage?: (data: any) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
  autoReconnect?: boolean;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  error: string | null;
  sendMessage: (data: any) => void;
  disconnect: () => void;
  connect: () => void;
}

export function useWebSocket(
  path: string,
  {
    onMessage,
    onError,
    onClose,
    autoReconnect = true,
    autoConnect = true,
    reconnectAttempts = 3,
    reconnectInterval = 5000,
  }: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const socket = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanup = useCallback(() => {
    if (socket.current) {
      socket.current.disconnect();
      socket.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    cleanup();

    try {
      // Remove leading slash from path if present for namespace
      const namespace = path.startsWith('/') ? path.slice(1) : path;
      
      // Create Socket.IO connection
      const socketInstance = io(`${API_ENDPOINTS.ws.baseUrl}/${namespace}`, {
        autoConnect: autoConnect,
        reconnection: autoReconnect,
        reconnectionAttempts: reconnectAttempts,
        reconnectionDelay: reconnectInterval,
        transports: ['websocket', 'polling'],
      });

      socketInstance.on('connect', () => {
        setIsConnected(true);
        setError(null);
      });

      socketInstance.on('disconnect', () => {
        setIsConnected(false);
        onClose?.();
      });

      socketInstance.on('connect_error', (err) => {
        setError('Socket.IO connection error');
        onError?.(err);
      });

      // Listen for progress messages (specific to email ingestion)
      socketInstance.on('progress', (data) => {
        onMessage?.(data);
      });

      // Listen for any other messages
      socketInstance.on('message', (data) => {
        onMessage?.(data);
      });

      socket.current = socketInstance;
    } catch (err) {
      setError('Failed to establish Socket.IO connection');
      console.error('Socket.IO connection error:', err);
    }
  }, [
    path,
    onMessage,
    onError,
    onClose,
    autoReconnect,
    autoConnect,
    reconnectAttempts,
    reconnectInterval,
    cleanup,
  ]);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return cleanup;
  }, [autoConnect, connect, cleanup]);

  const sendMessage = useCallback(
    (data: any) => {
      if (socket.current && isConnected) {
        // Send register message for email ingestion
        socket.current.emit('register', data);
      } else {
        console.warn('Socket.IO is not connected');
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
    connect,
  };
} 