"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Copy, CheckIcon, ChevronUp, ChevronDown } from "lucide-react";
import { Order } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useWallet } from "@/context/wallet-context";
import { useWebSocket } from "@/hooks/useWebSocket";
import { WebSocketMessage } from "@/lib/websocket-types";
import { getWebSocketBookUrl, API_URL } from "@/lib/config";
import { ConnectButton } from "@/components/walletkit/connect";

interface FillOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  prices?: Record<number, number>; // netuid -> price mapping for live prices
  apiUrl?: string;
  onOrderFilled?: () => void;
}

export function FillOrderModal({
  open,
  onOpenChange,
  order,
  prices = {},
  apiUrl,
  onOrderFilled,
}: FillOrderModalProps) {
  const { selectedAccount, isConnected } = useWallet();
  const [escrowWallet, setEscrowWallet] = React.useState<string>("");
  const [originWallet, setOriginWallet] = React.useState<string>("");
  const [orderUuid, setOrderUuid] = React.useState<string>("");
  const [wsUuid, setWsUuid] = React.useState<string>(""); // WebSocket connection UUID from backend
  const [escrowGenerated, setEscrowGenerated] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  const [errorVisible, setErrorVisible] = React.useState(false);
  const [copiedEscrow, setCopiedEscrow] = React.useState(false);
  const [transferAlpha, setTransferAlpha] = React.useState<number | undefined>(undefined);
  const [transferTao, setTransferTao] = React.useState<number | undefined>(undefined);
  const [liveParentPrice, setLiveParentPrice] = React.useState<{
    tao: number;
    alpha: number;
    price: number;
  } | null>(null);

  const pendingEscrowRef = React.useRef<string>("");

  const WS_URL = React.useMemo(() => {
    return getWebSocketBookUrl();
  }, []);

  const handleWebSocketMessage = React.useCallback((message: WebSocketMessage | any) => {
    try {
      let orderData: any = message;
      if (typeof message === "string") {
        try {
          orderData = JSON.parse(message);
          if (typeof orderData === "string") {
            orderData = JSON.parse(orderData);
          }
        } catch {
          return;
        }
      }

      const processOrderItem = (item: any) => {
        if (!item || typeof item !== "object") return;

        if (item.escrow === pendingEscrowRef.current && item.status === -1) {
          const uuid = item.uuid || "";
          const escrow = item.escrow || "";
          if (uuid && escrow) {
            setOrderUuid(uuid);
            setEscrowWallet((prev) => (escrow && escrow !== prev ? escrow : prev));
            pendingEscrowRef.current = "";
          }
        }

        if (item.escrow === order.escrow && item.status === 1) {
          const tao = Number(item.tao || 0);
          const alpha = Number(item.alpha || 0);
          const price = Number(item.price || 0);
          if (price > 0) {
            setLiveParentPrice({ tao, alpha, price });
          }
        }
      };

      if (orderData && typeof orderData === "object" && "data" in orderData) {
        const wsMessage = orderData as WebSocketMessage;
        if (wsMessage.data) {
          const item = Array.isArray(wsMessage.data) ? wsMessage.data[0] : wsMessage.data;
          processOrderItem(item);
        }
      } else if (orderData && typeof orderData === "object" && "escrow" in orderData) {
        processOrderItem(orderData);
      }
    } catch (error) {
      console.error("Error processing WebSocket message in fill order modal:", error);
    }
  }, [order.escrow]);

  const handleUuidReceived = React.useCallback((uuid: string) => {
    setWsUuid(uuid);
  }, []);

  const { connectionState: wsConnectionState } = useWebSocket({
    url: WS_URL,
    onMessage: handleWebSocketMessage,
    onUuidReceived: handleUuidReceived,
    enabled: open,
  });

  React.useEffect(() => {
    if (error) {
      setErrorVisible(true);
      const fadeOutTimer = setTimeout(() => {
        setErrorVisible(false);
        setTimeout(() => {
          setError("");
        }, 300);
      }, 6000);

      return () => {
        clearTimeout(fadeOutTimer);
      };
    } else {
      setErrorVisible(false);
    }
  }, [error]);

  const fixedValues = React.useMemo(() => {
    const asset = Number(order.asset);
    const fillOrderType = order.type === 1 ? 2 : 1;

    const parentTao = liveParentPrice?.tao ?? Number(order.tao || 0);
    const parentAlpha = liveParentPrice?.alpha ?? Number(order.alpha || 0);
    const parentPrice = liveParentPrice?.price ??
      (order.price > 0 ? order.price : (prices[asset] > 0 ? prices[asset] : order.stp));

    return {
      asset,
      type: fillOrderType,
      tao: parentTao,
      alpha: parentAlpha,
      price: Number(parentPrice),
    };
  }, [order, prices, liveParentPrice]);

  React.useEffect(() => {
    if (!open) {
      setEscrowWallet("");
      setOriginWallet("");
      setOrderUuid("");
      setWsUuid("");
      setEscrowGenerated(false);
      setError("");
      setCopiedEscrow(false);
      setLiveParentPrice(null);
      setTransferAlpha(undefined);
      setTransferTao(undefined);
      pendingEscrowRef.current = "";
    }
  }, [open]);

  const copyEscrowToClipboard = async () => {
    if (!escrowWallet) return;
    try {
      await navigator.clipboard.writeText(escrowWallet);
      setCopiedEscrow(true);
      setTimeout(() => setCopiedEscrow(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleCreateEscrow = async () => {
    try {
      setLoading(true);
      setError("");

      const walletAddress = selectedAccount?.address || "";

      if (!wsUuid) {
        throw new Error("WebSocket connection UUID not available. Please wait for connection.");
      }

      const orderData = {
        uuid: wsUuid,
        origin: "",
        escrow: "",
        wallet: walletAddress,
        asset: fixedValues.asset,
        type: fixedValues.type,
        ask: fixedValues.alpha,
        bid: fixedValues.tao,
        stp: fixedValues.price,
        lmt: fixedValues.price,
        gtd: "gtc", // No GTD for filled orders
        partial: false, // No partial for filled orders
        public: false, // No public flag for filled orders
        alpha: fixedValues.type === 1 ? Number(transferAlpha ?? 0) : 0.0,
        tao: fixedValues.type === 2 ? Number(transferTao ?? 0) : 0.0,
        price: 0.0, // auto fill
        status: -1, // -1 = Init status (triggers escrow generation in backend)
      };

      console.log("Fill Order: Creating escrow with UUID:", wsUuid);

      const backendUrl = apiUrl || API_URL;
      const response = await fetch(`${backendUrl}/rec`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      }).catch((error) => {
        if (error.message === "Failed to fetch") {
          throw new Error(
            "Cannot connect to server. This may be due to network issues or the server being unavailable."
          );
        }
        throw error;
      });

      if (!response.ok) {
        let errorText: string;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          try {
            const errorData = await response.json();
            errorText =
              typeof errorData === "string"
                ? errorData
                : JSON.stringify(errorData);
          } catch {
            errorText = await response.text();
          }
        } else {
          errorText = await response.text();
        }
        throw new Error(
          `Error (${response.status}): ${errorText || response.statusText
          }`
        );
      }

      let data: any;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        try {
          data = await response.json();
        } catch {
          const text = await response.text();
          data = text;
        }
      } else {
        const text = await response.text();
        data = text;
      }

      let escrowAddress = "";
      let originAddress = "";

      // Backend returns escrow address as plain string for status=-1
      if (typeof data === "string" && data.trim().length > 0) {
        escrowAddress = data.trim();
        console.log("Fill Order: Received escrow address from response:", escrowAddress);
      } else if (Array.isArray(data) && data.length > 0) {
        escrowAddress = data[0].escrow || "";
        originAddress = data[0].origin || "";
      } else if (data && typeof data === "object") {
        escrowAddress = data.escrow || "";
        originAddress = data.origin || "";
      }

      if (!escrowAddress) {
        throw new Error("Failed to create escrow wallet. Please try again.");
      }

      // Store the pending escrow to match against WebSocket messages
      pendingEscrowRef.current = escrowAddress;

      setEscrowWallet(escrowAddress);
      setOriginWallet(originAddress || escrowAddress);
      setOrderUuid(wsUuid);
      setEscrowGenerated(true);
    } catch (err: any) {
      console.error("Error creating escrow:", err);
      setError(err.message || "Failed to create escrow");
    } finally {
      setLoading(false);
    }
  };

  const handleFillOrder = async () => {
    if (!escrowGenerated) {
      await handleCreateEscrow();
      return;
    }

    try {
      setLoading(true);
      setError("");

      const walletAddress = selectedAccount?.address || "";

      const finalUuid = orderUuid || wsUuid;
      if (!finalUuid || !escrowWallet) {
        throw new Error("Missing order UUID or escrow wallet address");
      }

      const fillOrderData = {
        uuid: finalUuid,
        origin: order.escrow,
        escrow: escrowWallet,
        wallet: walletAddress,
        asset: fixedValues.asset,
        type: fixedValues.type,
        ask: fixedValues.alpha,
        bid: fixedValues.tao,
        stp: fixedValues.price,
        lmt: fixedValues.price,
        gtd: "gtc",
        partial: false,
        public: false,
        alpha: fixedValues.type === 1 ? Number(transferAlpha ?? 0) : 0.0,
        tao: fixedValues.type === 2 ? Number(transferTao ?? 0) : 0.0,
        price: 0.0, // auto fill
        status: 2,
      };

      const backendUrl = apiUrl || API_URL;
      const response = await fetch(`${backendUrl}/rec`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fillOrderData),
      }).catch((error) => {
        if (error.message === "Failed to fetch") {
          throw new Error(
            "Cannot connect to server. This may be due to network issues or the server being unavailable."
          );
        }
        throw error;
      });

      if (!response.ok) {
        let errorText: string;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          try {
            const errorData = await response.json();
            errorText =
              typeof errorData === "string"
                ? errorData
                : JSON.stringify(errorData);
          } catch {
            errorText = await response.text();
          }
        } else {
          errorText = await response.text();
        }
        throw new Error(
          `Error (${response.status}): ${errorText || response.statusText
          }`
        );
      }

      onOrderFilled?.();
      onOpenChange(false);
      setEscrowWallet("");
      setOriginWallet("");
      setOrderUuid("");
      setWsUuid("");
      setEscrowGenerated(false);
      setError("");
      setTransferAlpha(undefined);
      setTransferTao(undefined);
      pendingEscrowRef.current = "";
    } catch (err: any) {
      console.error("Error filling order:", err);
      setError(err.message || "Failed to fill order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false);
      setEscrowWallet("");
      setOriginWallet("");
      setOrderUuid("");
      setWsUuid("");
      setEscrowGenerated(false);
      setError("");
      setLiveParentPrice(null);
      setTransferAlpha(undefined);
      setTransferTao(undefined);
      pendingEscrowRef.current = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[516px]">
        <DialogHeader className="flex flex-row justify-start gap-2 items-center mt-[-10px]">
          <div className="mt-[3px]">
            <DialogTitle>Fill Order</DialogTitle>
          </div>
          <ConnectButton />
        </DialogHeader>

        {error && (
          <div
            className={`p-3 rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 text-sm transition-all duration-300 ease-in-out ${errorVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-2 pointer-events-none"
              }`}
          >
            {error}
          </div>
        )}

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="escrow">Escrow Wallet Address</Label>
            <div className="flex items-center gap-2">
              <code
                className={cn(
                  "flex-1 font-mono p-2 rounded-md border bg-background whitespace-nowrap overflow-x-auto",
                  !escrowWallet && "opacity-60 text-muted-foreground italic"
                )}
                style={{ fontSize: "0.875rem" }}
              >
                {escrowWallet || "To be created…"}
              </code>
              {escrowWallet && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0 bg-transparent border-transparent hover:bg-transparent hover:border-transparent"
                  onClick={copyEscrowToClipboard}
                >
                  {copiedEscrow ? (
                    <CheckIcon className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-muted-foreground/80">
                Asset
              </span>
              <p className="font-mono text-sm mt-1">
                {fixedValues.asset === 0 ? "—" : `SN${fixedValues.asset}`}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-muted-foreground/80">
                Price
              </span>
              <p className="font-mono text-sm mt-1">
                {fixedValues.price > 0 ? fixedValues.price.toFixed(6) : "0.00"}
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="transfer-amount">
              {fixedValues.type === 2 ? "Transfer TAO" : "Transfer Alpha"}
            </Label>
            <div className="relative flex items-center">
              <Input
                id="transfer-amount"
                type="number"
                min="0"
                step="0.001"
                value={
                  fixedValues.type === 2
                    ? (transferTao === undefined ? "" : transferTao)
                    : (transferAlpha === undefined ? "" : transferAlpha)
                }
                onChange={(e) => {
                  const value = e.target.value.trim();
                  if (value === "" || value === null || value === undefined) {
                    if (fixedValues.type === 2) {
                      setTransferTao(undefined);
                    } else {
                      setTransferAlpha(undefined);
                    }
                  } else {
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue)) {
                      if (fixedValues.type === 2) {
                        setTransferTao(numValue);
                      } else {
                        setTransferAlpha(numValue);
                      }
                    } else {
                      if (fixedValues.type === 2) {
                        setTransferTao(undefined);
                      } else {
                        setTransferAlpha(undefined);
                      }
                    }
                  }
                }}
                disabled={escrowGenerated}
                placeholder={fixedValues.type === 2 ? "Enter TAO amount" : "Enter alpha amount"}
                className="focus-visible:ring-1 focus-visible:ring-blue-500/30 focus-visible:ring-offset-0 focus-visible:border-blue-500/40 pr-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <div className="absolute right-1 flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!escrowGenerated) {
                      const field = fixedValues.type === 2 ? "tao" : "alpha";
                      const current = (fixedValues.type === 2 ? transferTao : transferAlpha) ?? 0;
                      if (field === "tao") {
                        setTransferTao(Number((current + 0.001).toFixed(3)));
                      } else {
                        setTransferAlpha(Number((current + 0.001).toFixed(3)));
                      }
                    }
                  }}
                  disabled={escrowGenerated}
                  className="h-4 w-6 flex items-center justify-center rounded-sm border border-border bg-background hover:bg-muted active:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label={fixedValues.type === 2 ? "Increase TAO amount" : "Increase alpha amount"}
                >
                  <ChevronUp className="h-3 w-3 text-muted-foreground" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!escrowGenerated) {
                      const field = fixedValues.type === 2 ? "tao" : "alpha";
                      const current = (fixedValues.type === 2 ? transferTao : transferAlpha) ?? 0;
                      const newValue = Math.max(0, Number((current - 0.001).toFixed(3)));
                      if (field === "tao") {
                        setTransferTao(newValue > 0 ? newValue : undefined);
                      } else {
                        setTransferAlpha(newValue > 0 ? newValue : undefined);
                      }
                    }
                  }}
                  disabled={escrowGenerated}
                  className="h-4 w-6 flex items-center justify-center rounded-sm border border-border bg-background hover:bg-muted active:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label={fixedValues.type === 2 ? "Decrease TAO amount" : "Decrease alpha amount"}
                >
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleFillOrder}
            disabled={loading}
            variant="outline"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {escrowGenerated ? "Filling..." : "Creating Escrow..."}
              </>
            ) : escrowGenerated ? (
              "Fill Order"
            ) : (
              "Create Escrow"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
