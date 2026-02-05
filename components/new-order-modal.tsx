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
import { getWebSocketBookUrl, getWebSocketPriceUrl, API_URL } from "@/lib/config";

interface NewOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderPlaced?: () => void;
  apiUrl?: string;
}

export function NewOrderModal({
  open,
  onOpenChange,
  onOrderPlaced,
  apiUrl,
}: NewOrderModalProps) {
  const { selectedAccount, isConnected } = useWallet();
  const [formData, setFormData] = React.useState<NewOrderFormData>({
    type: 1,
    asset: 1,
    gtd: "gtc",
    stp: 0,
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

  const pendingEscrowRef = React.useRef<string>("");

  const WS_URL = React.useMemo(() => {
    return getWebSocketBookUrl();
  }, []);

  const WS_PRICE_URL = React.useMemo(() => {
    return getWebSocketPriceUrl();
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

        if (order.escrow && order.status === 1) {
          const tao = Number(order.tao) || 0;
          const alpha = Number(order.alpha) || 0;
          const price = Number(order.price) || 0;

          if (order.escrow === escrowWallet && escrowWallet && price > 0) {
            setPriceData({ tao, alpha, price });
          }
        }
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

      if (
        priceDataMsg &&
        typeof priceDataMsg === "object" &&
        "escrow" in priceDataMsg &&
        "tao" in priceDataMsg &&
        "alpha" in priceDataMsg &&
        "price" in priceDataMsg
      ) {
        const escrow = priceDataMsg.escrow;
        const tao = Number(priceDataMsg.tao) || 0;
        const alpha = Number(priceDataMsg.alpha) || 0;
        const price = Number(priceDataMsg.price) || 0;

        if (escrow === escrowWallet && escrowWallet && price > 0) {
          setPriceData({ tao, alpha, price });
        }
      }
    } catch (error) {
      console.error("Error processing price WebSocket message:", error);
    }
  }, [escrowWallet]);

  const { connectionState: priceConnectionState } = useWebSocket({
    url: WS_PRICE_URL,
    onMessage: handlePriceMessage,
    enabled: open,
  });

  React.useEffect(() => {
    if (open && selectedAccount?.address) {
      setOriginWallet(selectedAccount.address);
    } else if (open) {
      // Allow creating orders without wallet - set empty or use placeholder
      setOriginWallet("");
    }
  }, [open, selectedAccount?.address]);

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
      type: 1,
      asset: 1,
      gtd: "gtc",
      stp: 0,
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
        type: Number(formData.type),
        ask: Number(formData.type === 1 ? formData.stp : 0.0),
        bid: Number(formData.type === 2 ? formData.stp : 0.0),
        stp: Number(formData.stp),
        lmt: Number(formData.stp),
        gtd:
          formData.gtd === "gtc" ? "gtc" : selectedDate?.toISOString() || "gtc",
        partial: formData.partial ? true : false,
        public: formData.public ? true : false,
        tao: 0.0, // auto fill
        alpha: 0.0, // auto fill
        price: 0.0, // auto fill
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
        type: Number(formData.type),
        ask: Number(formData.type === 1 ? formData.stp : 0.0),
        bid: Number(formData.type === 2 ? formData.stp : 0.0),
        stp: Number(formData.stp),
        lmt: Number(formData.stp),
        gtd:
          formData.gtd === "gtc" ? "gtc" : selectedDate?.toISOString() || "gtc",
        partial: formData.partial ? true : false,
        public: formData.public ? true : false,
        tao: taoValue,
        alpha: alphaValue,
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
          `Server error (${response.status}): ${errorText || response.statusText
          }`
        );
      }

      try {
        const contentType = responseClone.headers.get("content-type");
        let responseText: string;

        if (contentType && contentType.includes("application/json")) {
          const responseData = await responseClone.json();
          responseText = typeof responseData === "string" ? responseData : JSON.stringify(responseData);
        } else {
          responseText = await responseClone.text();
        }

        if (responseText && responseText.trim().startsWith("[")) {
          try {
            const parsed = JSON.parse(responseText);
            if (Array.isArray(parsed) && parsed.length >= 3) {
              const [tao, alpha, price] = parsed;
              const taoNum = Number(tao) || 0;
              const alphaNum = Number(alpha) || 0;
              const priceNum = Number(price) || 0;

              if (priceNum > 0) {
                setPriceData({ tao: taoNum, alpha: alphaNum, price: priceNum });
              }
            }
          } catch (e) {
            console.warn("Could not parse response as array:", e);
          }
        }
      } catch (e) {
        console.warn("Could not extract price data from response:", e);
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

  const handleReviewOrder = () => {
    if (isInReviewMode) {
      setIsInReviewMode(false);
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
        <DialogHeader>
          <DialogTitle>New Order</DialogTitle>
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
              value={String(formData.type)}
              onValueChange={(value) =>
                setFormData({ ...formData, type: parseInt(value) })
              }
              disabled={escrowGenerated && !isInReviewMode}
            >
              <SelectTrigger
                id="type"
                className="focus:ring-1 focus:ring-blue-500/50 focus:ring-offset-0 focus:border-blue-500/70"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1" className="opacity-60">Sell</SelectItem>
                <SelectItem value="2" className="opacity-60">Buy</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="asset">Asset (NETUID)</Label>
            <div className="relative flex items-center">
              <Input
                id="asset"
                type="number"
                min="1"
                value={formData.asset}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    asset: parseInt(e.target.value) || 1,
                  })
                }
                disabled={escrowGenerated && !isInReviewMode}
                className="focus-visible:ring-1 focus-visible:ring-blue-500/30 focus-visible:ring-offset-0 focus-visible:border-blue-500/40 pr-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <div className="absolute right-1 flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!escrowGenerated || isInReviewMode) {
                      setFormData({
                        ...formData,
                        asset: Math.max(1, formData.asset + 1),
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
                      setFormData({
                        ...formData,
                        asset: Math.max(1, formData.asset - 1),
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

          <div className="grid gap-2">
            <Label htmlFor="stp">Stop Price (TAO)</Label>
            <div className="relative flex items-center">
              <Input
                id="stp"
                type="number"
                min="0"
                step="0.001"
                value={formData.stp}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    stp: parseFloat(e.target.value) || 0,
                  })
                }
                disabled={escrowGenerated && !isInReviewMode}
                className="focus-visible:ring-1 focus-visible:ring-blue-500/30 focus-visible:ring-offset-0 focus-visible:border-blue-500/40 pr-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <div className="absolute right-1 flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!escrowGenerated || isInReviewMode) {
                      setFormData({
                        ...formData,
                        stp: Number((formData.stp + 0.001).toFixed(3)),
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
                      const newValue = Math.max(
                        0,
                        Number((formData.stp - 0.001).toFixed(3))
                      );
                      setFormData({
                        ...formData,
                        stp: newValue,
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
    </Dialog>
  );
}
