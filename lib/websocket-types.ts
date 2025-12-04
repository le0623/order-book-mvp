import { Order } from "./mock-data";

// WebSocket message types
export type WebSocketMessageTypeSingle = "NEW_ORDER" | "UPDATE_ORDER" | "DELETE_ORDER";
export type WebSocketMessageType = WebSocketMessageTypeSingle | "BATCH_ORDERS";

export interface WebSocketMessageSingle {
  type: WebSocketMessageTypeSingle;
  payload: Order;
  timestamp?: string;
}

export interface WebSocketMessageBatch {
  type: "BATCH_ORDERS";
  payload: Order[];
  timestamp?: string;
}

export type WebSocketMessage = WebSocketMessageSingle | WebSocketMessageBatch;

// Connection state
export type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

