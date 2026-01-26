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
import { useWallet } from "../context/wallet-context";
import { Button } from "../components/ui/button";
import { List } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";

const getWebSocketUrl = (): string => {
  const baseUrl =
    process.env.NEXT_PUBLIC_WS_URL || "wss://api.subnet118.com/ws";
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
  const { selectedAccount } = useWallet();
  const [orders, setOrders] = useState<Order[]>([]);
  const [newOrderModalOpen, setNewOrderModalOpen] = useState(false);
  const [prices, setPrices] = useState<Record<number, number>>({});
  const [newlyAddedOrderIds, setNewlyAddedOrderIds] = useState<
    Map<string, number>
  >(new Map());
  const [showMyOrdersOnly, setShowMyOrdersOnly] = useState(false);
  const [showWalletConnectDialog, setShowWalletConnectDialog] = useState(false);

  useEffect(() => {
    // Only reset filter if wallet disconnects while filter is active
    if (!selectedAccount && showMyOrdersOnly) {
      setShowMyOrdersOnly(false);
    }
  }, [selectedAccount, showMyOrdersOnly]);

  const handleMyOrdersClick = () => {
    if (!selectedAccount) {
      setShowWalletConnectDialog(true);
      return;
    }
    setShowMyOrdersOnly(!showMyOrdersOnly);
  };

  const isTerminalStatus = (status: number) => {
    return [3, 4, 6].includes(status);
  };

  const updateOrders = useCallback((updatedOrder: Order) => {
    setOrders((prevOrders) => {
      const sameStatusIndex = prevOrders.findIndex(
        (o) => o.uuid === updatedOrder.uuid && o.status === updatedOrder.status
      );

      if (sameStatusIndex !== -1) {
        const newOrders = [...prevOrders];
        newOrders[sameStatusIndex] = updatedOrder;
        return newOrders;
      }

      const sameUuidIndex = prevOrders.findIndex(
        (o) => o.uuid === updatedOrder.uuid
      );

      if (sameUuidIndex !== -1) {
        const newOrders = [...prevOrders];
        newOrders[sameUuidIndex] = updatedOrder;
        return newOrders;
      }

      const orderId = `${updatedOrder.uuid}-${updatedOrder.status}-${updatedOrder.escrow || ""}`;
      setNewlyAddedOrderIds((prev) => {
        const next = new Map(prev);
        next.set(orderId, updatedOrder.type);
        return next;
      });

      setTimeout(() => {
        setNewlyAddedOrderIds((prev) => {
          const next = new Map(prev);
          next.delete(orderId);
          return next;
        });
      }, 2000);

      return [updatedOrder, ...prevOrders];
    });
  }, []);

  const normalizeOrder = useCallback((order: any): Order => {
    return {
      ...order,
      partial:
        order.partial === "True" ||
        order.partial === true ||
        order.partial === 1,
      public:
        order.public === "True" || order.public === true || order.public === 1,
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

      if ("data" in message && message.data !== undefined) {
        const wsMessage = message as WebSocketMessage;
        return {
          orderData: wsMessage.data!,
          messageUuid: wsMessage.uuid || "",
        };
      }

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
      const extracted = extractOrderData(message);
      if (!extracted) {
        return;
      }

      const { orderData, messageUuid } = extracted;

      if (Array.isArray(orderData)) {
        setOrders((prev) => {
          const map = new Map(prev.map((o) => [o.uuid, o]));

          for (const order of orderData) {
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

  const handlePriceMessage = useCallback((message: any) => {
    try {
      let priceData = message;
      if (typeof message === "string") {
        priceData = JSON.parse(message);
        if (typeof priceData === "string") {
          priceData = JSON.parse(priceData);
        }
      }

      if (priceData && typeof priceData === "object") {
        const priceMap: Record<number, number> = {};
        for (const [key, value] of Object.entries(priceData)) {
          const netuid = Number(key);
          let price: number;
          if (typeof value === "object" && value !== null && "price" in value) {
            price = Number((value as any).price);
          } else if (typeof value === "number") {
            price = Number(value);
          } else {
            continue;
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

  useEffect(() => {
    const fetchInitialOrders = async () => {
      try {
        const response = await fetch(`${API_URL}/sql?limit=1000`);

        if (!response.ok) {
          console.error("Failed to fetch initial orders:", response.statusText);
          return;
        }

        const data = await response.json();

        const ordersArray = typeof data === "string" ? JSON.parse(data) : data;

        if (!Array.isArray(ordersArray)) {
          console.error("Invalid orders data format");
          return;
        }

        const normalizedOrders = ordersArray
          .map((order: any) => normalizeOrder(order));

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
        status: 1,
      };

      const response = await fetch(`${API_URL}/rec`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedOrderData),
      });

      if (!response.ok) {
        throw new Error("Failed to update order");
      }

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
    }
  };

  const handleCancelOrder = async (uuid: string) => {
    try {
      const order = orders.find((o) => o.uuid === uuid && o.status === 1);
      if (!order) return;

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
        status: 3,
      };

      const response = await fetch(`${API_URL}/rec`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(closeOrderData),
      });

      if (!response.ok) {
        throw new Error("Failed to close order");
      }
    } catch (error) {
      console.error("Error closing order:", error);
    }
  };

  const handleFillOrder = () => {
  };

  const { openOrders, filledOrdersMap } = useMemo(() => {
    const open: Order[] = [];
    const filled: Record<string, Order[]> = {}; // Parent UUID -> filled orders array

    orders.forEach((order) => {
      if (order.status === 1 && order.public === true) {
        open.push(order);
      } else if (order.status === 2) {
        const parentUuid = order.origin || order.uuid;
        if (!filled[parentUuid]) {
          filled[parentUuid] = [];
        }
        filled[parentUuid].push(order);
      }
    });

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
    let filteredOrders = openOrders;
    if (showMyOrdersOnly && selectedAccount?.address) {
      filteredOrders = orders.filter(
        (order) => order.origin === selectedAccount.address
      );
    }

    const uniqueOrdersMap = new Map<string, Order>();
    filteredOrders.forEach((order) => {
      const existing = uniqueOrdersMap.get(order.uuid);
      if (!existing) {
        uniqueOrdersMap.set(order.uuid, order);
      } else {
        const existingDate = new Date(existing.date).getTime();
        const currentDate = new Date(order.date).getTime();
        if (currentDate > existingDate) {
          uniqueOrdersMap.set(order.uuid, order);
        }
      }
    });

    return Array.from(uniqueOrdersMap.values()).sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
  }, [orders, openOrders, showMyOrdersOnly, selectedAccount?.address]);

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
                  <h1 className="text-[28px] font-bold tracking-tight">
                    HODL Exchange
                  </h1>
                  <div className="flex items-center gap-2 px-3 mt-2 py-2 rounded-lg border border-border bg-card/50">
                    {connectionState === "connected" ? (
                      <>
                        <Wifi className="h-4 w-4 text-green-500" />
                        <span className="text-xs text-muted-foreground hidden md:inline">
                          Live
                        </span>
                      </>
                    ) : connectionState === "connecting" ? (
                      <>
                        <Wifi className="h-4 w-4 text-yellow-500 animate-pulse" />
                        <span className="text-xs text-muted-foreground hidden md:inline">
                          Connecting...
                        </span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-4 w-4 text-red-500" />
                        <span className="text-xs text-muted-foreground hidden md:inline">
                          Disconnected
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-0">
                  <p className="text-muted-foreground text-[16px] font-bold leading-[0.375rem]">
                    Powered by Subnet 118
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Button
                variant="outline"
                size="sm"
                onClick={handleMyOrdersClick}
                className={`gap-2 shadow-[0_2px_4px_rgba(0,0,0,0.1)] dark:shadow-none ${showMyOrdersOnly ? "bg-blue-600 hover:bg-blue-700 text-white font-semibold border-blue-600" : ""
                  }`}
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">My Orders</span>
              </Button>
              <ConnectButton />
            </div>
          </div>
        </header>

        <OrderBook
          orders={sortedOrders}
          prices={prices}
          filledOrdersMap={filledOrdersMap}
          newlyAddedOrderIds={newlyAddedOrderIds}
          allOrdersForSearch={orders}
          onUpdateOrder={handleUpdateOrder}
          onCancelOrder={handleCancelOrder}
          onFillOrder={handleFillOrder}
          onNewOrder={() => setNewOrderModalOpen(true)}
          apiUrl={API_URL}
          showMyOrdersOnly={showMyOrdersOnly}
        />

        <NewOrderModal
          open={newOrderModalOpen}
          onOpenChange={setNewOrderModalOpen}
          apiUrl={API_URL}
        />

        <Dialog open={showWalletConnectDialog} onOpenChange={setShowWalletConnectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect Wallet Required</DialogTitle>
              <DialogDescription>
                Please connect your wallet to view your orders. Click the "Wallet" button to connect.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                onClick={() => setShowWalletConnectDialog(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}

