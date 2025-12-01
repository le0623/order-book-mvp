"use client";

import { OrderBook } from "@/components/order-book";
import { mockOrders, Order } from "@/lib/mock-data";
import { useState, useCallback } from "react";
import { Activity, Wallet, Wifi, WifiOff } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useWebSocket } from "@/hooks/useWebSocket";
import { WebSocketMessage } from "@/lib/websocket-types";

export default function Home() {
  const [orders, setOrders] = useState<Order[]>(mockOrders);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    // Convert date strings to Date objects
    const normalizeOrder = (order: Order): Order => ({
      ...order,
      date: typeof order.date === "string" ? new Date(order.date) : order.date,
      history: order.history.map((h) => ({
        ...h,
        timestamp:
          typeof h.timestamp === "string"
            ? new Date(h.timestamp)
            : h.timestamp,
      })),
    });

    setOrders((prevOrders) => {
      switch (message.type) {
        case "NEW_ORDER": {
          // Check if order already exists (prevent duplicates)
          const normalizedOrder = normalizeOrder(message.payload);
          const exists = prevOrders.find((o) => o.id === normalizedOrder.id);
          if (exists) {
            return prevOrders; // Order already exists, don't add duplicate
          }
          // Add new order at the beginning of the list
          return [normalizedOrder, ...prevOrders];
        }

        case "UPDATE_ORDER": {
          // Update existing order
          const normalizedOrder = normalizeOrder(message.payload);
          return prevOrders.map((order) => {
            if (order.id === normalizedOrder.id) {
              return {
                ...order,
                ...normalizedOrder,
                // Preserve existing history and merge with new history if provided
                history: normalizedOrder.history || order.history,
              };
            }
            return order;
          });
        }

        case "DELETE_ORDER": {
          // Remove order from list
          return prevOrders.filter((order) => order.id !== message.payload.id);
        }

        default:
          return prevOrders;
      }
    });
  }, []);

  // WebSocket connection
  const { connectionState } = useWebSocket({
    url: "ws://localhost:3001/orders", // Will use mock WebSocket for now
    enabled: true,
    onMessage: handleWebSocketMessage,
    onError: (error) => {
      console.error("WebSocket error:", error);
    },
  });

  const handleUpdateOrder = (id: string, ask: number, bid: number) => {
    setOrders((prevOrders) =>
      prevOrders.map((order) => {
        if (order.id === id) {
          const newHistory = [
            ...order.history,
            {
              timestamp: new Date(),
              ask,
              bid,
              status: order.status,
            },
          ];
          return {
            ...order,
            ask,
            bid,
            history: newHistory,
          };
        }
        return order;
      })
    );
  };

  const handleCancelOrder = (id: string) => {
    setOrders((prevOrders) =>
      prevOrders.map((order) => {
        if (order.id === id) {
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
        }
        return order;
      })
    );
  };

  const handleAcceptOrder = (id: string) => {
    setOrders((prevOrders) =>
      prevOrders.map((order) => {
        if (order.id === id) {
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
        }
        return order;
      })
    );
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto  px-4 max-w-7xl">
        <header className="mb-6 border-b py-8 border-border/40 pb-6 sticky top-0 z-10 bg-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  SPA Exchange
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Decentralized Order Book
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* WebSocket Connection Status */}
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
              <div className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-card/50 hover:bg-card transition-colors cursor-pointer">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Connect Wallet</span>
              </div>
            </div>
          </div>
        </header>
        <OrderBook
          orders={orders}
          onUpdateOrder={handleUpdateOrder}
          onCancelOrder={handleCancelOrder}
          onAcceptOrder={handleAcceptOrder}
        />
      </div>
    </main>
  );
}
