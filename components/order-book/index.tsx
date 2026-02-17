"use client";

import * as React from "react";
import { Order } from "@/lib/types";
import { ConnectionState } from "@/lib/websocket-types";
import { DataTable } from "./data-table";
import { columns } from "./columns";
import { OrderBookRowDetails } from "./row-details";

interface OrderBookProps {
  orders: Order[];
  prices?: Record<number, number>; // netuid -> price mapping
  filledOrdersMap?: Record<string, Order[]>; // UUID -> filled orders array
  newlyAddedOrderIds?: Map<string, number>; // Track newly added orders for flash animation: orderId -> orderType
  onUpdateOrder?: (id: string, updates: Partial<Order>) => void;
  onCancelOrder?: (id: string) => void;
  onFillOrder?: () => void;
  onRecMessage?: (message: string) => void;
  onNewOrder?: () => void;
  apiUrl?: string;
  allOrdersForSearch?: Order[];
  showMyOrdersOnly?: boolean;
  walletAddress?: string;
  connectionState?: ConnectionState;
}

export function OrderBook({
  orders,
  prices = {},
  filledOrdersMap = {},
  newlyAddedOrderIds = new Map(),
  onUpdateOrder,
  onCancelOrder,
  onFillOrder,
  onRecMessage,
  onNewOrder,
  apiUrl,
  allOrdersForSearch = [],
  showMyOrdersOnly = false,
  walletAddress,
  connectionState = "disconnected",
}: OrderBookProps) {
  // Memoize columns so they don't recreate on every render
  const memoizedColumns = React.useMemo(() => columns(prices), [prices]);

  // Memoize renderSubComponent so the table doesn't get a new function reference each render
  const renderSubComponent = React.useCallback(({ row }: { row: any }) => {
    const order = row.original;
    const filledOrders = filledOrdersMap[order.escrow] || [];
    return (
      <OrderBookRowDetails
        key={`${order.uuid}-${order.status}-${order.stp}-${order.public}`}
        order={order}
        filledOrders={filledOrders}
        prices={prices}
        newlyAddedOrderIds={newlyAddedOrderIds}
        onUpdateOrder={onUpdateOrder}
        onCancelOrder={onCancelOrder}
        onFillOrder={onFillOrder}
        onRecMessage={onRecMessage}
        apiUrl={apiUrl}
        walletAddress={walletAddress}
      />
    );
  }, [filledOrdersMap, prices, newlyAddedOrderIds, onUpdateOrder, onCancelOrder, onFillOrder, onRecMessage, apiUrl, walletAddress]);

  return (
    <DataTable
      columns={memoizedColumns}
      data={orders}
      onNewOrder={onNewOrder}
      newlyAddedOrderIds={newlyAddedOrderIds}
      filledOrdersMap={filledOrdersMap}
      allOrdersForSearch={allOrdersForSearch}
      showMyOrdersOnly={showMyOrdersOnly}
      connectionState={connectionState}
      renderSubComponent={renderSubComponent}
    />
  );
}
