"use client";

import { OrderBook } from "@/components/order-book";
import { mockOrders, Order } from "@/lib/mock-data";
import { useState } from "react";
import { Activity, Wallet } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  const [orders, setOrders] = useState<Order[]>(mockOrders);

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
