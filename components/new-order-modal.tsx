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
  ArrowLeftRight,
} from "lucide-react";
import { format } from "date-fns";
import { NewOrderFormData, Order } from "@/lib/types";
import { useWallet } from "@/context/wallet-context";
import { useWebSocket } from "@/hooks/useWebSocket";
import { WebSocketMessage } from "@/lib/websocket-types";
import { getWebSocketBookUrl, getWebSocketPriceUrl, getWebSocketTapUrl, API_URL } from "@/lib/config";
import { ConnectButton } from "@/components/walletkit/connect";


interface NewOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderPlaced?: () => void;
  apiUrl?: string;
  prices?: Record<number, number>;
  ofm?: [number, number, number]; // [open_max, open_min, fill_min]
}

export function NewOrderModal({
  open,
  onOpenChange,
  onOrderPlaced,
  apiUrl,
  prices = {},
  ofm = [10, 0.01, 0.001],
}: NewOrderModalProps) {
  const { selectedAccount, isConnected } = useWallet();
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
  const [assetPrices, setAssetPrices] = React.useState<Record<number, number>>({});
  const [transferInputMode, setTransferInputMode] = React.useState<"alpha" | "tao">("alpha");

  const [recPopupMessage, setRecPopupMessage] = React.useState<string>("");
  const pendingEscrowRef = React.useRef<string>("");

  const WS_URL = React.useMemo(() => {
    return getWebSocketBookUrl();
  }, []);

  const WS_PRICE_URL = React.useMemo(() => {
    return getWebSocketPriceUrl();
  }, []);

  const WS_TAP_URL = React.useMemo(() => {
    return getWebSocketTapUrl();
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
          const order = Array.isArray(wsMessage.data) ? wsMessage.data[0] : wsMessage.data;
          if (order && order.escrow === pendingEscrowRef.current && order.status === -1) {
            const uuid = order.uuid || wsMessage.uuid || "";
            const escrow = order.escrow || "";
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
      }
      else if (orderData && typeof orderData === "object" && "escrow" in orderData && "uuid" in orderData) {
        const order = orderData as Order;

        if (order.escrow === pendingEscrowRef.current && order.status === -1) {
          const uuid = order.uuid || "";
          const escrow = order.escrow || "";
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
        // Note: escrow tao/alpha/price updates now come from /ws/tap, not /ws/book
      }
    } catch (error) {
      console.error("Error processing WebSocket message in new order modal:", error);
    }
  }, [escrowWallet]);

  const handleUuidReceived = React.useCallback((uuid: string) => {
    setWsUuid(uuid);
  }, []);

  const { connectionState: wsConnectionState } = useWebSocket({
    url: WS_URL,
    onMessage: handleWebSocketMessage,
    onUuidReceived: handleUuidReceived,
    enabled: open,
  });

  // /ws/price - only handles all subnet prices: { netuid: { price: ... } }
  const handlePriceMessage = React.useCallback((message: any) => {
    try {
      let priceDataMsg: any = message;
      if (typeof message === "string") {
        try {
          priceDataMsg = JSON.parse(message);
          if (typeof priceDataMsg === "string") {
            priceDataMsg = JSON.parse(priceDataMsg);
          }
        } catch {
          return;
        }
      }

      if (priceDataMsg && typeof priceDataMsg === "object") {
        const priceMap: Record<number, number> = {};
        for (const [key, value] of Object.entries(priceDataMsg)) {
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
        if (Object.keys(priceMap).length > 0) {
          setAssetPrices((prev) => ({ ...prev, ...priceMap }));
        }
      }
    } catch (error) {
      console.error("Error processing price WebSocket message:", error);
    }
  }, []);

  const { connectionState: priceConnectionState } = useWebSocket({
    url: WS_PRICE_URL,
    onMessage: handlePriceMessage,
    enabled: open,
  });

  // /ws/tap - handles escrow tao, alpha, price updates: { escrow, asset, tao, alpha, price }
  const handleTapMessage = React.useCallback((message: any) => {
    try {
      let tapData: any = message;
      if (typeof message === "string") {
        try {
          tapData = JSON.parse(message);
          if (typeof tapData === "string") {
            tapData = JSON.parse(tapData);
          }
        } catch {
          return;
        }
      }

      if (
        tapData &&
        typeof tapData === "object" &&
        "escrow" in tapData
      ) {
        const escrow = tapData.escrow;
        const tao = Number(tapData.tao) || 0;
        const alpha = Number(tapData.alpha) || 0;
        const price = Number(tapData.price) || 0;

        if (escrow === escrowWallet && escrowWallet && price > 0) {
          setPriceData({ tao, alpha, price });
        }
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

  React.useEffect(() => {
    if (formData.type !== undefined) {
      setTransferInputMode(formData.type === 2 ? "tao" : "alpha");
    }
  }, [formData.type]);

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
    setTransferInputMode("alpha");
    setRecPopupMessage("");
    pendingEscrowRef.current = "";
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

  const assetPrice = formData.asset != null
    ? (assetPrices[formData.asset] > 0 ? assetPrices[formData.asset] : (prices[formData.asset] > 0 ? prices[formData.asset] : 0))
    : 0;
  const priceForConversion = (priceData?.price && priceData.price > 0)
    ? priceData.price
    : assetPrice;

  const getAlphaForSubmit = () => {
    if (formData.type !== 1) return 0;
    if (transferInputMode === "alpha") return formData.alpha ?? 0;
    if (transferInputMode === "tao" && priceForConversion > 0) return (formData.tao ?? 0) / priceForConversion;
    return formData.alpha ?? 0;
  };

  const getTaoForSubmit = () => {
    if (formData.type !== 2) return 0;
    if (transferInputMode === "tao") return formData.tao ?? 0;
    if (transferInputMode === "alpha" && priceForConversion > 0) return (formData.alpha ?? 0) * priceForConversion;
    return formData.tao ?? 0;
  };

  const [openMax, openMin, fillMin] = ofm;

  /**
   * Parse backend /rec response string: "['msg', tao, alpha, price]"
   * Python's str() uses single quotes; replace for JSON parsing.
   */
  const parseRecResponse = React.useCallback((responseText: string): { message: string; tao: number; alpha: number; price: number } | null => {
    try {
      const trimmed = responseText.trim();
      if (!trimmed.startsWith("[")) return null;
      const jsonStr = trimmed.replace(/'/g, '"');
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed) && parsed.length >= 4) {
        return {
          message: String(parsed[0] || ""),
          tao: Number(parsed[1]) || 0,
          alpha: Number(parsed[2]) || 0,
          price: Number(parsed[3]) || 0,
        };
      }
    } catch { /* ignore */ }
    return null;
  }, []);

  const handleNext = async () => {
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
        asset: Number(formData.asset),
        alpha: formData.type === 1 ? Number(getAlphaForSubmit()) : 0.0,
        type: Number(formData.type),
        ask: Number(formData.type === 1 ? (formData.stp ?? 0) : 0.0),
        bid: Number(formData.type === 2 ? (formData.stp ?? 0) : 0.0),
        stp: Number(formData.stp ?? 0),
        lmt: Number(formData.stp ?? 0),
        gtd:
          formData.gtd === "gtc" ? "gtc" : selectedDate?.toISOString() || "gtc",
        partial: formData.partial ? true : false,
        public: formData.public ? true : false,
        tao: formData.type === 2 ? Number(getTaoForSubmit()) : 0.0,
        price: 0.0,
        status: -1,
      };

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

      let escrowAddress = data;

      if (!escrowAddress) {
        throw new Error("Failed to create escrow wallet. Please try again.");
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
    } catch (err: any) {
      console.error("Error creating order:", err);
      setError(err.message || "Failed to create order");
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

      const walletAddress = selectedAccount?.address || originWallet || "";

      const finalWallet = walletAddress || originWallet || "";

      const finalUuid = wsUuid;

      if (!finalUuid) {
        throw new Error("Order UUID not available. Please wait for WebSocket connection.");
      }
      if (!escrowWallet) {
        throw new Error("Missing escrow wallet address");
      }

      const finalOrigin = escrowWallet.trim();
      const finalEscrow = escrowWallet.trim();

      // Use price data from WebSocket if available, otherwise backend will calculate
      // Note: Backend calculates price when order is placed, so we send 0.0 and extract from response
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
        ask: Number(formData.type === 1 ? (formData.stp ?? 0) : 0.0),
        bid: Number(formData.type === 2 ? (formData.stp ?? 0) : 0.0),
        stp: Number(formData.stp ?? 0),
        lmt: Number(formData.stp ?? 0),
        gtd:
          formData.gtd === "gtc" ? "gtc" : selectedDate?.toISOString() || "gtc",
        partial: formData.partial ? true : false,
        public: formData.public ? true : false,
        tao: formData.type === 2 ? Number(getTaoForSubmit()) : (taoValue || 0.0),
        price: priceValue,
        status: 1,
      };
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
      const responseClone = response.clone();

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

      // Parse new /rec response format: ['msg', tao, alpha, price]
      try {
        const contentType = responseClone.headers.get("content-type");
        let responseText: string;

        if (contentType && contentType.includes("application/json")) {
          const responseData = await responseClone.json();
          responseText = typeof responseData === "string" ? responseData : JSON.stringify(responseData);
        } else {
          responseText = await responseClone.text();
        }

        const recResult = parseRecResponse(responseText);
        if (recResult) {
          if (recResult.price > 0) {
            setPriceData({ tao: recResult.tao, alpha: recResult.alpha, price: recResult.price });
          }
          // Show popup if first field (message) is non-empty
          if (recResult.message) {
            setRecPopupMessage(recResult.message);
          }
        }
      } catch (e) {
        console.warn("Could not extract data from response:", e);
      }

      onOrderPlaced?.();
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      console.error("Error placing order:", err);
      setError(err.message || "Failed to place order");
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
          throw new Error("WebSocket connection UUID not available. Please wait for connection.");
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
          ask: Number(formData.type === 1 ? formData.stp : 0.0),
          bid: Number(formData.type === 2 ? formData.stp : 0.0),
          stp: Number(formData.stp),
          lmt: Number(formData.stp),
          gtd: formData.gtd === "gtc" ? "gtc" : selectedDate?.toISOString() || "gtc",
          partial: formData.partial ? true : false,
          public: formData.public ? true : false,
          tao: formData.type === 2 ? Number(getTaoForSubmit()) : 0.0,
          price: 0.0,
          status: -1,
        };

        const backendUrl = apiUrl || API_URL;
        const response = await fetch(`${backendUrl}/rec`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(orderData),
        }).catch((fetchError) => {
          if (fetchError.message === "Failed to fetch") {
            throw new Error("Cannot connect to server. This may be due to network issues or the server being unavailable.");
          }
          throw fetchError;
        });

        if (!response.ok) {
          let errorText: string;
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            try {
              const errorData = await response.json();
              errorText = typeof errorData === "string" ? errorData : JSON.stringify(errorData);
            } catch {
              errorText = await response.text();
            }
          } else {
            errorText = await response.text();
          }
          throw new Error(`Error (${response.status}): ${errorText || response.statusText}`);
        }

        setIsInReviewMode(false);
      } catch (err: any) {
        console.error("Error updating order:", err);
        setError(err.message || "Failed to update order");
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
            <DialogTitle>New Order</DialogTitle>
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
          </div>
          <div className="grid gap-2">
            <Label htmlFor="type">Order Type</Label>
            <Select
              value={formData.type === undefined ? undefined : String(formData.type)}
              onValueChange={(value) =>
                setFormData({ ...formData, type: parseInt(value) })
              }
              disabled={escrowGenerated && !isInReviewMode}
            >
              <SelectTrigger
                id="type"
                className="focus:ring-1 focus:ring-blue-500/50 focus:ring-offset-0 focus:border-blue-500/70 [&[data-placeholder]>span]:opacity-60 [&[data-placeholder]>span]:text-muted-foreground"
              >
                <SelectValue placeholder="Select order type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1" className="opacity-60">Sell</SelectItem>
                <SelectItem value="2" className="opacity-60">Buy</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="transfer-amount">
              {transferInputMode === "tao" ? "Transfer TAO" : "Transfer Alpha"}
            </Label>
            <div className="relative flex items-center">
              <Input
                id="transfer-amount"
                type="number"
                min="0"
                step="0.001"
                value={
                  transferInputMode === "tao"
                    ? (formData.tao === undefined ? "" : formData.tao)
                    : (formData.alpha === undefined ? "" : formData.alpha)
                }
                onChange={(e) => {
                  const value = e.target.value.trim();
                  const field = transferInputMode === "tao" ? "tao" : "alpha";
                  if (value === "" || value === null || value === undefined) {
                    setFormData({ ...formData, [field]: undefined });
                  } else {
                    const numValue = parseFloat(value);
                    if (!isNaN(numValue)) {
                      setFormData({ ...formData, [field]: numValue });
                    } else {
                      setFormData({ ...formData, [field]: undefined });
                    }
                  }
                }}
                disabled={escrowGenerated && !isInReviewMode}
                placeholder={transferInputMode === "tao" ? "Enter TAO amount" : "Enter alpha amount"}
                className="focus-visible:ring-1 focus-visible:ring-blue-500/30 focus-visible:ring-offset-0 focus-visible:border-blue-500/40 pr-20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <div className="absolute right-1 flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (escrowGenerated && !isInReviewMode) return;
                    if (formData.asset == null) return;
                    const price = priceForConversion;
                    if (price <= 0) return;
                    if (transferInputMode === "alpha") {
                      const alpha = formData.alpha ?? 0;
                      if (alpha <= 0) return;
                      const tao = alpha * price;
                      setFormData({ ...formData, tao: Number(tao.toFixed(6)) });
                      setTransferInputMode("tao");
                    } else {
                      const tao = formData.tao ?? 0;
                      if (tao <= 0) return;
                      const alpha = tao / price;
                      setFormData({ ...formData, alpha: Number(alpha.toFixed(6)) });
                      setTransferInputMode("alpha");
                    }
                  }}
                  disabled={
                    (escrowGenerated && !isInReviewMode)
                    || formData.asset == null
                    || priceForConversion <= 0
                    || (transferInputMode === "alpha" ? !(formData.alpha && formData.alpha > 0) : !(formData.tao && formData.tao > 0))
                  }
                  className="h-9 w-8 flex items-center justify-center rounded-sm border border-border bg-background hover:bg-muted active:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Convert between Alpha and TAO"
                  title={
                    formData.asset == null
                      ? "Select Asset (NetUID) first"
                      : priceForConversion <= 0
                        ? "Waiting for price from WebSocket..."
                        : `Convert: Alpha = TAO / ${priceForConversion.toFixed(6)}, TAO = Alpha × ${priceForConversion.toFixed(6)}`
                  }
                >
                  <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (!escrowGenerated || isInReviewMode) {
                        const field = transferInputMode === "tao" ? "tao" : "alpha";
                        const current = (transferInputMode === "tao" ? formData.tao : formData.alpha) ?? 0;
                        setFormData({
                          ...formData,
                          [field]: Number((current + 0.001).toFixed(3)),
                        });
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
                        const newValue = Math.max(0, Number((current - 0.001).toFixed(3)));
                        setFormData({
                          ...formData,
                          [field]: newValue > 0 ? newValue : undefined,
                        });
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
            <p className="text-xs text-muted-foreground">
              Alpha = TAO / price · TAO = Alpha × price. Select Asset (NetUID) to fetch price via WebSocket.
            </p>
            <p className="text-xs text-muted-foreground">
              Escrow limits (TAO): min {openMin}, max {openMax}. Fill min: {fillMin}.
            </p>
          </div>

        

          <div className="grid gap-2">
            <Label htmlFor="asset">Asset (NETUID)</Label>
            <div className="relative flex items-center">
              <Input
                id="asset"
                type="number"
                min="1"
                value={formData.asset === undefined ? "" : formData.asset}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    asset: e.target.value === "" ? undefined : parseInt(e.target.value) || undefined,
                  })
                }
                disabled={escrowGenerated && !isInReviewMode}
                placeholder="Enter asset"
                className="focus-visible:ring-1 focus-visible:ring-blue-500/30 focus-visible:ring-offset-0 focus-visible:border-blue-500/40 pr-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
            <p className="text-xs text-muted-foreground">
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
                disabled={loading}
              >
                {isInReviewMode ? "Cancel" : "Back"}
              </Button>
              <Button
                variant={isInReviewMode ? "outline" : undefined}
                onClick={isInReviewMode ? handleReviewOrder : handlePlaceOrder}
                disabled={loading}
                className={isInReviewMode ? "" : "bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-semibold shadow-[0_4px_14px_0_rgba(37,99,235,0.3)] hover:shadow-[0_6px_20px_0_rgba(37,99,235,0.4)]"}
              >
                {isInReviewMode ? "Review Order" : "Place Order"}
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
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
            <Button
              onClick={handlePlaceOrder}
              className="bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-semibold shadow-[0_4px_14px_0_rgba(37,99,235,0.3)] hover:shadow-[0_6px_20px_0_rgba(37,99,235,0.4)]"
            >
              Place Order
            </Button>
          </div>
        )}
      </DialogContent>

      {/* Popup for /rec response messages */}
      <Dialog open={!!recPopupMessage} onOpenChange={(isOpen) => { if (!isOpen) setRecPopupMessage(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notice</DialogTitle>
            <DialogDescription>{recPopupMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setRecPopupMessage("")} variant="outline">
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
