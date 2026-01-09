"use client";

import { ConnectionState, WebSocketMessage } from "@/lib/websocket-types";
import { useEffect, useRef, useState, useCallback } from "react";

interface UseWebSocketOptions {
  url: string;
  enabled?: boolean;
  onMessage?: (message: WebSocketMessage | any) => void;
  onError?: (error: Event) => void;
}

export function useWebSocket({
  url,
  enabled = true,
  onMessage,
  onError,
}: UseWebSocketOptions) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  const isFirstMessageRef = useRef(true); // Track first message (UUID)

  useEffect(() => {
    onMessageRef.current = onMessage;
    onErrorRef.current = onError;
  }, [onMessage, onError]);
  
  const connect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
    }

    if (!enabled) return;
    
    if (wsRef.current?.readyState === WebSocket.OPEN || 
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      setConnectionState("connecting");

      ws.onopen = () => {
        setConnectionState("connected");
        reconnectAttemptsRef.current = 0;
        isFirstMessageRef.current = true; // Reset for new connection
      };

      ws.onclose = (event: CloseEvent) => {
        wsRef.current = null;
        setConnectionState("disconnected");
        
        if (enabled && reconnectAttemptsRef.current < 10) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          
            reconnectTimeoutRef.current = setTimeout(() => {
                connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= 10) {
          setConnectionState("error");
        }
      };

      ws.onerror = (event: Event) => {
        setConnectionState("error");
        
        if (onErrorRef.current) {
          onErrorRef.current(event);
        }
      };
      
      ws.onmessage = async (event: MessageEvent) => {
        try {
          let rawData: string;
          
          // Handle different data types from WebSocket
          if (typeof event.data === 'string') {
            rawData = event.data;
          } else if (event.data instanceof Blob) {
            rawData = await event.data.text();
          } else if (event.data instanceof ArrayBuffer) {
            rawData = new TextDecoder().decode(event.data);
          } else {
            // If it's already an object, use it directly
            if (onMessageRef.current) {
              onMessageRef.current(event.data as WebSocketMessage);
            }
            return;
          }

          // Trim whitespace
          rawData = rawData.trim();
          
          // Skip empty messages
          if (!rawData) {
            return;
          }

          // First message from backend:
          // - /ws/book: UUID string (skip it)
          // - /ws/price: empty string '' (skip it, then process actual price data)
          if (isFirstMessageRef.current) {
            isFirstMessageRef.current = false;
            // Skip first message (UUID for /ws/book, empty string for /ws/price)
            return;
          }

          // Parse subsequent messages as JSON
          let message: WebSocketMessage = JSON.parse(rawData);
          
          // Handle double-encoded JSON (backend sends json.dumps() inside send_json())
          // If the parsed result is a string, parse it again
          if (typeof message === 'string') {
            message = JSON.parse(message);
          }
          
          if (onMessageRef.current) {
            onMessageRef.current(message);
          }
        } catch (error) {
          // Silently skip invalid messages
        }
      };
    } catch (error) {
      setConnectionState("error");
    }
  }, [url, enabled]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.onopen = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    reconnectAttemptsRef.current = 0;
    setConnectionState("disconnected");
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null; 
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        wsRef.current.onopen = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, connect, disconnect]);

  return { connectionState, disconnect };
}