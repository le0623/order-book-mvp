"use client";

import * as React from "react";
import { Order } from "@/lib/types";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { OrderBookRowDetails } from "./row-details";

interface OrderBookProps {
  orders: Order[];
  prices?: Record<number, number>; // netuid -> price mapping
  filledOrdersMap?: Record<string, Order[]>; // UUID -> filled orders array
  newlyAddedOrderIds?: Set<string>; // Track newly added orders for flash animation
  onUpdateOrder?: (id: string, updates: Partial<Order>) => void;
  onCancelOrder?: (id: string) => void;
  onFillOrder?: () => void;
  onNewOrder?: () => void;
  apiUrl?: string;
}

export function OrderBook({
  orders,
  prices = {},
  filledOrdersMap = {},
  newlyAddedOrderIds = new Set(),
  onUpdateOrder,
  onCancelOrder,
  onFillOrder,
  onNewOrder,
  apiUrl,
}: OrderBookProps) {
  return (
    <DataTable
      columns={columns(prices)}
      data={orders}
      onNewOrder={onNewOrder}
      newlyAddedOrderIds={newlyAddedOrderIds}
      renderSubComponent={({ row }) => {
        const order = row.original;
        const filledOrders = filledOrdersMap[order.uuid] || [];
        return (
          <OrderBookRowDetails
            order={order}
            filledOrders={filledOrders}
            prices={prices}
            onUpdateOrder={onUpdateOrder}
            onCancelOrder={onCancelOrder}
            onFillOrder={onFillOrder}
            apiUrl={apiUrl}
          />
        );
      }}
    />
  );
}
