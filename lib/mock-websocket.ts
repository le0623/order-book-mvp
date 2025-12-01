import { Order, OrderType, OrderStatus } from "./mock-data";
import { WebSocketMessage } from "./websocket-types";

// Generate random SS58 format wallet address
// SS58 addresses are base58 encoded, typically 48 characters
// Base58 excludes: 0, O, I, l (to avoid confusion)
const generateWalletAddress = (): string => {
  // Base58 character set (no 0, O, I, l)
  const base58Chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  
  // SS58 addresses typically start with 1-9 or specific network prefixes
  // Using prefix 5 (common for Substrate/Polkadot)
  let address = "5";
  
  // Generate remaining 46 characters (total 48 including prefix)
  for (let i = 0; i < 46; i++) {
    address += base58Chars.charAt(Math.floor(Math.random() * base58Chars.length));
  }
  
  return address;
};

// Generate a random order
const generateRandomOrder = (id: string): Order => {
  const orderTypes: OrderType[] = ["Sell", "Buy"];
  const statuses: OrderStatus[] = ["Open", "Pending", "Partial"];
  
  const orderType = orderTypes[Math.floor(Math.random() * orderTypes.length)];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  const sn = Math.floor(Math.random() * 10) + 1;
  const size = Math.random() * 3000 + 500;
  const ask = Math.random() * 15 + 40;
  const bid = ask - (Math.random() * 5 + 3);
  
  return {
    id,
    date: new Date(),
    order: orderType,
    sn,
    wallet: generateWalletAddress(),
    size: Math.round(size * 100) / 100,
    ask: Math.round(ask * 100) / 100,
    bid: Math.round(bid * 100) / 100,
    partial: status === "Partial",
    status,
    history: [
      {
        timestamp: new Date(),
        ask,
        bid,
        status,
      },
    ],
  };
};

// Mock WebSocket class
export class MockWebSocket {
  private url: string;
  private readyState: number = WebSocket.CONNECTING;
  private messageQueue: WebSocketMessage[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private orderIdCounter: number = 25; // Start after existing mock orders

  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url: string) {
    this.url = url;
    
    // Simulate connection delay
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event("open"));
      }
      
      // Start sending messages every 3-5 seconds
      this.startSendingMessages();
    }, 500);
  }

  private startSendingMessages() {
    const sendMessage = () => {
      if (this.readyState === WebSocket.OPEN) {
        const order = generateRandomOrder(this.orderIdCounter.toString());
        this.orderIdCounter++;
        
        // Serialize order with dates as strings for JSON
        const serializedOrder = {
          ...order,
          date: order.date.toISOString(),
          history: order.history.map((h) => ({
            ...h,
            timestamp: h.timestamp.toISOString(),
          })),
        };

        const message: WebSocketMessage = {
          type: "NEW_ORDER",
          payload: serializedOrder as unknown as Order,
          timestamp: new Date().toISOString(),
        };
        
        if (this.onmessage) {
          this.onmessage(
            new MessageEvent("message", {
              data: JSON.stringify(message),
            })
          );
        }
      }
    };

    // Send first message after 2 seconds
    setTimeout(sendMessage, 2000);
    
    // Then send messages every 3-5 seconds
    this.intervalId = setInterval(() => {
      sendMessage();
    }, 3000 + Math.random() * 2000);
  }

  send(data: string | ArrayBuffer | Blob) {
    // Mock send - just log it
    console.log("MockWebSocket send:", data);
  }

  close(code?: number, reason?: string) {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent("close", { code, reason }));
    }
  }

  addEventListener(
    type: "open" | "close" | "error" | "message",
    listener: EventListener
  ) {
    switch (type) {
      case "open":
        this.onopen = listener as (event: Event) => void;
        break;
      case "close":
        this.onclose = listener as (event: CloseEvent) => void;
        break;
      case "error":
        this.onerror = listener as (event: Event) => void;
        break;
      case "message":
        this.onmessage = listener as (event: MessageEvent) => void;
        break;
    }
  }

  removeEventListener(
    type: "open" | "close" | "error" | "message",
    listener: EventListener
  ) {
    // Mock implementation
  }
}

