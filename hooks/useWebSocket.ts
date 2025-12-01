"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { WebSocketMessage, ConnectionState } from "@/lib/websocket-types";
import { MockWebSocket } from "@/lib/mock-websocket";

interface UseWebSocketOptions {
  url: string;
  enabled?: boolean;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
}

export function useWebSocket({
  url,
  enabled = true,
  onMessage,
  onError,
}: UseWebSocketOptions) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const wsRef = useRef<WebSocket | MockWebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!enabled) return;

    try {
      // Use mock WebSocket for development
      // In production, replace with: new WebSocket(url)
      const ws = new MockWebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionState("connected");
        reconnectAttemptsRef.current = 0;
      };

      ws.onclose = () => {
        setConnectionState("disconnected");
        wsRef.current = null;

        // Attempt to reconnect with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        setConnectionState("error");
        if (onError) {
          onError(error);
        }
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          if (onMessage) {
            onMessage(message);
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };
    } catch (error) {
      console.error("WebSocket connection error:", error);
      setConnectionState("error");
    }
  }, [url, enabled, onMessage, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionState("disconnected");
  }, []);

  useEffect(() => {
    if (enabled) {
      setConnectionState("connecting");
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    connectionState,
    connect,
    disconnect,
  };
}

