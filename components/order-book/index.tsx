"use client";

import * as React from "react";
import { Order } from "@/lib/mock-data";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { OrderBookRowDetails } from "./row-details";

interface OrderBookProps {
  orders: Order[];
  onUpdateOrder?: (id: string, ask: number, bid: number) => void;
  onCancelOrder?: (id: string) => void;
  onAcceptOrder?: (id: string) => void;
}

export function OrderBook({
  orders,
  onUpdateOrder,
  onCancelOrder,
  onAcceptOrder,
}: OrderBookProps) {
  return (
    <DataTable
      columns={columns}
      data={orders}
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
