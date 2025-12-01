import { Order, OrderType, OrderStatus } from "./mock-data";

// WebSocket message types
export type WebSocketMessageType = "NEW_ORDER" | "UPDATE_ORDER" | "DELETE_ORDER";

// WebSocket message structure
export interface WebSocketMessage {
  type: WebSocketMessageType;
  payload: Order;
  timestamp?: string;
}

// Connection state
export type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

