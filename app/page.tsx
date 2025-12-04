"use client";

import { OrderBook } from "../components/order-book";
import { mockOrders, Order } from "../lib/mock-data";
import { useState, useCallback, useMemo } from "react";
import { Activity, Wifi, WifiOff } from "lucide-react";
import { ThemeToggle } from "../components/theme-toggle";
import { useWebSocket } from "../hooks/useWebSocket";
import { WebSocketMessage } from "../lib/websocket-types";
import { ConnectButton } from "../components/walletkit/connect";

const MOCK_WS_URL = "wss://mock.orderbook.io/stream";

export default function Home() {
  const [orders, setOrders] = useState<Order[]>(mockOrders);

  const normalizeOrder = useCallback((order: Order): Order => {
    if (!order) return order;

    return {
      ...order,
      date: typeof order.date === "string" ? new Date(order.date) : order.date,
      history: order.history
        ? order.history.map((h) => ({
            ...h,
            timestamp:
              typeof h.timestamp === "string"
                ? new Date(h.timestamp)
                : h.timestamp,
          }))
        : [],
    };
  }, []);

  const updateOrders = useCallback((updatedOrder: Order) => {
    setOrders((prevOrders) => {
      const index = prevOrders.findIndex((o) => o.id === updatedOrder.id);

      if (index === -1) {
        return [updatedOrder, ...prevOrders];
      }

      if (
        updatedOrder.status === "Canceled" ||
        updatedOrder.status === "Completed" ||
        updatedOrder.status === "Failed"
      ) {
        return prevOrders.filter((o) => o.id !== updatedOrder.id);
      }

      const newOrders = [...prevOrders];
      newOrders[index] = updatedOrder;
      return newOrders;
    });
  }, []);

  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      if (!message?.payload) return;

      if (message.type === "BATCH_ORDERS") {
        const incoming = (message.payload as Order[]).map(normalizeOrder);

        setOrders((prev) => {
          const map = new Map(prev.map((o) => [o.id, o]));

          for (const order of incoming) {
            if (
              ["Canceled", "Completed", "Failed"].includes(order.status ?? "")
            ) {
              map.delete(order.id);
            } else {
              map.set(order.id, order);
            }
          }

          return Array.from(map.values());
        });

        return;
      }

      const normalizedOrder = normalizeOrder(message.payload as Order);

      switch (message.type) {
        case "NEW_ORDER":
        case "UPDATE_ORDER":
          updateOrders(normalizedOrder);
          break;

        case "DELETE_ORDER":
          setOrders((prev) =>
            prev.filter((o) => o.id !== normalizedOrder.id)
          );
          break;

        default:
          console.warn("Unknown message type:", message);
      }
    },
    [normalizeOrder, updateOrders]
  );

  const { connectionState } = useWebSocket({
    url: MOCK_WS_URL,
    onMessage: handleWebSocketMessage,
  });
  
  const handleUpdateOrder = (id: string, updates: Partial<Order>) => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== id) return order;

        const newHistory = [
          ...order.history,
          {
            timestamp: new Date(),
            ask: updates.ask ?? order.ask,
            bid: updates.bid ?? order.bid,
            status: order.status,
          },
        ];

        return {
          ...order,
          ...updates,
          history: newHistory,
        };
      })
    );
  };

  const handleCancelOrder = (id: string) => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== id) return order;

        const newHistory = [
          ...order.history,
          {
            timestamp: new Date(),
            ask: order.ask,
            bid: order.bid,
            status: "Canceled" as const,
          },
        ];

        return {
          ...order,
          status: "Canceled" as const,
          history: newHistory,
        };
      })
    );
  };

  const handleAcceptOrder = (id: string) => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== id) return order;

        const newHistory = [
          ...order.history,
          {
            timestamp: new Date(),
            ask: order.ask,
            bid: order.bid,
            status: "Pending" as const,
          },
        ];

        return {
          ...order,
          status: "Pending" as const,
          history: newHistory,
        };
      })
    );
  };

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => b.date.getTime() - a.date.getTime());
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
                <h1 className="text-3xl font-bold tracking-tight">SPA Exchange</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Decentralized Order Book
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
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
        />
      </div>
    </main>
  );
}
