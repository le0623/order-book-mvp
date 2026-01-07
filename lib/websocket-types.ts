import { Order } from "./types";

export interface WebSocketMessage {
  uuid?: string;
  data?: Order | Order[];
}

export type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

