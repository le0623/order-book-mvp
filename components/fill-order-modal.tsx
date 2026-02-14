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
import { parseWsMessage } from "@/lib/websocket-utils";
import { postJson, extractResponseError, readResponseBody } from "@/lib/api-utils";
import { useBittensorTransfer } from "@/hooks/useBittensorTransfer";
import { resolveHotkey } from "@/lib/bittensor";

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
  const {
    sendTao,
    sendAlpha,
    status: transferStatus,
    statusMessage: transferStatusMessage,
    error: transferError,
    isTransferring,
    reset: resetTransfer,
  } = useBittensorTransfer();
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
  const [transferInputMode, setTransferInputMode] = React.useState<"alpha" | "tao">("tao");
  const [liveParentPrice, setLiveParentPrice] = React.useState<{
    tao: number;
    alpha: number;
    price: number;
  } | null>(null);
  const [poolData, setPoolData] = React.useState<Record<number, { tao_in: number; alpha_in: number }>>({});

  const pendingEscrowRef = React.useRef<string>("");

  const WS_URL = React.useMemo(() => {
    return getWebSocketBookUrl();
  }, []);

  const handleWebSocketMessage = React.useCallback((message: WebSocketMessage | unknown) => {
    try {
      const orderData = parseWsMessage<Record<string, unknown>>(message);
      if (!orderData || typeof orderData !== "object") return;

      const processOrderItem = (item: Record<string, unknown>) => {
        if (!item || typeof item !== "object") return;

        if (item.escrow === pendingEscrowRef.current && item.status === -1) {
          const uuid = String(item.uuid || "");
          const escrow = String(item.escrow || "");
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

      if ("data" in orderData) {
        const wsMessage = orderData as WebSocketMessage;
        if (wsMessage.data) {
          const item = Array.isArray(wsMessage.data) ? wsMessage.data[0] : wsMessage.data;
          processOrderItem(item as unknown as Record<string, unknown>);
        }
      } else if ("escrow" in orderData) {
        processOrderItem(orderData);
      }
    } catch (error) {
      console.error("Error processing WebSocket message in fill order modal:", error);
    }
  }, [order.escrow]);

  const handleUuidReceived = React.useCallback((uuid: string) => {
    setWsUuid(uuid);
  }, []);

  useWebSocket({
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

  const priceForConversion = fixedValues.price > 0 ? fixedValues.price : 0;
  const getAlphaForSubmit = (): number => {
    if (fixedValues.type !== 1) return 0;
    if (transferInputMode === "alpha") return transferAlpha ?? 0;
    const raw = transferTao ?? 0;
    if (priceForConversion > 0) return raw / priceForConversion;
    return 0;
  };
  const getTaoForSubmit = (): number => {
    if (fixedValues.type !== 2) return 0;
    if (transferInputMode === "tao") return transferTao ?? 0;
    const raw = transferAlpha ?? 0;
    if (priceForConversion > 0) return raw * priceForConversion;
    return 0;
  };

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
      setTransferInputMode("tao");
      setPoolData({});
      pendingEscrowRef.current = "";
    }
  }, [open]);

  React.useEffect(() => {
    if (open) {
      setTransferInputMode(fixedValues.type === 2 ? "tao" : "alpha");
    }
  }, [open, fixedValues.type]);

  // Fetch pool data (tao_in, alpha_in) for slippage when modal opens
  React.useEffect(() => {
    if (!open) return;
    const backendUrl = apiUrl || API_URL;
    const fetchPools = async () => {
      try {
        const response = await fetch(`${backendUrl}/price`);
        if (!response.ok) return;
        let data = await response.json();
        if (typeof data === "string") data = JSON.parse(data);
        if (!Array.isArray(data)) return;
        const pools: Record<number, { tao_in: number; alpha_in: number }> = {};
        data.forEach((item: unknown, index: number) => {
          if (typeof item === "object" && item !== null) {
            const obj = item as { tao_in?: number; alpha_in?: number };
            const taoIn = Number(obj.tao_in);
            const alphaIn = Number(obj.alpha_in);
            if (!isNaN(taoIn) && !isNaN(alphaIn) && taoIn > 0 && alphaIn > 0) {
              pools[index] = { tao_in: taoIn, alpha_in: alphaIn };
            }
          }
        });
        if (Object.keys(pools).length > 0) setPoolData(pools);
      } catch (err) {
        console.warn("[FillOrder] Failed to fetch pool data:", err);
      }
    };
    fetchPools();
  }, [open, apiUrl]);

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
        tao: getTaoForSubmit(),
        alpha: getAlphaForSubmit(),
        price: 0.0, // auto fill
        status: -1, // -1 = Init status (triggers escrow generation in backend)
      };

      console.log("Fill Order: Creating escrow with UUID:", wsUuid);

      const backendUrl = apiUrl || API_URL;
      const response = await postJson(`${backendUrl}/rec`, orderData);

      if (!response.ok) {
        throw new Error(await extractResponseError(response));
      }

      const data = await readResponseBody(response);

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
        const obj = data as Record<string, unknown>;
        escrowAddress = String(obj.escrow || "");
        originAddress = String(obj.origin || "");
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
    } catch (err) {
      console.error("Error creating escrow:", err);
      setError(err instanceof Error ? err.message : "Failed to create escrow");
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
      resetTransfer();

      const walletAddress = selectedAccount?.address || "";

      const finalUuid = orderUuid || wsUuid;
      if (!finalUuid || !escrowWallet) {
        throw new Error("Missing order UUID or escrow wallet address");
      }

      // --- Step 1: On-chain transfer to escrow ---
      // Fill order type is the opposite of the parent order type
      // If parent is Sell (type=1), fill is Buy (type=2) → transfer TAO
      // If parent is Buy (type=2), fill is Sell (type=1) → transfer Alpha
      if (isConnected && selectedAccount) {
        if (fixedValues.type === 2) {
          // Fill is Buy: transfer TAO
          const taoAmount = getTaoForSubmit();
          if (taoAmount > 0) {
            console.log(`[FillOrder] Transferring ${taoAmount} TAO to escrow ${escrowWallet}`);
            const txResult = await sendTao(escrowWallet, taoAmount);
            if (!txResult) {
              throw new Error("TAO transfer to escrow failed or was cancelled. Order not filled.");
            }
            console.log(`[FillOrder] TAO transfer confirmed: ${txResult.txHash}`);
          }
        } else if (fixedValues.type === 1) {
          // Fill is Sell: transfer Alpha
          const alphaAmount = getAlphaForSubmit();
          if (alphaAmount > 0 && fixedValues.asset > 0) {
            // Check hotkey exists before attempting transfer
            const hotkey = await resolveHotkey(selectedAccount.address, fixedValues.asset);
            if (!hotkey) {
              throw new Error("No hotkey.");
            }

            console.log(`[FillOrder] Transferring ${alphaAmount} Alpha (netuid ${fixedValues.asset}) to escrow ${escrowWallet}`);
            const txResult = await sendAlpha(escrowWallet, alphaAmount, fixedValues.asset);
            if (!txResult) {
              const reason = transferError || "Alpha transfer failed.";
              resetTransfer();
              throw new Error(reason);
            }
            console.log(`[FillOrder] Alpha transfer confirmed: ${txResult.txHash}`);
          }
        }
      }

      // --- Step 2: Submit fill order to backend ---
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
        tao: getTaoForSubmit(),
        alpha: getAlphaForSubmit(),
        price: 0.0, // auto fill
        status: 2,
      };

      const backendUrl = apiUrl || API_URL;
      const response = await postJson(`${backendUrl}/rec`, fillOrderData);

      if (!response.ok) {
        throw new Error(await extractResponseError(response));
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
      resetTransfer();
    } catch (err) {
      console.error("Error filling order:", err);
      setError(err instanceof Error ? err.message : "Failed to fill order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading && !isTransferring) {
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
      resetTransfer();
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
            className={`p-3 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm transition-all duration-300 ease-in-out ${errorVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 -translate-y-2 pointer-events-none"
              }`}
          >
            {error}
          </div>
        )}

        {/* On-chain transfer status indicator */}
        {isTransferring && (
          <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            <span>{transferStatusMessage || "Processing on-chain transfer..."}</span>
          </div>
        )}
        {transferError && !isTransferring && (
          <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm">
            {transferError}
          </div>
        )}
        {transferStatus === "finalized" && !isTransferring && (
          <div className="p-3 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 text-sm">
            Transfer confirmed on-chain. Submitting fill order...
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
            {escrowWallet &&
              (fixedValues.type === 2 ? getTaoForSubmit() > 0 : getAlphaForSubmit() > 0) && (
                <p className="text-sm text-muted-foreground opacity-60">
                  {fixedValues.type === 2 ? (
                    <>{getTaoForSubmit().toFixed(4)} TAO will be transferred to escrow</>
                  ) : (
                    <>{getAlphaForSubmit().toFixed(2)} Alpha will be transferred to escrow</>
                  )}
                  {poolData[fixedValues.asset] && (() => {
                    const pool = poolData[fixedValues.asset];
                    const price = priceForConversion;
                    if (!pool || price <= 0) return null;
                    let slippage = 0;
                    if (fixedValues.type === 1) {
                      const alpha = getAlphaForSubmit();
                      if (alpha <= 0) return null;
                      const cost = alpha * price;
                      const received = pool.tao_in * alpha / (pool.alpha_in + alpha);
                      if (cost > 0) slippage = (cost - received) / cost * 100;
                    } else if (fixedValues.type === 2) {
                      const tao = getTaoForSubmit();
                      if (tao <= 0) return null;
                      const stake = tao;
                      const receivedAlpha = pool.alpha_in * tao / (pool.tao_in + tao);
                      const received = receivedAlpha * price;
                      if (stake > 0) slippage = (stake - received) / stake * 100;
                    }
                    if (slippage <= 0) return null;
                    return <> Slippage savings: {slippage.toFixed(2)}%</>;
                  })()}
                </p>
              )}
          </div>
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="transfer-amount">
                {transferInputMode === "tao" ? "Order Size in TAO" : "Order Size in Alpha"}
              </Label>
              <button
                type="button"
                onClick={() => {
                  if (escrowGenerated) return;
                  if (transferInputMode === "tao") {
                    const v = transferTao ?? transferAlpha;
                    setTransferAlpha(v);
                    setTransferInputMode("alpha");
                  } else {
                    const v = transferAlpha ?? transferTao;
                    setTransferTao(v);
                    setTransferInputMode("tao");
                  }
                }}
                disabled={escrowGenerated}
                className="h-[1.5rem] w-[2rem] flex items-center rounded-md justify-center border border-slate-200 dark:border-border/60 bg-white dark:bg-card/50 shadow-sm hover:bg-slate-50 dark:hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                aria-label="Switch between TAO and Alpha"
                title="Switch unit (TAO ↔ Alpha)"
              >
                <span className="text-xs">τ/α</span>
              </button>
            </div>
            <div className="relative flex items-center">
              <Input
                id="transfer-amount"
                type="number"
                min="0"
                step="0.001"
                value={(transferInputMode === "tao" ? transferTao : transferAlpha) ?? ""}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  const parsed = parseFloat(value);
                  const v = value === "" ? undefined : (isNaN(parsed) ? undefined : parsed);
                  if (transferInputMode === "tao") {
                    setTransferTao(v);
                  } else {
                    setTransferAlpha(v);
                  }
                }}
                disabled={escrowGenerated}
                placeholder={transferInputMode === "tao" ? "Enter TAO amount" : "Enter Alpha amount"}
                className="focus-visible:ring-1 focus-visible:ring-blue-500/30 focus-visible:ring-offset-0 focus-visible:border-blue-500/40 pr-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <div className="absolute right-1 flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!escrowGenerated) {
                      const current = (transferInputMode === "tao" ? transferTao : transferAlpha) ?? 0;
                      const newVal = Number((current + 0.001).toFixed(3));
                      if (transferInputMode === "tao") {
                        setTransferTao(newVal);
                      } else {
                        setTransferAlpha(newVal);
                      }
                    }
                  }}
                  disabled={escrowGenerated}
                  className="h-4 w-6 flex items-center justify-center rounded-sm border border-border bg-background hover:bg-muted active:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label={transferInputMode === "tao" ? "Increase TAO amount" : "Increase alpha amount"}
                >
                  <ChevronUp className="h-3 w-3 text-muted-foreground" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!escrowGenerated) {
                      const current = (transferInputMode === "tao" ? transferTao : transferAlpha) ?? 0;
                      const newValue = Math.max(0, Number((current - 0.001).toFixed(3)));
                      if (transferInputMode === "tao") {
                        setTransferTao(newValue > 0 ? newValue : undefined);
                      } else {
                        setTransferAlpha(newValue > 0 ? newValue : undefined);
                      }
                    }
                  }}
                  disabled={escrowGenerated}
                  className="h-4 w-6 flex items-center justify-center rounded-sm border border-border bg-background hover:bg-muted active:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label={transferInputMode === "tao" ? "Decrease TAO amount" : "Decrease alpha amount"}
                >
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
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

          
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading || isTransferring}>
            Cancel
          </Button>
          <Button
            onClick={handleFillOrder}
            disabled={loading || isTransferring}
            variant="outline"
          >
            {(loading || isTransferring) ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isTransferring ? "Transferring..." : escrowGenerated ? "Filling..." : "Creating Escrow..."}
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
