"use client";

import { ConnectionState, WebSocketMessage } from "@/lib/websocket-types";
import { useEffect, useRef, useState, useCallback } from "react";

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
        console.error("⚠️ WebSocket error:", {
          type: event.type,
          target: event.target instanceof WebSocket ? {
            readyState: event.target.readyState,
            url: event.target.url
          } : 'unknown',
          readyStateDescription: ws.readyState === 0 ? 'CONNECTING' :
                                 ws.readyState === 1 ? 'OPEN' :
                                 ws.readyState === 2 ? 'CLOSING' :
                                 ws.readyState === 3 ? 'CLOSED' : 'UNKNOWN'
        });
        
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

          // First message from backend is always a UUID string (not JSON)
          if (isFirstMessageRef.current) {
            isFirstMessageRef.current = false;
            // Store UUID if needed, but don't try to parse it as JSON
            // Just skip it for now since we don't need it yet
            return;
          }

          // Parse subsequent messages as JSON
          const message: WebSocketMessage = JSON.parse(rawData);
          if (onMessageRef.current) {
            onMessageRef.current(message);
          }
        } catch (error) {
          console.error("❌ Failed to parse WebSocket message:");
          console.error("Error details:", error instanceof Error ? error.message : String(error));
          console.error("Data type:", typeof event.data);
          console.error("Raw data preview:", typeof event.data === 'string' 
            ? event.data.substring(0, 200) 
            : event.data);
          console.error("First 20 chars (codes):", typeof event.data === 'string'
            ? Array.from(event.data.substring(0, 20)).map(c => `${c}(${c.charCodeAt(0)})`).join(' ')
            : 'N/A');
        }
      };
    } catch (error) {
      console.error("❌ WebSocket connection error:", error);
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