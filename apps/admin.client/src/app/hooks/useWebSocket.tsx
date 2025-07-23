import { useEffect, useCallback, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

import { API_ENDPOINTS } from '../../configuration';

interface UseWebSocketOptions {
  onMessage?: (data: any) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
  onConnected?: () => void;
  connectOnMount?: boolean;
  messageEvents?: string[];
  namespace?: string;
  sendEvent?: string;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  error: string | null;
  sendMessage: (data: any, eventName?: string) => void;
  disconnect: () => void;
  connect: () => void;
}

export function useWebSocket(
  path: string,
  {
    onMessage,
    onError,
    onClose,
    onConnected,
    connectOnMount = false,
    messageEvents = ['progress'],
    sendEvent = 'register',
    namespace = 'email-ingestion-v2',
  }: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use refs to store latest callback values without causing re-renders
  const callbacksRef = useRef({
    onMessage,
    onError,
    onClose,
    onConnected,
  });

  // Update refs when callbacks change (but don't trigger useEffect)
  useEffect(() => {
    callbacksRef.current = {
      onMessage,
      onError,
      onClose,
      onConnected,
    };
  }, [onMessage, onError, onClose, onConnected]);

  const connect = useCallback(() => {
    console.log(`🔄 useWebSocket: Starting connection to ${path}`);

    // Cleanup existing connection
    if (socketRef.current) {
      console.log(`🔄 useWebSocket: Cleaning up existing connection`);
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const wsUrl = `${API_ENDPOINTS.ws.baseUrl}/${namespace}`;
    console.log(`🚀 useWebSocket: Attempting connection to: ${wsUrl}`);

    // Create socket with EXACT same config as WebSocketTest
    const socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
    });

    // Event handlers - using refs to avoid dependency issues
    socket.on('connect', () => {
      console.log(`✅ useWebSocket: Connected to ${path}:`, socket.id);
      setIsConnected(true);
      setError(null);
      callbacksRef.current.onConnected?.();
    });

    socket.on('disconnect', (reason) => {
      console.log(`❌ useWebSocket: Disconnected from ${path}:`, reason);
      setIsConnected(false);
      callbacksRef.current.onClose?.();
    });

    socket.on('connect_error', (err) => {
      console.error(`🚨 useWebSocket: Connection error for ${path}:`, err);
      setError('Socket.IO connection error');
      callbacksRef.current.onError?.(err);
    });

    // Listen for message events
    messageEvents.forEach((eventName) => {
      socket.on(eventName, (data) => {
        callbacksRef.current.onMessage?.(data);
      });
    });

    // Listen for registration confirmation
    socket.on('registered', (data) => {
      console.log('✅ useWebSocket: Registration confirmed:', data);
    });

    socketRef.current = socket;
  }, [path, namespace, messageEvents]); // Only static dependencies

  const disconnect = useCallback(() => {
    console.log(`🛑 useWebSocket: Manual disconnect requested`);
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback(
    (data: any, eventName?: string) => {
      if (socketRef.current && isConnected) {
        const event = eventName || sendEvent;
        console.log(`📤 useWebSocket: Sending message: ${event}`, data);
        socketRef.current.emit(event, data);
      } else {
        console.warn('⚠️ useWebSocket: Cannot send message - not connected');
      }
    },
    [isConnected, sendEvent]
  );

  // Handle mount/unmount - NO connect function in dependencies
  useEffect(() => {
    console.log(
      `🏗️ useWebSocket: Hook mounted for ${path}, connectOnMount: ${connectOnMount}`
    );

    if (connectOnMount) {
      console.log(`🚀 useWebSocket: Auto-connecting on mount`);
      connect();
    }

    // Cleanup ONLY on actual unmount (empty dependency array)
    return () => {
      console.log(`🧹 useWebSocket: Hook unmounting for ${path}`);
      if (socketRef.current?.connected) {
        console.log(`🧹 useWebSocket: Disconnecting on unmount`);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []); // EMPTY dependency array - only run on mount/unmount

  // Separate effect for connectOnMount changes (without cleanup)
  useEffect(() => {
    if (connectOnMount && !socketRef.current) {
      console.log(`🚀 useWebSocket: ConnectOnMount changed, connecting...`);
      connect();
    }
  }, [connectOnMount, connect]);

  return {
    isConnected,
    error,
    sendMessage,
    disconnect,
    connect,
  };
}
