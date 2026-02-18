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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  CalendarIcon,
  Loader2,
  Copy,
  CheckIcon,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import { NewOrderFormData, Order } from "@/lib/types";
import { useWallet } from "@/context/wallet-context";
import { useWebSocket } from "@/hooks/useWebSocket";
import { WebSocketMessage } from "@/lib/websocket-types";
import { getWebSocketBookUrl, getWebSocketTapUrl, API_URL } from "@/lib/config";
import { ConnectButton } from "@/components/walletkit/connect";
import { parseWsMessage } from "@/lib/websocket-utils";
import { postJson, extractResponseError, readResponseBody, parseRecResponse } from "@/lib/api-utils";
import { useBittensorTransfer } from "@/hooks/useBittensorTransfer";
import { resolveHotkey } from "@/lib/bittensor";


interface NewOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderPlaced?: () => void;
  onRecMessage?: (message: string) => void; // e.g. status 3 / order closed — show in standalone page popup
  apiUrl?: string;
  prices?: Record<number, number>;
  ofm?: [number, number, number]; // [open_max, open_min, fill_min]
  subnetNames?: Record<number, string>; // netuid -> subnet name from ws/price
}

export function NewOrderModal({
  open,
  onOpenChange,
  onOrderPlaced,
  onRecMessage,
  apiUrl,
  prices = {},
  ofm = [10, 0.01, 0.001],
  subnetNames = {},
}: NewOrderModalProps) {
  const { selectedAccount, isConnected } = useWallet();
  const {
    sendTao,
    sendAlpha,
    status: transferStatus,
    statusMessage: transferStatusMessage,
    isTransferring,
    reset: resetTransfer,
  } = useBittensorTransfer();
  const [formData, setFormData] = React.useState<NewOrderFormData>({
    type: undefined,
    alpha: undefined,
    tao: undefined,
    asset: undefined,
    gtd: "gtc",
    stp: undefined,
    partial: true,
    public: true,
  });
  const [escrowWallet, setEscrowWallet] = React.useState<string>("");
  const [originWallet, setOriginWallet] = React.useState<string>("");
  const [orderUuid, setOrderUuid] = React.useState<string>("");
  const [wsUuid, setWsUuid] = React.useState<string>(""); // WebSocket connection UUID from backend
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  const [errorVisible, setErrorVisible] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    undefined
  );
  const [escrowGenerated, setEscrowGenerated] = React.useState(false);
  const [copiedEscrow, setCopiedEscrow] = React.useState(false);
  const [showReviewButtons, setShowReviewButtons] = React.useState(false);
  const [showPaymentButtons, setShowPaymentButtons] = React.useState(false);
  const [isInReviewMode, setIsInReviewMode] = React.useState(false);
  const [priceData, setPriceData] = React.useState<{
    tao: number;
    alpha: number;
    price: number;
  } | null>(null);
  const [transferInputMode, setTransferInputMode] = React.useState<"alpha" | "tao">("tao");
  const [httpPrices, setHttpPrices] = React.useState<Record<number, number>>({});
  const [poolData, setPoolData] = React.useState<Record<number, { tao_in: number; alpha_in: number }>>({});

  const [assetInputEditing, setAssetInputEditing] = React.useState<string | null>(null);
  const pendingEscrowRef = React.useRef<string>("");

  const WS_URL = React.useMemo(() => {
    return getWebSocketBookUrl();
  }, []);

  const WS_TAP_URL = React.useMemo(() => {
    return getWebSocketTapUrl();
  }, []);

  const handleWebSocketMessage = React.useCallback((message: WebSocketMessage | unknown) => {
    try {
      const orderData = parseWsMessage<Record<string, unknown>>(message);
      if (!orderData || typeof orderData !== "object") return;

      // Extract the order item from either nested or flat format
      const processInit = (item: Partial<Order> & { uuid?: string; escrow?: string; status?: number }) => {
        if (item.escrow === pendingEscrowRef.current && item.status === -1) {
          const uuid = item.uuid || "";
          const escrow = item.escrow || "";
          if (uuid && escrow) {
            setOrderUuid(uuid);
            setEscrowWallet((prev) => (escrow !== prev ? escrow : prev));
            pendingEscrowRef.current = "";
          }
        }
      };

      if ("data" in orderData) {
        const wsMessage = orderData as WebSocketMessage;
        if (wsMessage.data) {
          const order = Array.isArray(wsMessage.data) ? wsMessage.data[0] : wsMessage.data;
          if (order) processInit({ ...order, uuid: order.uuid || wsMessage.uuid });
        }
      } else if ("escrow" in orderData && "uuid" in orderData) {
        processInit(orderData as unknown as Order);
      }
    } catch (error) {
      console.error("Error processing WebSocket message in new order modal:", error);
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

  // /ws/tap - handles escrow tao, alpha, price updates: { escrow, asset, tao, alpha, price }
  const handleTapMessage = React.useCallback((message: unknown) => {
    try {
      const tapData = parseWsMessage<{ escrow?: string; tao?: number; alpha?: number; price?: number }>(message);
      if (!tapData || typeof tapData !== "object" || !("escrow" in tapData)) return;

      const escrow = tapData.escrow;
      const tao = Number(tapData.tao || 0);
      const alpha = Number(tapData.alpha || 0);
      const price = Number(tapData.price || 0);

      if (escrow === escrowWallet && escrowWallet && price > 0) {
        setPriceData({ tao, alpha, price });
      }
    } catch (error) {
      console.error("Error processing tap WebSocket message:", error);
    }
  }, [escrowWallet]);

  useWebSocket({
    url: WS_TAP_URL,
    onMessage: handleTapMessage,
    enabled: open,
  });

  React.useEffect(() => {
    if (open && selectedAccount?.address) {
      setOriginWallet(selectedAccount.address);
    } else if (open) {
      setOriginWallet("");
    }
  }, [open, selectedAccount?.address]);

  // Fetch all subnet prices via HTTP when modal opens
  React.useEffect(() => {
    if (!open) return;
    const backendUrl = apiUrl || API_URL;
    const fetchPrices = async () => {
      try {
        const response = await fetch(`${backendUrl}/price`);
        if (!response.ok) return;
        let data = await response.json();
        // Response may be double-encoded as a JSON string
        if (typeof data === "string") {
          data = JSON.parse(data);
        }
        if (Array.isArray(data)) {
          const priceMap: Record<number, number> = {};
          const pools: Record<number, { tao_in: number; alpha_in: number }> = {};
          data.forEach((item: unknown, index: number) => {
            if (typeof item === "object" && item !== null) {
              const obj = item as { price?: number; tao_in?: number; alpha_in?: number };
              const p = Number(obj.price);
              if (!isNaN(p) && p > 0) {
                priceMap[index] = p;
              }
              const taoIn = Number(obj.tao_in);
              const alphaIn = Number(obj.alpha_in);
              if (!isNaN(taoIn) && !isNaN(alphaIn) && taoIn > 0 && alphaIn > 0) {
                pools[index] = { tao_in: taoIn, alpha_in: alphaIn };
              }
            }
          });
          if (Object.keys(priceMap).length > 0) {
            setHttpPrices(priceMap);
          }
          if (Object.keys(pools).length > 0) {
            setPoolData(pools);
          }
        }
      } catch (err) {
        console.warn("[NewOrder] Failed to fetch prices via HTTP:", err);
      }
    };
    fetchPrices();
  }, [open, apiUrl]);

  React.useEffect(() => {
    if (error) {
      setErrorVisible(true);
      const fadeOutTimer = setTimeout(() => {
        setErrorVisible(false);
        setTimeout(() => {
          setError("");
        }, 300);
      }, 5000);

      return () => {
        clearTimeout(fadeOutTimer);
      };
    } else {
      setErrorVisible(false);
    }
  }, [error]);

  const resetForm = () => {
    setFormData({
      type: undefined,
      alpha: undefined,
      tao: undefined,
      asset: undefined,
      gtd: "gtc",
      stp: undefined,
      partial: true,
      public: true,
    });
    setEscrowWallet("");
    setOriginWallet("");
    setOrderUuid("");
    setError("");
    setSelectedDate(undefined);
    setEscrowGenerated(false);
    setShowReviewButtons(false);
    setShowPaymentButtons(false);
    setIsInReviewMode(false);
    setCopiedEscrow(false);
    setPriceData(null);
    setTransferInputMode("tao");
    setAssetInputEditing(null);
    pendingEscrowRef.current = "";
    resetTransfer();
  };

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

  // Use HTTP-fetched prices first, then fall back to parent's WebSocket prices
  const priceForConversion = formData.asset != null
    ? (httpPrices[formData.asset] > 0 ? httpPrices[formData.asset] : (prices[formData.asset] > 0 ? prices[formData.asset] : 0))
    : 0;
  const getAlphaForSubmit = () => {
    if (formData.type !== 1) return 0;
    // Sell + Alpha: no conversion needed
    if (transferInputMode === "alpha") return formData.alpha ?? 0;
    // Sell + TAO: convert TAO → Alpha = TAO / price
    const raw = formData.tao ?? 0;
    if (priceForConversion > 0) {
      return raw / priceForConversion;
    }
    return 0;
  };

  const getTaoForSubmit = () => {
    if (formData.type !== 2) return 0;
    // Buy + TAO: no conversion needed
    if (transferInputMode === "tao") return formData.tao ?? 0;
    // Buy + Alpha: convert Alpha → TAO = Alpha × price
    const raw = formData.alpha ?? 0;
    if (priceForConversion > 0) {
      return raw * priceForConversion;
    }
    return 0;
  };

  // ofm = [open_max, open_min, fill_min] — available for future validation

  const handleNext = async () => {
    try {
      setLoading(true);
      setError("");

      const walletAddress = selectedAccount?.address || "";

      if (!wsUuid) {
        throw new Error("WebSocket connection UUID not available. Please wait for connection");
      }
      const orderData = {
        uuid: wsUuid,
        origin: "",
        escrow: "",
        wallet: walletAddress,
        asset: Number(formData.asset),
        type: Number(formData.type),
        ask: 0,
        bid: 0,
        stp: Number(formData.stp ?? 0),
        lmt: 0,
        gtd:
          formData.gtd === "gtc" ? "gtc" : selectedDate?.toISOString() || "gtc",
        partial: formData.partial ? true : false,
        public: formData.public ? true : false,
        tao: formData.type === 2 ? Number(getTaoForSubmit()) : 0.0,
        alpha: formData.type === 1 ? Number(getAlphaForSubmit()) : 0.0,
        price: priceForConversion,
        status: -1,
      };
      const backendUrl = apiUrl || API_URL;
      const response = await postJson(`${backendUrl}/rec`, orderData);

      if (!response.ok) {
        throw new Error(await extractResponseError(response));
      }

      const data = await readResponseBody(response);

      let escrowAddress = data as string;

      if (!escrowAddress) {
        throw new Error("Failed to create escrow wallet. Please try again");
      }

      const trimmedEscrow = escrowAddress.trim();
      setEscrowWallet(trimmedEscrow);

      pendingEscrowRef.current = trimmedEscrow;

      setOrderUuid("");

      // Set originWallet if not already set
      if (!originWallet && walletAddress) {
        setOriginWallet(walletAddress);
      } else if (!originWallet) {
        // Allow empty origin wallet for orders without wallet connection
        setOriginWallet("");
      }
      setEscrowGenerated(true);
    } catch (err) {
      console.error("Error creating order:", err);
      setError(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!escrowGenerated) {
      setShowReviewButtons(true);
    } else if (showReviewButtons) {
      setShowReviewButtons(false);
      setShowPaymentButtons(true);
    } else if (showPaymentButtons) {
      await handleFinalPlaceOrder();
    } else if (escrowGenerated && !isInReviewMode) {
      await handleFinalPlaceOrder();
    }
  };

  const handleFinalPlaceOrder = async () => {
    try {
      setLoading(true);
      setError("");
      resetTransfer();

      const walletAddress = selectedAccount?.address || originWallet || "";

      const finalWallet = walletAddress || originWallet || "";

      const finalUuid = wsUuid;

      if (!finalUuid) {
        throw new Error("Order UUID not available. Please wait for WebSocket connection");
      }
      if (!escrowWallet) {
        throw new Error("Missing escrow wallet address");
      }

      const finalOrigin = escrowWallet.trim();
      const finalEscrow = escrowWallet.trim();

      // --- Step 1: On-chain transfer to escrow ---
      // Buy order → transfer TAO to escrow
      // Sell order → transfer Alpha to escrow
      if (isConnected && selectedAccount) {
        if (formData.type === 2) {
          // Buy order: transfer TAO
          const taoAmount = getTaoForSubmit();
          if (taoAmount > 0) {
            console.log(`[PlaceOrder] Transferring ${taoAmount} TAO to escrow ${finalEscrow}`);
            const taoOutcome = await sendTao(finalEscrow, taoAmount);
            if (!taoOutcome.result) {
              const reason = taoOutcome.error || "TAO transfer to escrow failed or was cancelled";
              resetTransfer();
              throw new Error(reason);
            }
            const txResult = taoOutcome.result;
            console.log(`[PlaceOrder] TAO transfer confirmed: ${txResult.txHash}`);
          }
        } else if (formData.type === 1) {
          // Sell order: transfer Alpha
          const alphaAmount = getAlphaForSubmit();
          const netuid = Number(formData.asset);
          if (alphaAmount > 0 && netuid > 0) {
            // Step 1a: Check hotkey exists before attempting transfer
            const hotkey = await resolveHotkey(selectedAccount.address, netuid);
            if (!hotkey) {
              throw new Error("No hotkey for this subnet. You need Alpha staked on this subnet (via a hotkey) to place a Sell order");
            }

            // Step 1b: Hotkey exists — proceed with on-chain transfer
            console.log(`[PlaceOrder] Transferring ${alphaAmount} Alpha (netuid ${netuid}) to escrow ${finalEscrow}`);
            const alphaOutcome = await sendAlpha(finalEscrow, alphaAmount, netuid);
            if (!alphaOutcome.result) {
              const reason = alphaOutcome.error || "Alpha transfer failed";
              resetTransfer();
              throw new Error(reason);
            }
            console.log(`[PlaceOrder] Alpha transfer confirmed: ${alphaOutcome.result.txHash}`);
          }
        }
      }

      // --- Step 2: Submit order to backend ---
      // Use price data from WebSocket if available, otherwise backend will calculate
      console.log(`[PlaceOrder] Price data:`, priceData);
      const taoValue = priceData?.tao ?? 0.0;
      const alphaValue = priceData?.alpha ?? 0.0;
      const priceValue = priceData?.price && priceData.price > 0 ? priceData.price : 0.0;

      const orderData = {
        uuid: finalUuid,
        origin: finalOrigin,
        escrow: finalEscrow,
        wallet: finalWallet,
        asset: Number(formData.asset),
        alpha: formData.type === 1 ? Number(getAlphaForSubmit()) : (alphaValue || 0.0),
        type: Number(formData.type),
        ask: 0,
        bid: 0,
        stp: Number(formData.stp ?? 0),
        lmt: 0,
        gtd:
          formData.gtd === "gtc" ? "gtc" : selectedDate?.toISOString() || "gtc",
        partial: formData.partial ? true : false,
        public: formData.public ? true : false,
        tao: formData.type === 2 ? Number(getTaoForSubmit()) : (taoValue || 0.0),
        price: priceValue,
        status: 1,
      };
      const backendUrl = apiUrl || API_URL;
      const response = await postJson(`${backendUrl}/rec`, orderData);
      console.log(`[PlaceOrder] Order data:`, orderData);
      if (!response.ok) {
        throw new Error(await extractResponseError(response));
      }

      // Parse /rec response format: ['msg', tao, alpha, price] or [..., status]
      let recMessage = "";
      let recStatus: number | undefined;
      try {
        const responseBody = await readResponseBody(response);
        const responseText = typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody);
        const recResult = parseRecResponse(responseText);
        if (recResult) {
          recStatus = recResult.status;
          if (recResult.price > 0) {
            setPriceData({ tao: recResult.tao, alpha: recResult.alpha, price: recResult.price });
          }
          if (recResult.message) {
            recMessage = recResult.message;
          }
        }
      } catch (e) {
        console.warn("Could not extract data from response:", e);
      }

      if (recMessage) {
        if (recStatus === 3) {
          // Status 3 (order closed) — close modal and show standalone popup
          onOrderPlaced?.();
          onOpenChange(false);
          resetForm();
          onRecMessage?.(recMessage);
        } else {
          // Other message — show in modal (original style)
          setError(recMessage);
        }
      } else {
        // Success — close modal and reset
        onOrderPlaced?.();
        onOpenChange(false);
        resetForm();
      }
    } catch (err) {
      console.error("Error placing order:", err);
      setError(err instanceof Error ? err.message : "Failed to place order");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (showPaymentButtons) {
      setShowPaymentButtons(false);
      setShowReviewButtons(true);
    } else if (showReviewButtons) {
      setShowReviewButtons(false);
    } else if (escrowGenerated && isInReviewMode) {
      setIsInReviewMode(false);
      setEscrowGenerated(false);
      setEscrowWallet("");
    } else if (escrowGenerated && !isInReviewMode) {
      setIsInReviewMode(true);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    resetForm();
  };

  const handleReviewOrder = async () => {
    if (isInReviewMode) {
      try {
        setLoading(true);
        setError("");

        const walletAddress = selectedAccount?.address || originWallet || "";

        if (!wsUuid) {
          throw new Error("WebSocket connection UUID not available. Please wait for connection");
        }
        if (!escrowWallet) {
          throw new Error("Missing escrow wallet address");
        }

        const orderData = {
          uuid: wsUuid,
          origin: escrowWallet.trim(),
          escrow: escrowWallet.trim(),
          wallet: walletAddress,
          asset: Number(formData.asset),
          alpha: formData.type === 1 ? Number(getAlphaForSubmit()) : 0.0,
          type: Number(formData.type),
          ask: 0,
          bid: 0,
          stp: Number(formData.stp ?? 0),
          lmt: 0,
          gtd: formData.gtd === "gtc" ? "gtc" : selectedDate?.toISOString() || "gtc",
          partial: formData.partial ? true : false,
          public: formData.public ? true : false,
          tao: formData.type === 2 ? Number(getTaoForSubmit()) : 0.0,
          price: 0.0,
          status: -1,
        };

        const backendUrl = apiUrl || API_URL;
        const response = await postJson(`${backendUrl}/rec`, orderData);

        if (!response.ok) {
          throw new Error(await extractResponseError(response));
        }

        setIsInReviewMode(false);
      } catch (err) {
        console.error("Error updating order:", err);
        setError(err instanceof Error ? err.message : "Failed to update order");
      } finally {
        setLoading(false);
      }
    } else {
      setShowReviewButtons(false);
      setShowPaymentButtons(true);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[516px] max-w-[calc(100vw-2rem)] w-[calc(100vw-2rem)] sm:w-[516px] bg-card dark:bg-background border-border/60">
        <DialogHeader className="flex flex-row justify-start gap-2 items-center mt-[-10px]">
          <div className="mt-[3px]">
            <DialogTitle>Open Order</DialogTitle>
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
        {/* transferError is now shown via the unified error display above */}
        {transferStatus === "finalized" && !isTransferring && (
          <div className="p-3 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 text-sm">
            Transfer confirmed on-chain. Placing order...
          </div>
        )}

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="escrow">Escrow Wallet Address</Label>
            <div className="flex items-center gap-2">
              <code
                className={cn(
                  "flex-1 font-mono p-2 rounded-md border bg-background break-all",
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
                  className="h-8 w-8 shrink-0"
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
              formData.type != null &&
              (formData.type === 2
                ? (getTaoForSubmit() > 0 || (transferInputMode === "alpha" && (formData.alpha ?? 0) > 0))
                : (getAlphaForSubmit() > 0 || (transferInputMode === "tao" && (formData.tao ?? 0) > 0))
              ) && (
                <p className="text-sm text-muted-foreground opacity-60">
                  {formData.type === 2 ? (
                    <>{getTaoForSubmit().toFixed(4)} TAO to be transferred to escrow.</>
                  ) : (
                    <>{getAlphaForSubmit().toFixed(2)} Alpha to be transferred to escrow.</>
                  )}
                  {formData.asset != null && poolData[formData.asset] && (() => {
                    const pool = poolData[formData.asset!];
                    if (!pool || pool.alpha_in <= 0 || pool.tao_in <= 0) return null;
                    // Use pool's own spot price for slippage so the reference matches the AMM (avoids negative slippage from order-book/WS price mismatch)
                    const poolSpotPrice = pool.tao_in / pool.alpha_in;
                    let slippage = 0;
                    if (formData.type === 1) {
                      // Sell order: user sends Alpha
                      let alpha = 0;
                      if (transferInputMode === "alpha") {
                        alpha = formData.alpha ?? 0;
                      } else {
                        const taoInput = formData.tao ?? 0;
                        if (poolSpotPrice > 0) alpha = taoInput / poolSpotPrice;
                      }
                      if (alpha <= 0) return null;
                      const cost = alpha * poolSpotPrice;
                      const received = pool.tao_in * alpha / (pool.alpha_in + alpha);
                      if (cost > 0) slippage = (cost - received) / cost * 100;
                    } else if (formData.type === 2) {
                      // Buy order: user sends TAO
                      let tao = 0;
                      if (transferInputMode === "tao") {
                        tao = formData.tao ?? 0;
                      } else {
                        const alphaInput = formData.alpha ?? 0;
                        if (poolSpotPrice > 0) tao = alphaInput * poolSpotPrice;
                      }
                      if (tao <= 0) return null;
                      const receivedAlpha = pool.alpha_in * tao / (pool.tao_in + tao);
                      const received = receivedAlpha * poolSpotPrice;
                      if (tao > 0) slippage = (tao - received) / tao * 100;
                    }
                    if (slippage <= 0) return null;
                    return <> {slippage.toFixed(4)}% slippage saved</>;
                  })()}
                </p>
              )}
          </div>

          {/* order size */}
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="transfer-amount">
                {transferInputMode === "tao" ? "Order Size in TAO" : "Order Size in Alpha"}
              </Label>
              <button
                type="button"
                onClick={() => {
                  if (escrowGenerated && !isInReviewMode) return;
                  if (transferInputMode === "tao") {
                    const v = formData.tao ?? formData.alpha;
                    setFormData((prev) => ({ ...prev, alpha: v }));
                    setTransferInputMode("alpha");
                  } else {
                    const v = formData.alpha ?? formData.tao;
                    setFormData((prev) => ({ ...prev, tao: v }));
                    setTransferInputMode("tao");
                  }
                }}
                disabled={escrowGenerated && !isInReviewMode}
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
                step="1"
                value={(transferInputMode === "tao" ? formData.tao : formData.alpha) ?? ""}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  const parsed = parseFloat(value);
                  const v = value === "" ? undefined : (isNaN(parsed) ? undefined : parsed);
                  const field = transferInputMode === "tao" ? "tao" : "alpha";
                  setFormData((prev) => ({ ...prev, [field]: v }));
                }}
                disabled={escrowGenerated && !isInReviewMode}
                placeholder={transferInputMode === "tao" ? "Enter TAO amount" : "Enter Alpha amount"}
                className="focus-visible:ring-1 focus-visible:ring-blue-500/30 focus-visible:ring-offset-0 focus-visible:border-blue-500/40 pr-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <div className="absolute right-1 flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!escrowGenerated || isInReviewMode) {
                      const field = transferInputMode === "tao" ? "tao" : "alpha";
                      const current = (transferInputMode === "tao" ? formData.tao : formData.alpha) ?? 0;
                      setFormData((prev) => ({ ...prev, [field]: current + 1 }));
                    }
                  }}
                  disabled={escrowGenerated && !isInReviewMode}
                  className="h-4 w-6 flex items-center justify-center rounded-sm border border-border bg-background hover:bg-muted active:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label={transferInputMode === "tao" ? "Increase TAO amount" : "Increase alpha amount"}
                >
                  <ChevronUp className="h-3 w-3 text-muted-foreground" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!escrowGenerated || isInReviewMode) {
                      const field = transferInputMode === "tao" ? "tao" : "alpha";
                      const current = (transferInputMode === "tao" ? formData.tao : formData.alpha) ?? 0;
                      setFormData((prev) => ({ ...prev, [field]: Math.max(0, current - 1) }));
                    }
                  }}
                  disabled={escrowGenerated && !isInReviewMode}
                  className="h-4 w-6 flex items-center justify-center rounded-sm border border-border bg-background hover:bg-muted active:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label={transferInputMode === "tao" ? "Decrease TAO amount" : "Decrease alpha amount"}
                >
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>

          {/* order type - same badge style as main order book */}
          <div className="grid gap-2">
            <Label>Order Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className={`flex-1 h-10 font-medium ${formData.type === 1
                  ? "text-rose-600 border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400"
                  : "text-muted-foreground bg-background hover:bg-muted/50 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 dark:hover:border-rose-800 dark:hover:text-rose-400"
                  }`}
                onClick={() => setFormData({ ...formData, type: 1 })}
                disabled={escrowGenerated && !isInReviewMode}
              >
                Sell
              </Button>
              <Button
                type="button"
                variant="outline"
                className={`flex-1 h-10 font-medium ${formData.type === 2
                  ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400"
                  : "text-muted-foreground bg-background hover:bg-muted/50 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 dark:hover:border-emerald-800 dark:hover:text-emerald-400"
                  }`}
                onClick={() => setFormData({ ...formData, type: 2 })}
                disabled={escrowGenerated && !isInReviewMode}
              >
                Buy
              </Button>
            </div>
          </div>



          <div className="grid gap-2">
            <Label htmlFor="asset">Asset (NETUID)</Label>
            <div className="relative flex items-center">
              <Input
                id="asset"
                type="text"
                value={
                  assetInputEditing !== null
                    ? assetInputEditing
                    : formData.asset != null
                      ? (subnetNames[formData.asset]
                        ? `${formData.asset} - ${subnetNames[formData.asset]}`
                        : String(formData.asset))
                      : ""
                }
                onFocus={() =>
                  setAssetInputEditing(formData.asset != null ? String(formData.asset) : "")
                }
                onBlur={() => {
                  const raw = (assetInputEditing ?? "").trim();
                  if (raw === "") {
                    setFormData((prev) => ({ ...prev, asset: undefined }));
                  } else {
                    const n = parseInt(raw, 10);
                    setFormData((prev) => ({
                      ...prev,
                      asset: Number.isNaN(n) ? undefined : n,
                    }));
                  }
                  setAssetInputEditing(null);
                }}
                onChange={(e) => setAssetInputEditing(e.target.value)}
                disabled={escrowGenerated && !isInReviewMode}
                placeholder="Enter asset"
                className="focus-visible:ring-1 focus-visible:ring-blue-500/30 focus-visible:ring-offset-0 focus-visible:border-blue-500/40 pr-10"
              />
              <div className="absolute right-1 flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!escrowGenerated || isInReviewMode) {
                      setFormData({
                        ...formData,
                        asset: Math.max(1, (formData.asset ?? 0) + 1),
                      });
                    }
                  }}
                  disabled={escrowGenerated && !isInReviewMode}
                  className="h-4 w-6 flex items-center justify-center rounded-sm border border-border bg-background hover:bg-muted active:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Increase asset"
                >
                  <ChevronUp className="h-3 w-3 text-muted-foreground" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!escrowGenerated || isInReviewMode) {
                      const currentAsset = formData.asset ?? 1;
                      setFormData({
                        ...formData,
                        asset: currentAsset > 1 ? currentAsset - 1 : undefined,
                      });
                    }
                  }}
                  disabled={escrowGenerated && !isInReviewMode}
                  className="h-4 w-6 flex items-center justify-center rounded-sm border border-border bg-background hover:bg-muted active:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Decrease asset"
                >
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="stp">Stop Price (TAO)</Label>
            <div className="relative flex items-center">
              <Input
                id="stp"
                type="number"
                min="0"
                step="0.001"
                value={formData.stp === undefined ? "" : formData.stp}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  if (value === "" || value === null || value === undefined) {
                    setFormData({
                      ...formData,
                      stp: undefined,
                    });
                  } else {
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue)) {
                      setFormData({
                        ...formData,
                        stp: numValue,
                      });
                    } else {
                      // Allow partial input like "0.", ".5", etc. by keeping undefined
                      setFormData({
                        ...formData,
                        stp: undefined,
                      });
                    }
                  }
                }}
                disabled={escrowGenerated && !isInReviewMode}
                placeholder="Enter stop price"
                className="focus-visible:ring-1 focus-visible:ring-blue-500/30 focus-visible:ring-offset-0 focus-visible:border-blue-500/40 pr-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <div className="absolute right-1 flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!escrowGenerated || isInReviewMode) {
                      const currentStp = formData.stp ?? 0;
                      setFormData({
                        ...formData,
                        stp: Number((currentStp + 0.001).toFixed(3)),
                      });
                    }
                  }}
                  disabled={escrowGenerated && !isInReviewMode}
                  className="h-4 w-6 flex items-center justify-center rounded-sm border border-border bg-background hover:bg-muted active:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Increase stop price"
                >
                  <ChevronUp className="h-3 w-3 text-muted-foreground" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!escrowGenerated || isInReviewMode) {
                      const currentStp = formData.stp ?? 0;
                      const newValue = Math.max(
                        0,
                        Number((currentStp - 0.001).toFixed(3))
                      );
                      setFormData({
                        ...formData,
                        stp: newValue > 0 ? newValue : undefined,
                      });
                    }
                  }}
                  disabled={escrowGenerated && !isInReviewMode}
                  className="h-4 w-6 flex items-center justify-center rounded-sm border border-border bg-background hover:bg-muted active:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Decrease stop price"
                >
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground opacity-60">
              Market Price {priceForConversion > 0 ? priceForConversion.toFixed(6) : "0.000000"}
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Good Till Date (GTD)</Label>
            <div className="flex gap-2">
              <Select
                value={formData.gtd === "gtc" ? "gtc" : "date"}
                onValueChange={(value) => {
                  if (value === "gtc") {
                    setFormData({ ...formData, gtd: "gtc" });
                    setSelectedDate(undefined);
                  } else {
                    setFormData({ ...formData, gtd: "" });
                  }
                }}
                disabled={escrowGenerated && !isInReviewMode}
              >
                <SelectTrigger className="w-32 focus:ring-1 focus:ring-blue-500/30 focus:ring-offset-0 focus:border-blue-500/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gtc" className="opacity-60">GTC</SelectItem>
                  <SelectItem value="date" className="opacity-60">Specific Date</SelectItem>
                </SelectContent>
              </Select>

              {formData.gtd !== "gtc" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                      disabled={escrowGenerated && !isInReviewMode}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? (
                        format(selectedDate, "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      initialFocus
                      disabled={escrowGenerated && !isInReviewMode}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
            <p className="text-sm text-muted-foreground opacity-60">
              GTC = Good Till Cancel (order stays active until you cancel it)
            </p>
          </div>


          <div
            className={cn(
              "flex items-center space-x-2",
              escrowGenerated && !isInReviewMode && "opacity-60"
            )}
          >
            <Checkbox
              id="partial"
              checked={formData.partial}
              onCheckedChange={(checked: boolean) => {
                setFormData({ ...formData, partial: checked });
              }}
              disabled={escrowGenerated && !isInReviewMode}
            />
            <Label
              htmlFor="partial"
              className="text-sm font-normal cursor-pointer"
            >
              Allow partial fills
            </Label>
          </div>

          <div
            className={cn(
              "flex items-center space-x-2",
              escrowGenerated && !isInReviewMode && "opacity-60"
            )}
          >
            <Checkbox
              id="public"
              checked={formData.public}
              onCheckedChange={(checked: boolean) => {
                setFormData({ ...formData, public: checked });
              }}
              disabled={escrowGenerated && !isInReviewMode}
            />
            <Label
              htmlFor="public"
              className="text-sm font-normal cursor-pointer"
            >
              Public order (visible to everyone)
            </Label>
          </div>
        </div>

        <DialogFooter>
          {!escrowGenerated ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={handleNext}
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Escrow
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={isInReviewMode ? handleCancel : handleBack}
                disabled={loading || isTransferring}
              >
                {isInReviewMode ? "Cancel" : "Back"}
              </Button>
              <Button
                variant={isInReviewMode ? "outline" : undefined}
                onClick={isInReviewMode ? handleReviewOrder : handlePlaceOrder}
                disabled={loading || isTransferring}
                className={isInReviewMode ? "" : "bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-semibold shadow-[0_4px_14px_0_rgba(37,99,235,0.3)] hover:shadow-[0_6px_20px_0_rgba(37,99,235,0.4)]"}
              >
                {(loading || isTransferring) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isInReviewMode ? "Review Order" : isTransferring ? "Transferring..." : "Place Order"}
              </Button>
            </>
          )}
        </DialogFooter>

        {showReviewButtons && (
          <div className="flex gap-2 justify-end mt-4 pt-4 border-t">
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
            <Button
              onClick={handleReviewOrder}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              Review Order
            </Button>
          </div>
        )}

        {showPaymentButtons && (
          <div className="flex gap-2 justify-end mt-4 pt-4 border-t">
            <Button variant="outline" onClick={handleBack} disabled={isTransferring}>
              Back
            </Button>
            <Button
              onClick={handlePlaceOrder}
              disabled={loading || isTransferring}
              className="bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-semibold shadow-[0_4px_14px_0_rgba(37,99,235,0.3)] hover:shadow-[0_6px_20px_0_rgba(37,99,235,0.4)]"
            >
              {isTransferring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isTransferring ? "Transferring..." : "Place Order"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
