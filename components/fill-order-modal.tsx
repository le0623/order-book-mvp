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
import { Label } from "@/components/ui/label";
import { Loader2, Copy, CheckIcon } from "lucide-react";
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

      if (orderData && typeof orderData === "object" && "data" in orderData) {
        const wsMessage = orderData as WebSocketMessage;
        if (wsMessage.data) {
          const orderItem = Array.isArray(wsMessage.data) ? wsMessage.data[0] : wsMessage.data;
          if (orderItem && orderItem.escrow === pendingEscrowRef.current && orderItem.status === -1) {
            const uuid = orderItem.uuid || wsMessage.uuid || "";
            const escrow = orderItem.escrow || "";
            if (uuid && escrow) {
              console.log("Fill Order: Received UUID and escrow from WebSocket:", { uuid, escrow });
              setOrderUuid(uuid);
              setEscrowWallet((prevEscrow) => {
                if (escrow && escrow !== prevEscrow) {
                  return escrow;
                }
                return prevEscrow;
              });
              pendingEscrowRef.current = "";
            }
          }
        }
      }
      else if (orderData && typeof orderData === "object" && "escrow" in orderData && "uuid" in orderData) {
        const orderItem = orderData as Order;
        if (orderItem.escrow === pendingEscrowRef.current && orderItem.status === -1) {
          const uuid = orderItem.uuid || "";
          const escrow = orderItem.escrow || "";
          if (uuid && escrow) {
            setOrderUuid(uuid);
            setEscrowWallet((prevEscrow) => {
              if (escrow && escrow !== prevEscrow) {
                return escrow;
              }
              return prevEscrow;
            });
            pendingEscrowRef.current = "";
          }
        }
      }
    } catch (error) {
      console.error("Error processing WebSocket message in fill order modal:", error);
    }
  }, []);

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
    const livePrice = prices[asset];
    const currentPrice =
      livePrice !== undefined && livePrice > 0 ? livePrice : order.stp;

    const fillOrderType = order.type === 1 ? 2 : 1;

    const tao = fillOrderType === 2 ? order.ask : 0;
    const alpha = fillOrderType === 1 ? order.bid : 0;
    return {
      asset: Number(order.asset),
      type: fillOrderType,
      tao: Number(tao),
      alpha: Number(alpha),
      price: Number(currentPrice),
    };
  }, [order, prices]);

  React.useEffect(() => {
    if (!open) {
      setEscrowWallet("");
      setOriginWallet("");
      setOrderUuid("");
      setWsUuid("");
      setEscrowGenerated(false);
      setError("");
      setCopiedEscrow(false);
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
        tao: 0.0, // auto fill
        alpha: 0.0, // auto fill
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
          `Server error (${response.status}): ${errorText || response.statusText
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
        tao: 0.0, // auto fill
        alpha: 0.0, // auto fill
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
          `Server error (${response.status}): ${errorText || response.statusText
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
      pendingEscrowRef.current = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[516px]">
        <DialogHeader className="flex flex-row justify-start gap-2 items-center mt-[-10px]">
          <DialogTitle>Fill Order</DialogTitle>
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
                  !escrowWallet && "text-muted-foreground italic"
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
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Asset
              </span>
              <p className="font-mono text-sm mt-1">
                {fixedValues.asset === 0 ? "—" : `SN${fixedValues.asset}`}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Price
              </span>
              <p className="font-mono text-sm mt-1">
                {fixedValues.price > 0 ? fixedValues.price.toFixed(6) : "0.00"}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Tao (Bid)
              </span>
              <p className="font-mono text-sm mt-1">
                {fixedValues.tao > 0 ? fixedValues.tao.toFixed(6) : "0.00"}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Alpha (Ask)
              </span>
              <p className="font-mono text-sm mt-1">
                {fixedValues.alpha > 0 ? fixedValues.alpha.toFixed(6) : "0.00"}
              </p>
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
