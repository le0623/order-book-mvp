"use client";

import { OrderBook } from "../components/order-book";
import { Order } from "../lib/types";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import { ThemeToggle } from "../components/theme-toggle";
import { useTheme } from "../components/theme-provider";
import { useWebSocket } from "../hooks/useWebSocket";
import { WebSocketMessage } from "../lib/websocket-types";
import { ConnectButton } from "../components/walletkit/connect";
import { WalletModal } from "../components/walletkit/wallet-modal";
import { NewOrderModal } from "../components/new-order-modal";
import { useWallet } from "../context/wallet-context";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { getWebSocketBookUrl, getWebSocketPriceUrl, getWebSocketTapUrl, API_URL } from "../lib/config";
import { parseWsMessage } from "../lib/websocket-utils";
import { parseRecResponse, postJson, extractResponseError } from "../lib/api-utils";
import { LoadingScreen } from "../components/loading-screen";
import { PixelSymbolsBackground } from "../components/pixel-symbols-background";
import { useTMCSubnets } from "../hooks/useTMCSubnets";
import { useTaoPrice } from "../contexts/taoPrice";
import { useBlockHeight } from "../hooks/useBlockHeight";
import { MiniSpinner } from "../components/ui/mini-spinner";

const WS_URL = getWebSocketBookUrl();
const WS_PRICE_URL = getWebSocketPriceUrl();
const WS_TAP_URL = getWebSocketTapUrl();

export default function Home() {
  const { selectedAccount, walletModalOpen, closeWalletModal } = useWallet();
  // Reason: Warm the TMC subnet names cache on app load so it's ready
  // before the user opens any modal or navigates to a page that needs names.
  useTMCSubnets();
  const { theme } = useTheme();
  const { price: taoPrice, loading: taoPriceLoading } = useTaoPrice();
  const { height: blockHeight, loading: blockLoading } = useBlockHeight();
  const [mounted, setMounted] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [newOrderModalOpen, setNewOrderModalOpen] = useState(false);
  const [prices, setPrices] = useState<Record<number, number>>({});
  const [newlyAddedOrderIds, setNewlyAddedOrderIds] = useState<
    Map<string, number>
  >(new Map());
  const [showMyOrdersOnly, setShowMyOrdersOnly] = useState(false);
  const [showWalletConnectDialog, setShowWalletConnectDialog] = useState(false);
  const [ofm, setOfm] = useState<[number, number, number]>([10, 0.01, 0.001]); // [open_max, open_min, fill_min]
  const [recPopupMessage, setRecPopupMessage] = useState<string>("");
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [showLoading, setShowLoading] = useState(true);
  const headerRef = useRef<HTMLElement | null>(null);
  const [subnetNames, setSubnetNames] = useState<Record<number, string>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reason: Expose page header height as CSS variable so the order-book
  // card header can compute its own sticky offset dynamically.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => {
      const h = el.getBoundingClientRect().height;
      document.documentElement.style.setProperty("--page-header-height", `${h}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fetch OFM settings from backend
  useEffect(() => {
    const fetchOfm = async () => {
      try {
        const response = await fetch(`${API_URL}/ofm`);
        if (!response.ok) return;
        const data = await response.json();
        // Backend returns str([...]) so data is a string like "[10, 0.01, 0.001]"
        const parsed = typeof data === "string" ? JSON.parse(data) : data;
        if (Array.isArray(parsed) && parsed.length === 3) {
          setOfm([Number(parsed[0]), Number(parsed[1]), Number(parsed[2])]);
        }
      } catch (error) {
        console.error("Error fetching OFM settings:", error);
      }
    };
    fetchOfm();
  }, []);

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

  const handleLogoClick = () => {
    setShowMyOrdersOnly(false);
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
        const existingOrder = prevOrders[sameStatusIndex];
        const mergedOrder = {
          ...existingOrder,
          ...updatedOrder,
          tao: updatedOrder.tao > 0 ? updatedOrder.tao : existingOrder.tao,
          alpha: updatedOrder.alpha > 0 ? updatedOrder.alpha : existingOrder.alpha,
          price: updatedOrder.price > 0 ? updatedOrder.price : existingOrder.price,
        };

        const newOrders = [...prevOrders];
        newOrders[sameStatusIndex] = mergedOrder;
        return newOrders;
      }

      const sameUuidIndex = prevOrders.findIndex(
        (o) => o.uuid === updatedOrder.uuid
      );

      if (sameUuidIndex !== -1) {
        const existingOrder = prevOrders[sameUuidIndex];

        if (updatedOrder.status === 1 && existingOrder.status !== 1) {
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
          }, 3500);
        }

        const mergedOrder = {
          ...existingOrder,
          ...updatedOrder,
          tao: updatedOrder.tao > 0 ? updatedOrder.tao : existingOrder.tao,
          alpha: updatedOrder.alpha > 0 ? updatedOrder.alpha : existingOrder.alpha,
          price: updatedOrder.price > 0 ? updatedOrder.price : existingOrder.price,
        };

        const newOrders = [...prevOrders];
        newOrders[sameUuidIndex] = mergedOrder;
        return newOrders;
      }

      if (updatedOrder.status === 1) {
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
        }, 3500);
      }

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
      ask: Number(order.ask || 0),
      bid: Number(order.bid || 0),
      stp: Number(order.stp || 0),
      lmt: Number(order.lmt || 0),
      tao: Number(order.tao || 0),
      alpha: Number(order.alpha || 0),
      price: Number(order.price || 0),
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
    (message: WebSocketMessage | unknown) => {
      const extracted = extractOrderData(message as WebSocketMessage | Order);
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

  // /ws/price - handles all subnet prices: { netuid: { price: ... } }
  // Throttled: accumulate price updates and flush every 200ms
  const pendingPricesRef = useRef<Record<number, number>>({});
  const priceFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPrices = useCallback(() => {
    const pending = pendingPricesRef.current;
    if (Object.keys(pending).length === 0) return;
    pendingPricesRef.current = {};
    setPrices((prev) => ({ ...prev, ...pending }));
  }, []);

  const handlePriceMessage = useCallback((message: unknown) => {
    try {
      const priceData = parseWsMessage<Record<string, unknown>>(message);
      if (!priceData || typeof priceData !== "object") return;

      // Format: { subnet_name: { "0": "root", ... }, price: { "0": 1.0, ... }, tao_in, alpha_in }
      const priceObj = priceData.price;
      if (priceObj && typeof priceObj === "object" && !Array.isArray(priceObj)) {
        for (const [key, value] of Object.entries(priceObj)) {
          const netuid = Number(key);
          const price = Number(value);
          if (!isNaN(netuid) && !isNaN(price) && price > 0) {
            pendingPricesRef.current[netuid] = price;
          }
        }
      }

      const nameObj = priceData.subnet_name;
      if (nameObj && typeof nameObj === "object" && !Array.isArray(nameObj)) {
        const next: Record<number, string> = {};
        for (const [key, value] of Object.entries(nameObj)) {
          const netuid = Number(key);
          if (!isNaN(netuid) && typeof value === "string") {
            next[netuid] = value;
          }
        }
        if (Object.keys(next).length > 0) {
          setSubnetNames((prev) => ({ ...prev, ...next }));
        }
      }

      // Throttle: schedule a flush if not already pending
      if (!priceFlushTimerRef.current) {
        priceFlushTimerRef.current = setTimeout(() => {
          priceFlushTimerRef.current = null;
          flushPrices();
        }, 200);
      }
    } catch (error) {
      console.error("Error processing price message:", error);
    }
  }, [flushPrices]);

  // Cleanup price throttle timer
  useEffect(() => {
    return () => {
      if (priceFlushTimerRef.current) clearTimeout(priceFlushTimerRef.current);
    };
  }, []);

  useWebSocket({
    url: WS_PRICE_URL,
    onMessage: handlePriceMessage,
  });

  // /ws/tap - handles escrow tao, alpha, price updates: { escrow, asset, tao, alpha, price }
  // Throttled: accumulate tap updates and flush every 200ms
  const pendingTapsRef = useRef<Map<string, { tao: number; alpha: number; price: number }>>(new Map());
  const tapFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushTaps = useCallback(() => {
    const pending = new Map(pendingTapsRef.current);
    pendingTapsRef.current.clear();
    if (pending.size === 0) return;
    setOrders((prev) =>
      prev.map((order) => {
        if (order.status === 1 && order.escrow && pending.has(order.escrow)) {
          const update = pending.get(order.escrow)!;
          return { ...order, ...update };
        }
        return order;
      })
    );
  }, []);

  const handleTapMessage = useCallback((message: unknown) => {
    try {
      const tapData = parseWsMessage<{ escrow?: string; tao?: number; alpha?: number; price?: number }>(message);
      if (!tapData || typeof tapData !== "object" || !("escrow" in tapData)) return;

      const { escrow, tao, alpha, price } = tapData;
      if (escrow) {
        pendingTapsRef.current.set(escrow, {
          tao: Number(tao || 0),
          alpha: Number(alpha || 0),
          price: Number(price || 0),
        });
        // Throttle: schedule a flush if not already pending
        if (!tapFlushTimerRef.current) {
          tapFlushTimerRef.current = setTimeout(() => {
            tapFlushTimerRef.current = null;
            flushTaps();
          }, 200);
        }
      }
    } catch (error) {
      console.error("Error processing tap message:", error);
    }
  }, [flushTaps]);

  // Cleanup tap throttle timer
  useEffect(() => {
    return () => {
      if (tapFlushTimerRef.current) clearTimeout(tapFlushTimerRef.current);
    };
  }, []);

  useWebSocket({
    url: WS_TAP_URL,
    onMessage: handleTapMessage,
  });

  useEffect(() => {
    const fetchInitialOrders = async () => {
      try {
        const response = await fetch(`${API_URL}/sql?limit=1000`);

        if (!response.ok) {
          console.error("Failed to fetch initial orders:", response.statusText);
          setInitialDataLoaded(true);
          return;
        }

        const data = await response.json();

        const ordersArray = typeof data === "string" ? JSON.parse(data) : data;

        if (!Array.isArray(ordersArray)) {
          console.error("Invalid orders data format");
          setInitialDataLoaded(true);
          return;
        }

        const normalizedOrders = ordersArray
          .map((order: any) => normalizeOrder(order));

        if (normalizedOrders.length > 0) {
          setOrders(normalizedOrders);
        }
      } catch (error) {
        console.error("Error fetching initial orders:", error);
      } finally {
        setInitialDataLoaded(true);
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
        partial: order.partial ? true : false,
        public:
          updates.public !== undefined
            ? updates.public ? true : false
            : order.public ? true : false,
        tao: Number(order.tao || 0),
        alpha: Number(order.alpha || 0),
        price: Number(order.price || 0),
        status: 1,
      };

      const response = await postJson(`${API_URL}/rec`, updatedOrderData);
      if (!response.ok) throw new Error("Failed to update order");

      try {
        const data = await response.json();
        const text = typeof data === "string" ? data : JSON.stringify(data);
        const recResult = parseRecResponse(text);
        if (recResult?.message) setRecPopupMessage(recResult.message);
      } catch { /* ignore */ }

      setOrders((prev) =>
        prev.map((o) =>
          o.uuid === uuid && o.status === 1 ? { ...o, ...updates } : o
        )
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
        partial: order.partial ? true : false,
        public: order.public ? true : false,
        tao: Number(order.tao || 0),
        alpha: Number(order.alpha || 0),
        price: Number(order.price || 0),
        status: 3,
      };

      const response = await postJson(`${API_URL}/rec`, closeOrderData);
      if (!response.ok) throw new Error("Failed to close order");

      try {
        const data = await response.json();
        const text = typeof data === "string" ? data : JSON.stringify(data);
        const recResult = parseRecResponse(text);
        if (recResult?.message) setRecPopupMessage(recResult.message);
      } catch { /* ignore */ }
    } catch (error) {
      console.error("Error closing order:", error);
    }
  };

  const { openOrders, filledOrdersMap } = useMemo(() => {
    const open: Order[] = [];
    const filled: Record<string, Order[]> = {}; // Parent UUID -> filled + closed orders array

    orders.forEach((order) => {
      if (order.status === 1 && order.public === true) {
        open.push(order);
      } else if (order.status === 2 || order.status === 3) {
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
        (order) => order.wallet === selectedAccount.address
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
    <>
      {showLoading && (
        <LoadingScreen
          minDisplayTime={2400}
          isReady={initialDataLoaded && mounted}
          onComplete={() => setShowLoading(false)}
        />
      )}
    {/* 8-bit pixel symbols floating background */}
    <PixelSymbolsBackground />
    <main className="min-h-screen relative z-10">
      <div className="container mx-auto px-4 max-w-7xl pt-4">
        <header ref={headerRef} className="mb-6 sticky top-0 z-50 bg-white/80 dark:bg-background/80 backdrop-blur-md">
          {/* Primary nav row */}
          <div className="flex items-center justify-between w-full pt-6 pb-3">
            <div className="flex items-center gap-[2px]">
              <button
                onClick={handleLogoClick}
                className="px-1.5 pt-2 hover:opacity-80 transition-opacity cursor-pointer"
                aria-label="Return to main page"
              >
                <Image
                  src="/hodl-logo.png"
                  alt="HODL Exchange Logo"
                  width={50}
                  height={50}
                  className="object-contain"
                />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-[18px] font-normal tracking-tight text-foreground font-[family-name:var(--font-pixel)]">
                    HODL<span className="ml-2">Exchange</span>
                  </h1>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href="https://taomarketcap.com/subnets/118"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground text-[15px] font-medium tracking-tight leading-[0.75rem] font-[family-name:var(--font-geist-pixel-square)] hover:text-foreground transition-colors"
                  >
                    Powered by Subnet 118
                  </a>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Button
                variant="outline"
                size="sm"
                onClick={handleMyOrdersClick}
                className={`h-9 gap-2 ${showMyOrdersOnly
                  ? "bg-slate-100 dark:bg-muted border-slate-300 dark:border-border font-medium hover:bg-slate-200 dark:hover:bg-muted/80"
                  : ""
                  }`}
              >
                {mounted ? (
                  <Image
                    src={theme === "light" ? "/myorders-light.png" : "/myorders-black.png"}
                    alt="My Orders"
                    width={32}
                    height={32}
                    className="w-[1.375rem] h-[1.375rem]"
                  />
                ) : (
                  <Image
                    src="/myorders-light.png"
                    alt="My Orders"
                    width={32}
                    height={32}
                    className="w-[1.375rem] h-[1.375rem]"
                  />
                )}
                <span className="hidden sm:inline">My Orders</span>
              </Button>
              <ConnectButton />
            </div>
          </div>

          {/* Stats ticker strip */}
          <div className="flex items-center gap-6 pb-3 border-b border-slate-200 dark:border-border/40 overflow-x-auto scrollbar-hide">
            {/* TAO Price */}
            <a
              href="https://taomarketcap.com/subnets/0"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 shrink-0 hover:opacity-70 transition-opacity"
            >
              {taoPriceLoading ? (
                <>
                  <span className="text-[12px] font-mono font-medium tracking-tight text-foreground tabular-nums">τ</span>
                  <MiniSpinner size={12} className="text-muted-foreground" />
                </>
              ) : (
                <span className="text-[12px] font-mono font-medium tracking-tight text-foreground tabular-nums">
                  {taoPrice !== null
                    ? `τ $${taoPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "τ —"}
                </span>
              )}
            </a>

            {/* Separator */}
            <div className="w-px h-3 bg-border/60 shrink-0" />

            {/* Block Height */}
            <a
              href="https://taomarketcap.com/blockchain/blocks"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 shrink-0 hover:opacity-70 transition-opacity"
            >
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Block
              </span>
              {blockLoading ? (
                <MiniSpinner size={12} className="text-muted-foreground" />
              ) : (
                <span className="text-[12px] font-mono font-medium tracking-tight text-foreground tabular-nums">
                  {blockHeight !== null
                    ? `#${blockHeight.toLocaleString()}`
                    : "—"}
                </span>
              )}
            </a>

            {/* Separator */}
            <div className="w-px h-3 bg-border/60 shrink-0" />

            {/* Connection status dot */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div
                className={`w-[6px] h-[6px] rounded-full ${
                  connectionState === "connected"
                    ? "bg-emerald-500 status-dot-live"
                    : connectionState === "connecting"
                      ? "bg-amber-500 status-dot-connecting"
                      : "bg-red-500 status-dot-offline"
                }`}
              />
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                {connectionState === "connected"
                  ? "Live"
                  : connectionState === "connecting"
                    ? "Connecting"
                    : "Offline"}
              </span>
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
          onFillOrder={undefined}
          onRecMessage={setRecPopupMessage}
          onNewOrder={() => setNewOrderModalOpen(true)}
          apiUrl={API_URL}
          showMyOrdersOnly={showMyOrdersOnly}
          walletAddress={selectedAccount?.address}
          connectionState={connectionState}
        />

        <NewOrderModal
          open={newOrderModalOpen}
          onOpenChange={setNewOrderModalOpen}
          onRecMessage={setRecPopupMessage}
          apiUrl={API_URL}
          prices={prices}
          ofm={ofm}
          subnetNames={subnetNames}
        />

        <Dialog open={showWalletConnectDialog} onOpenChange={setShowWalletConnectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect Wallet Required</DialogTitle>
              <DialogDescription>
                Please connect your wallet to view your orders. Click the Wallet button to connect.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                onClick={() => setShowWalletConnectDialog(false)}
                variant="outline"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <WalletModal open={walletModalOpen} onOpenChange={closeWalletModal} />

        {/* Standalone popup for /rec messages (e.g. status 3 / order closed) */}
        <Dialog open={!!recPopupMessage} onOpenChange={(open) => { if (!open) setRecPopupMessage(""); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Order closed</DialogTitle>
              <DialogDescription>{recPopupMessage}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setRecPopupMessage("")} variant="outline">
                OK
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
    </>
  );
}

