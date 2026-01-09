"use client";

import { OrderBook } from "../components/order-book";
import { Order } from "../lib/types";
import { useState, useCallback, useMemo, useEffect } from "react";
import { Activity, Wifi, WifiOff } from "lucide-react";
import { ThemeToggle } from "../components/theme-toggle";
import { useWebSocket } from "../hooks/useWebSocket";
import { WebSocketMessage } from "../lib/websocket-types";
import { ConnectButton } from "../components/walletkit/connect";
import { NewOrderModal } from "../components/new-order-modal";

// Normalize WebSocket URL to ensure it ends with /book exactly once
const getWebSocketUrl = (): string => {
  const baseUrl =
    process.env.NEXT_PUBLIC_WS_URL || "wss://api.subnet118.com/ws";
  // Remove trailing /book if present, then append /book
  const normalized = baseUrl.replace(/\/book\/?$/, "");
  return `${normalized}/book`;
};

const WS_URL = getWebSocketUrl();
const WS_PRICE_URL =
  (process.env.NEXT_PUBLIC_WS_URL || "wss://api.subnet118.com/ws").replace(
    /\/book\/?$/,
    ""
  ) + "/price";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.subnet118.com";

export default function Home() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [newOrderModalOpen, setNewOrderModalOpen] = useState(false);
  const [prices, setPrices] = useState<Record<number, number>>({}); // netuid -> price mapping

  const isTerminalStatus = (status: number) => {
    // Status 3 (error), 4 (closed), 6 (expired) are terminal and should be filtered out
    // Status 2 (filled) should be kept for display under parent order
    return [3, 4, 6].includes(status);
  };

  const updateOrders = useCallback((updatedOrder: Order) => {
    setOrders((prevOrders) => {
      const index = prevOrders.findIndex(
        (o) => o.uuid === updatedOrder.uuid && o.status === updatedOrder.status
      );

      if (index === -1) {
        // For filled orders (status=2), always add them (they can coexist with parent)
        if (updatedOrder.status === 2) {
          return [updatedOrder, ...prevOrders];
        }
        if (isTerminalStatus(updatedOrder.status)) {
          return prevOrders;
        }
        return [updatedOrder, ...prevOrders];
      }

      if (isTerminalStatus(updatedOrder.status)) {
        // Only remove if it's not a filled order (status=2)
        if (updatedOrder.status !== 2) {
          return prevOrders.filter(
            (o) =>
              !(
                o.uuid === updatedOrder.uuid && o.status === updatedOrder.status
              )
          );
        }
      }

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
      // Convert string "True"/"False", numeric 1/0, or boolean to boolean
      partial:
        order.partial === "True" ||
        order.partial === true ||
        order.partial === 1,
      public:
        order.public === "True" || order.public === true || order.public === 1,
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
  const extractOrderData = useCallback(
    (
      message: WebSocketMessage | Order
    ): {
      orderData: Order | Order[];
      messageUuid: string;
    } | null => {
      if (!message || typeof message !== "object") {
        return null;
      }

      // Check if message has nested data structure (WebSocketMessage format)
      if ("data" in message && message.data !== undefined) {
        const wsMessage = message as WebSocketMessage;
        // We've already checked data !== undefined, so use non-null assertion
        return {
          orderData: wsMessage.data!,
          messageUuid: wsMessage.uuid || "",
        };
      }

      // Check if message itself is an order (flat format from backend)
      // An Order must have at least 'uuid' and 'date' fields
      if ("uuid" in message && "date" in message) {
        return {
          orderData: message as Order,
          messageUuid: (message as Order).uuid || "",
        };
      }

      return null;
    },
    []
  );

  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      // Extract order data from message (handles both nested and flat formats)
      const extracted = extractOrderData(message);
      if (!extracted) {
        return;
      }

      const { orderData, messageUuid } = extracted;

      // Handle array of orders
      if (Array.isArray(orderData)) {
        setOrders((prev) => {
          const map = new Map(prev.map((o) => [o.uuid, o]));

          for (const order of orderData) {
            // Normalize order data (convert string booleans to actual booleans)
            const normalized = normalizeOrder({
              ...order,
              uuid: order.uuid || messageUuid,
            });

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
        const normalized = normalizeOrder({
          ...orderData,
          uuid: orderData.uuid || messageUuid,
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

  // WebSocket connection for live price updates from /ws/price
  const handlePriceMessage = useCallback((message: any) => {
    try {
      // Backend sends: {1: {price: 0.010463465}, 2: {price: 0.006411586}, ...} where keys are netuid (asset IDs)
      // Handle double-encoded JSON if needed
      let priceData = message;
      if (typeof message === "string") {
        priceData = JSON.parse(message);
        // Check if still a string (double-encoded)
        if (typeof priceData === "string") {
          priceData = JSON.parse(priceData);
        }
      }

      if (priceData && typeof priceData === "object") {
        // Convert string keys to numbers and extract price from each object
        const priceMap: Record<number, number> = {};
        for (const [key, value] of Object.entries(priceData)) {
          const netuid = Number(key);
          // Value is an object like {price: 0.010463465}, extract the price property
          let price: number;
          if (typeof value === "object" && value !== null && "price" in value) {
            price = Number((value as any).price);
          } else if (typeof value === "number") {
            // Fallback: if value is directly a number
            price = Number(value);
          } else {
            continue; // Skip invalid entries
          }

          if (!isNaN(netuid) && !isNaN(price) && price > 0) {
            priceMap[netuid] = price;
          }
        }
        setPrices(priceMap);
      }
    } catch (error) {
      console.error("❌ Error processing price message:", error);
    }
  }, []);

  const { connectionState: priceConnectionState } = useWebSocket({
    url: WS_PRICE_URL,
    onMessage: handlePriceMessage,
  });

  // Fetch initial open orders on component mount
  useEffect(() => {
    const fetchInitialOrders = async () => {
      try {
        const response = await fetch(`${API_URL}/sql?limit=1000`);

        if (!response.ok) {
          console.error("Failed to fetch initial orders:", response.statusText);
          return;
        }

        const data = await response.json();

        // Parse JSON string if needed (API might return stringified JSON)
        const ordersArray = typeof data === "string" ? JSON.parse(data) : data;

        if (!Array.isArray(ordersArray)) {
          console.error("Invalid orders data format");
          return;
        }

        // Normalize and filter orders: only Open (status=1) AND public orders
        const normalizedOrders = ordersArray
          .map((order: any) => normalizeOrder(order))
          .filter((order: Order) => {
            const isOpen = order.status === 1;
            const isPublic = order.public === true;
            return isOpen && isPublic;
          });

        if (normalizedOrders.length > 0) {
          setOrders(normalizedOrders);
        }
      } catch (error) {
        console.error("Error fetching initial orders:", error);
      }
    };

    fetchInitialOrders();
  }, [normalizeOrder]);

  const handleUpdateOrder = async (uuid: string, updates: Partial<Order>) => {
    try {
      const order = orders.find((o) => o.uuid === uuid && o.status === 1);
      if (!order) return;

      // Prepare updated order data with all required fields
      const updatedOrderData = {
        uuid: order.uuid,
        origin: order.origin || "",
        escrow: order.escrow || "",
        wallet: order.wallet || "",
        asset: Number(order.asset),
        type: Number(order.type),
        ask: Number(order.ask),
        bid: Number(order.bid),
        stp: Number(updates.stp !== undefined ? updates.stp : order.stp),
        lmt: Number(order.lmt),
        gtd: order.gtd || "gtc",
        partial: order.partial ? "True" : "False",
        public:
          updates.public !== undefined
            ? updates.public
              ? "True"
              : "False"
            : order.public
            ? "True"
            : "False",
        status: 1, // Keep status as Open
      };

      // Call backend API to persist changes
      const response = await fetch(`${API_URL}/rec`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedOrderData),
      });

      if (!response.ok) {
        throw new Error("Failed to update order");
      }

      // Update local state optimistically - order will also be updated via WebSocket
      setOrders((prev) =>
        prev.map((o) => {
          if (o.uuid === uuid && o.status === 1) {
            return {
              ...o,
              ...updates,
            };
          }
          return o;
        })
      );
    } catch (error) {
      console.error("Error updating order:", error);
      // Optionally show an error message to the user
    }
  };

  const handleCancelOrder = async (uuid: string) => {
    try {
      const order = orders.find((o) => o.uuid === uuid && o.status === 1);
      if (!order) return;

      // Call backend to close order (status=4)
      const closeOrderData = {
        uuid: order.uuid,
        origin: order.origin || "",
        escrow: order.escrow || "",
        wallet: order.wallet || "",
        asset: Number(order.asset),
        type: Number(order.type),
        ask: Number(order.ask),
        bid: Number(order.bid),
        stp: Number(order.stp),
        lmt: Number(order.lmt),
        gtd: order.gtd || "gtc",
        partial: order.partial ? "True" : "False",
        public: order.public ? "True" : "False",
        status: 4, // 4 = Closed
      };

      const response = await fetch(`${API_URL}/rec`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(closeOrderData),
      });

      if (!response.ok) {
        throw new Error("Failed to close order");
      }

      // Update local state - the order will be removed by WebSocket update
      setOrders((prev) =>
        prev.map((o) => {
          if (o.uuid === uuid && o.status === 1) {
            return { ...o, status: 4 };
          }
          return o;
        })
      );
    } catch (error) {
      console.error("Error closing order:", error);
    }
  };

  const handleFillOrder = () => {
    // This will be called after a successful fill order
    // The filled order will come via WebSocket automatically
    // Just refresh or wait for WebSocket update
  };

  // Separate orders: open orders (status=1) and filled orders (status=2)
  const { openOrders, filledOrdersMap } = useMemo(() => {
    const open: Order[] = [];
    const filled: Record<string, Order[]> = {}; // UUID -> filled orders array

    orders.forEach((order) => {
      if (order.status === 1) {
        open.push(order);
      } else if (order.status === 2) {
        // Group filled orders by parent UUID
        if (!filled[order.uuid]) {
          filled[order.uuid] = [];
        }
        filled[order.uuid].push(order);
      }
    });

    // Sort filled orders by date (newest first)
    Object.keys(filled).forEach((uuid) => {
      filled[uuid].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
      });
    });

    return { openOrders: open, filledOrdersMap: filled };
  }, [orders]);

  const sortedOrders = useMemo(() => {
    return [...openOrders].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
  }, [openOrders]);

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
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold tracking-tight">
                    HODL Exchange
                  </h1>
                  <div className="flex items-center gap-2 px-3 mt-2 py-2 rounded-lg border border-border bg-card/50">
                    {connectionState === "connected" ? (
                      <>
                        <Wifi className="h-4 w-4 text-green-500" />
                        <span className="text-xs text-muted-foreground">
                          Live
                        </span>
                      </>
                    ) : connectionState === "connecting" ? (
                      <>
                        <Wifi className="h-4 w-4 text-yellow-500 animate-pulse" />
                        <span className="text-xs text-muted-foreground">
                          Connecting...
                        </span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-4 w-4 text-red-500" />
                        <span className="text-xs text-muted-foreground">
                          Disconnected
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-muted-foreground text-sm">by Subnet118</p>
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
          prices={prices}
          filledOrdersMap={filledOrdersMap}
          onUpdateOrder={handleUpdateOrder}
          onCancelOrder={handleCancelOrder}
          onFillOrder={handleFillOrder}
          onNewOrder={() => setNewOrderModalOpen(true)}
          apiUrl={API_URL}
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
