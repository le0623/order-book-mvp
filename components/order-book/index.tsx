"use client";

import * as React from "react";
import { Order } from "@/lib/types"; 
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { OrderBookRowDetails } from "./row-details";

interface OrderBookProps {
  orders: Order[];
  // UPDATED: Use Partial<Order> for a more flexible update payload
  onUpdateOrder?: (id: string, updates: Partial<Order>) => void;
  onCancelOrder?: (id: string) => void;
  onAcceptOrder?: (id: string) => void;
  onNewOrder?: () => void; // NEW: Callback to open New Order modal
}

export function OrderBook({
  orders,
  onUpdateOrder,
  onCancelOrder,
  onAcceptOrder,
  onNewOrder,
}: OrderBookProps) {
  return (
    <DataTable
      columns={columns}
      data={orders}
      onNewOrder={onNewOrder}
      renderSubComponent={({ row }) => (
        <OrderBookRowDetails
          order={row.original}
          onUpdateOrder={onUpdateOrder} 
          onCancelOrder={onCancelOrder}
          onAcceptOrder={onAcceptOrder}
        />
      )}
    />
  );
}