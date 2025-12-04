"use client";

import { MockWebSocket } from "@/lib/mock-websocket";
import { ConnectionState, WebSocketMessage } from "@/lib/websocket-types";
import { useEffect, useRef, useState, useCallback } from "react";
interface UseWebSocketOptions {
  url: string;
  enabled?: boolean;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  // If provided, forces use of the mock WebSocket. Defaults to true in non-production.
  useMock?: boolean;
}

/**
 * Custom hook to manage a WebSocket connection. It uses a mock implementation
 * in non-production environments by default. Messages are processed immediately
 * upon receipt (batching logic removed).
 */
export function useWebSocket({
  url,
  enabled = true,
  onMessage,
  onError,
  useMock,
}: UseWebSocketOptions) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const wsRef = useRef<WebSocket | MockWebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const connect = useCallback(() => {
    // Clear any existing reconnect attempts
    if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
    }

    if (!enabled || wsRef.current) return;

    try {
      // Decide whether to use the mock or a real WebSocket.
      const shouldUseMock = typeof useMock === "boolean" ? useMock : process.env.NODE_ENV !== "production";
      
      // Use the appropriate WebSocket implementation
      const ws = shouldUseMock ? new MockWebSocket(url) : new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionState("connected");
        console.log("WebSocket connected.");
      };

      ws.onclose = (event: CloseEvent) => {
        setConnectionState("disconnected");
        console.log("WebSocket disconnected:", event.reason);
        // Implement simple reconnection logic after a delay if still enabled
        if (enabled) {
            reconnectTimeoutRef.current = setTimeout(() => {
                console.log("Attempting to reconnect...");
                setConnectionState("connecting");
                connect();
            }, 5000); // Wait 5 seconds before attempting reconnect
        }
      };

      ws.onerror = (event: Event) => {
        setConnectionState("error");
        console.error("WebSocket error:", event);
        if (onError) onError(event);
        // Close the connection on error to trigger onclose and reconnection attempt
        ws.close();
      };
      
      // Messages are processed immediately (batching logic removed)
      ws.onmessage = (event: MessageEvent) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          if (onMessage) onMessage(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };
    } catch (error) {
      console.error("WebSocket connection error (in connect):", error);
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

    // Cleanup function: ensures disconnection on component unmount
    return () => {
      // Clear timeout before running disconnect to prevent recursive call
      if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        // Prevent onclose from triggering reconnect on manual disconnect/unmount
        wsRef.current.onclose = null; 
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, connect, disconnect]);

  return { connectionState, disconnect };
}