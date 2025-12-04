import { Order, OrderType, OrderStatus } from "./mock-data";
import { WebSocketMessage, WebSocketMessageSingle } from "./websocket-types";

// Helper to generate a random wallet address (kept for generating new data)
const base58Chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const generateWalletAddress = (): string => {
  let address = "5";
  for (let i = 0; i < 46; i++) {
    address += base58Chars.charAt(Math.floor(Math.random() * base58Chars.length));
  }
  return address;
};

/**
 * Generates a random Order object.
 * NOTE: This function returns a Date object in the `date` and `history` fields.
 * The payload conversion (to ISO string) happens in the `generateMessage` helpers.
 */
const generateRandomOrder = (id: string): Order => {
  const orderTypes: OrderType[] = ["Sell", "Buy"];
  // New orders are primarily 'Open' or 'Pending'
  const statuses: OrderStatus[] = ["Open", "Pending"]; 

  const orderType = orderTypes[Math.floor(Math.random() * orderTypes.length)];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  const sn = Math.floor(Math.random() * 10) + 1;
  const size = Math.random() * 3000 + 500;
  const ask = Math.random() * 100 + 10;
  const bid = Math.random() * 100 + 5;
  const partial = Math.random() < 0.5;
  const wallet = generateWalletAddress();

  const now = new Date();
  const history = [{ timestamp: now, ask, bid, status: "Open" as OrderStatus }];

  return {
    id,
    date: now,
    order: orderType,
    sn,
    wallet,
    size: parseFloat(size.toFixed(2)),
    ask: parseFloat(ask.toFixed(2)),
    bid: parseFloat(bid.toFixed(2)),
    partial,
    status,
    history,
  };
};

/**
 * Converts an Order object (with Date objects) into a JSON payload (with ISO strings)
 * and wraps it in a WebSocketMessage.
 */
const generateMessage = (type: WebSocketMessageSingle['type'], order: Order): WebSocketMessageSingle => {
  // Ensure the date and history timestamps are ISO strings for transport
  const payload: Order = {
    ...order,
    date: order.date.toISOString() as any, 
    history: order.history.map(h => ({
      ...h,
      timestamp: h.timestamp.toISOString() as any,
    }))
  };

  return {
    type,
    payload,
    timestamp: new Date().toISOString(),
  };
};


export class MockWebSocket implements EventTarget {
  CONNECTING = 0;
  OPEN = 1;
  CLOSING = 2;
  CLOSED = 3;

  public url: string;
  public readyState: number;
  
  public onopen: ((this: WebSocket | MockWebSocket, ev: Event) => any) | null = null;
  public onclose: ((this: WebSocket | MockWebSocket, ev: CloseEvent) => any) | null = null;
  public onerror: ((this: WebSocket | MockWebSocket, ev: Event) => any) | null = null;
  public onmessage: ((this: WebSocket | MockWebSocket, ev: MessageEvent) => any) | null = null;


  public binaryType: "blob" | "arraybuffer" = "blob";
  public bufferedAmount: number = 0;
  public extensions: string = "";
  public protocol: string = "";

  private intervalId: NodeJS.Timeout | null = null;
  private orderIdCounter: number;
  private activeOrders: Order[] = []; 

  constructor(url: string) {
    this.url = url;
    this.readyState = this.CONNECTING;
    this.orderIdCounter = 100; 
    
    setTimeout(() => {
      this.readyState = this.OPEN;
      if (this.onopen) this.onopen(new Event("open"));
      this.startFeed();
    }, 500);
  }

  private startFeed() {
    this.orderIdCounter += 1;
    const initialOrder = generateRandomOrder(`mock-${this.orderIdCounter}`);
    this.activeOrders.push(initialOrder);
    const initialMessage = generateMessage("NEW_ORDER", initialOrder);
    
    // Send initial message
    if (this.onmessage) {
        this.onmessage(new MessageEvent("message", { data: JSON.stringify(initialMessage) }));
    }

    const FEED_INTERVAL_MS = 5000;
    this.intervalId = setInterval(() => {
      const chance = Math.random();
      
      if (chance < 0.6) {
        
        this.orderIdCounter += 1;
        const newOrder = generateRandomOrder(`mock-${this.orderIdCounter}`);
        this.activeOrders.push(newOrder);
        const message = generateMessage("NEW_ORDER", newOrder);

        if (this.onmessage) {
          this.onmessage(new MessageEvent("message", { data: JSON.stringify(message) }));
        }
      } else if (chance < 0.9 && this.activeOrders.length > 0) {
        const index = Math.floor(Math.random() * this.activeOrders.length);
        const orderToUpdate = this.activeOrders[index];

        if (Math.random() < 0.5) {
            orderToUpdate.status = "Partial"; 
        } else {
            const priceChange = Math.random() * 0.5 - 0.25; 
            orderToUpdate.ask = parseFloat((orderToUpdate.ask + priceChange).toFixed(2));
            orderToUpdate.bid = parseFloat((orderToUpdate.bid + priceChange).toFixed(2));
        }
        
        
        orderToUpdate.history.push({ 
            timestamp: new Date(), 
            ask: orderToUpdate.ask, 
            bid: orderToUpdate.bid, 
            status: orderToUpdate.status 
        });

        const message = generateMessage("UPDATE_ORDER", orderToUpdate);
        
        if (this.onmessage) {
          this.onmessage(new MessageEvent("message", { data: JSON.stringify(message) }));
        }
      } else if (this.activeOrders.length > 0) {
        const index = Math.floor(Math.random() * this.activeOrders.length);
        const orderToDelete = this.activeOrders[index];
        this.activeOrders.splice(index, 1); 

        const message = generateMessage("DELETE_ORDER", orderToDelete);

        if (this.onmessage) {
          this.onmessage(new MessageEvent("message", { data: JSON.stringify(message) }));
        }
      }
    }, FEED_INTERVAL_MS);
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    try {
      const parsed = JSON.parse(data.toString());
      console.log("MockWebSocket received outgoing message (not broadcasted):", parsed);
    } catch (e) {
      console.log("MockWebSocket received non-JSON send:", data);
    }
  }

  close(code?: number, reason?: string) {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.readyState = this.CLOSED;
    if (this.onclose) this.onclose(new CloseEvent("close", { code, reason }));
  }
  
  addEventListener(type: "open" | "close" | "error" | "message", listener: EventListener) {
    switch (type) {
      case "open":
        this.onopen = listener as (e: Event) => void;
        break;
      case "close":
        this.onclose = listener as (e: CloseEvent) => void;
        break;
      case "error":
        this.onerror = listener as (e: Event) => void;
        break;
      case "message":
        this.onmessage = listener as (e: MessageEvent) => void;
        break;
    }
  }

  removeEventListener(type: string, listener: EventListener) {
  }
  
  dispatchEvent(event: Event): boolean {
    return true; 
  }
}