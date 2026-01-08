"use client";

import { OrderBook } from "../components/order-book";
import { Order } from "../lib/types";
import { useState, useCallback, useMemo } from "react";
import { Activity, Wifi, WifiOff } from "lucide-react";
import { ThemeToggle } from "../components/theme-toggle";
import { useWebSocket } from "../hooks/useWebSocket";
import { WebSocketMessage } from "../lib/websocket-types";
import { ConnectButton } from "../components/walletkit/connect";
import { NewOrderModal } from "../components/new-order-modal";

// Normalize WebSocket URL to ensure it ends with /book exactly once
const getWebSocketUrl = (): string => {
  const baseUrl = process.env.NEXT_PUBLIC_WS_URL || "wss://api.subnet118.com/ws";
  // Remove trailing /book if present, then append /book
  const normalized = baseUrl.replace(/\/book\/?$/, "");
  return `${normalized}/book`;
};

const WS_URL = getWebSocketUrl();
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.subnet118.com";

export default function Home() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [newOrderModalOpen, setNewOrderModalOpen] = useState(false);

  const isTerminalStatus = (status: number) => {
    // Status 2 (filled), 3 (error), 4 (closed), 6 (expired) are terminal
    return [2, 3, 4, 6].includes(status);
  };

  const updateOrders = useCallback((updatedOrder: Order) => {
    console.log("🔄 updateOrders called with:", updatedOrder);
    
    setOrders((prevOrders) => {
      const index = prevOrders.findIndex((o) => o.uuid === updatedOrder.uuid);
      console.log("📊 Current orders count:", prevOrders.length, "| Order exists:", index !== -1);

      if (index === -1) {
        if (isTerminalStatus(updatedOrder.status)) {
          console.log("⚠️ Order has terminal status, not adding to list");
          return prevOrders;
        }
        console.log("✅ Adding new order to list");
        return [updatedOrder, ...prevOrders];
      }

      if (isTerminalStatus(updatedOrder.status)) {
        console.log("🗑️ Removing order with terminal status");
        return prevOrders.filter((o) => o.uuid !== updatedOrder.uuid);
      }

      console.log("📝 Updating existing order");
      const newOrders = [...prevOrders];
      newOrders[index] = updatedOrder;
      return newOrders;
    });
  }, []);

  /**
   * Normalizes an order object by converting string boolean values to actual booleans.
   * Backend sends "True"/"False" strings, but frontend expects boolean values.
   */
  const normalizeOrder = useCallback((order: any): Order => {
    return {
      ...order,
      // Convert string "True"/"False" to boolean true/false
      partial: order.partial === "True" || order.partial === true,
      public: order.public === "True" || order.public === true,
      // Ensure numeric fields are numbers
      status: Number(order.status),
      type: Number(order.type),
      asset: Number(order.asset),
      ask: Number(order.ask),
      bid: Number(order.bid),
      stp: Number(order.stp),
      lmt: Number(order.lmt),
    };
  }, []);

  /**
   * Normalizes WebSocket message to extract order data.
   * Handles two formats:
   * 1. Nested: {uuid: '...', data: {...}} or {uuid: '...', data: [...]}
   * 2. Flat: {date: '...', uuid: '...', ...} (message itself is the order)
   */
  const extractOrderData = useCallback((message: WebSocketMessage | Order): {
    orderData: Order | Order[];
    messageUuid: string;
  } | null => {
    console.log("🔎 extractOrderData called with:", message);
    console.log("🔎 Message type:", typeof message);
    console.log("🔎 Has 'data' field:", 'data' in message);
    console.log("🔎 Has 'uuid' field:", 'uuid' in message);
    console.log("🔎 Has 'date' field:", 'date' in message);
    
    if (!message || typeof message !== 'object') {
      console.log("❌ Message is not an object");
      return null;
    }

    // Check if message has nested data structure (WebSocketMessage format)
    if ('data' in message && message.data !== undefined) {
      console.log("✅ Nested format detected");
      const wsMessage = message as WebSocketMessage;
      // We've already checked data !== undefined, so use non-null assertion
      return {
        orderData: wsMessage.data!,
        messageUuid: wsMessage.uuid || "",
      };
    }

    // Check if message itself is an order (flat format from backend)
    // An Order must have at least 'uuid' and 'date' fields
    if ('uuid' in message && 'date' in message) {
      console.log("✅ Flat format detected");
      return {
        orderData: message as Order,
        messageUuid: (message as Order).uuid || "",
      };
    }

    console.log("❌ Message format not recognized");
    return null;
  }, []);

  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      console.log("🔵 WebSocket message received:", message);
      
      // Extract order data from message (handles both nested and flat formats)
      const extracted = extractOrderData(message);
      if (!extracted) {
        console.log("❌ Failed to extract order data from message");
        return;
      }

      console.log("✅ Extracted order data:", extracted);
      const { orderData, messageUuid } = extracted;

      // Handle array of orders
      if (Array.isArray(orderData)) {
        setOrders((prev) => {
          const map = new Map(prev.map((o) => [o.uuid, o]));

          for (const order of orderData) {
            // Normalize order data (convert string booleans to actual booleans)
            const normalized = normalizeOrder({ ...order, uuid: order.uuid || messageUuid });
            
            if (!normalized.uuid) {
              continue;
            }
            
            if (isTerminalStatus(normalized.status)) {
              map.delete(normalized.uuid);
            } else {
              map.set(normalized.uuid, normalized);
            }
          }

          return Array.from(map.values());
        });
      } else {
        // Handle single order
        // Normalize order data (convert string booleans to actual booleans)
        const normalized = normalizeOrder({ ...orderData, uuid: orderData.uuid || messageUuid });

        console.log("📦 Order received:", {
          raw_public: (orderData as any).public,
          raw_partial: (orderData as any).partial,
          normalized_public: normalized.public,
          normalized_partial: normalized.partial,
          status: normalized.status,
          uuid: normalized.uuid
        });

        if (normalized.uuid) {
          updateOrders(normalized);
        }
      }
    },
    [extractOrderData, normalizeOrder, updateOrders]
  );

  const { connectionState } = useWebSocket({
    url: WS_URL,
    onMessage: handleWebSocketMessage,
  });
  const handleUpdateOrder = (uuid: string, updates: Partial<Order>) => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.uuid !== uuid) return order;

        return {
          ...order,
          ...updates,
        };
      })
    );
  };

  const handleCancelOrder = (uuid: string) => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.uuid !== uuid) return order;

        return {
          ...order,
          status: 4, // 4 = closed
        };
      })
    );
  };

  const handleAcceptOrder = (uuid: string) => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.uuid !== uuid) return order;

        return {
          ...order,
          status: 5, // 5 = stopped (pending action)
        };
      })
    );
  };

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
  }, [orders]);

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 max-w-7xl">
        
        <header className="mb-6 border-b py-8 border-border/40 pb-6 sticky top-0 z-10 bg-background">
          <div className="flex items-center justify-between">
            
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">HODL Exchange</h1>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-muted-foreground text-sm">
                    by Subnet118
                  </p>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card/50">
                    {connectionState === "connected" ? (
                      <>
                        <Wifi className="h-4 w-4 text-green-500" />
                        <span className="text-xs text-muted-foreground">Live</span>
                      </>
                    ) : connectionState === "connecting" ? (
                      <>
                        <Wifi className="h-4 w-4 text-yellow-500 animate-pulse" />
                        <span className="text-xs text-muted-foreground">Connecting...</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-4 w-4 text-red-500" />
                        <span className="text-xs text-muted-foreground">Disconnected</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />

              <ConnectButton />
            </div>
          </div>
        </header>

        <OrderBook
          orders={sortedOrders}
          onUpdateOrder={handleUpdateOrder}
          onCancelOrder={handleCancelOrder}
          onAcceptOrder={handleAcceptOrder}
          onNewOrder={() => setNewOrderModalOpen(true)}
        />

        <NewOrderModal
          open={newOrderModalOpen}
          onOpenChange={setNewOrderModalOpen}
          apiUrl={API_URL}
        />
      </div>
    </main>
  );
}
