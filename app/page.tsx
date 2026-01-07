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

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "wss://api.subnet118.com/ws/book";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.subnet118.com";

export default function Home() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [newOrderModalOpen, setNewOrderModalOpen] = useState(false);

  const isTerminalStatus = (status: number) => {
    // Status 2 (filled), 3 (error), 4 (closed), 6 (expired) are terminal
    return [2, 3, 4, 6].includes(status);
  };

  const updateOrders = useCallback((updatedOrder: Order) => {
    setOrders((prevOrders) => {
      const index = prevOrders.findIndex((o) => o.uuid === updatedOrder.uuid);

      if (index === -1) {
        if (isTerminalStatus(updatedOrder.status)) {
          return prevOrders;
        }
        return [updatedOrder, ...prevOrders];
      }

      if (isTerminalStatus(updatedOrder.status)) {
        return prevOrders.filter((o) => o.uuid !== updatedOrder.uuid);
      }

      const newOrders = [...prevOrders];
      newOrders[index] = updatedOrder;
      return newOrders;
    });
  }, []);

  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      let parsedMessage: WebSocketMessage;
      
      if (typeof message === 'string') {
        parsedMessage = JSON.parse(message);
      } else {
        parsedMessage = message;
      }
      
      if (!parsedMessage?.data) {
        return;
      }

      const orderData = parsedMessage.data;
      const messageUuid = parsedMessage.uuid || "";
 
      if (Array.isArray(orderData)) {
        setOrders((prev) => {
          const map = new Map(prev.map((o) => [o.uuid, o]));

          for (const order of orderData) {
            const normalizedOrder = { ...order, uuid: order.uuid || messageUuid };
            
            if (!normalizedOrder.uuid) {
              continue;
            }
            
            if (isTerminalStatus(normalizedOrder.status)) {
              map.delete(normalizedOrder.uuid);
            } else {
              map.set(normalizedOrder.uuid, normalizedOrder);
            }
          }

          return Array.from(map.values());
        });
      } else {
        const normalizedOrder = { ...orderData, uuid: orderData.uuid || messageUuid } as Order;

        if (normalizedOrder.uuid) {
          updateOrders(normalizedOrder);
        }
      }
    },
    [updateOrders]
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
