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
import { v4 as uuidv4 } from "uuid";
import { NewOrderFormData } from "@/lib/types";
import { useWallet } from "@/context/wallet-context";

interface NewOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderPlaced?: () => void;
  apiUrl?: string;
}

const generateMockEscrowAddress = (): string => {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"; // Base58 alphabet
  const prefix = "5"; // Common Substrate/Polkadot address prefix
  let address = prefix;
  for (let i = 0; i < 47; i++) {
    address += chars[Math.floor(Math.random() * chars.length)];
  }
  return address;
};

export function NewOrderModal({
  open,
  onOpenChange,
  onOrderPlaced,
  apiUrl,
}: NewOrderModalProps) {
  const { selectedAccount, isConnected } = useWallet();
  const [formData, setFormData] = React.useState<NewOrderFormData>({
    type: 1, // 1 = Sell (default)
    asset: 1, // NETUID (default)
    gtd: "gtc", // Good till cancel (default)
    stp: 0,
    partial: true,
    public: true,
  });
  const [escrowWallet, setEscrowWallet] = React.useState<string>("");
  const [originWallet, setOriginWallet] = React.useState<string>(""); // Store origin wallet from backend response
  const [orderUuid, setOrderUuid] = React.useState<string>(""); // Store UUID for reuse when placing order
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

  // Auto-dismiss error after 6 seconds with animation
  React.useEffect(() => {
    if (error) {
      setErrorVisible(true);
      const fadeOutTimer = setTimeout(() => {
        setErrorVisible(false);
        // Clear error after fade-out animation completes (300ms)
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

      // Check if wallet is connected
      if (!isConnected || !selectedAccount?.address) {
        setError("Please connect your wallet to create an order. Click the 'Wallet' button to get started.");
        setLoading(false);
        return;
      }

      const orderUuid = uuidv4();
      const orderData = {
        uuid: orderUuid,
        origin: "",
        escrow: "",
        wallet: selectedAccount.address,
        asset: Number(formData.asset),
        type: Number(formData.type),
        ask: Number(formData.type === 1 ? formData.stp : 0.0),
        bid: Number(formData.type === 2 ? formData.stp : 0.0),
        stp: Number(formData.stp),
        lmt: Number(formData.stp),
        gtd:
          formData.gtd === "gtc" ? "gtc" : selectedDate?.toISOString() || "gtc",
        partial: Boolean(formData.partial),
        public: Boolean(formData.public),
        status: -1,
      };

      const backendUrl =
        apiUrl ||
        process.env.NEXT_PUBLIC_API_URL ||
        "https://api.subnet118.com";
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
          data = { message: text };
        }
      } else {
        const text = await response.text();
        data = { message: text };
      }

      let responseUuid = "";
      let escrowAddress = "";
      let originAddress = "";
      if (Array.isArray(data) && data.length > 0) {
        responseUuid = data[0].uuid || "";
        escrowAddress = data[0].escrow || "";
        originAddress = data[0].origin || "";
      } else if (data && typeof data === "object") {
        responseUuid = data.uuid || "";
        escrowAddress = data.escrow || "";
        originAddress = data.origin || "";
      }

      if (!escrowAddress) {
        escrowAddress = generateMockEscrowAddress();
      }

      const finalUuid = responseUuid || orderUuid;

      setEscrowWallet(escrowAddress);
      setOriginWallet(originAddress || escrowAddress);
      setOrderUuid(finalUuid);
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

      // Check if wallet is connected
      if (!isConnected || !selectedAccount?.address) {
        setError("Please connect your wallet to place an order. Click the 'Wallet' button to get started.");
        setLoading(false);
        return;
      }

      if (!orderUuid || !escrowWallet) {
        throw new Error("Missing order UUID or escrow wallet address");
      }

      const orderData = {
        uuid: orderUuid,
        origin: originWallet || escrowWallet,
        escrow: escrowWallet,
        wallet: selectedAccount.address,
        asset: Number(formData.asset),
        type: Number(formData.type),
        ask: Number(formData.type === 1 ? formData.stp : 0.0),
        bid: Number(formData.type === 2 ? formData.stp : 0.0),
        stp: Number(formData.stp),
        lmt: Number(formData.stp),
        gtd:
          formData.gtd === "gtc" ? "gtc" : selectedDate?.toISOString() || "gtc",
        partial: formData.partial ? "True" : "False",
        public: formData.public ? "True" : "False",
        status: 1,
      };

      const backendUrl =
        apiUrl ||
        process.env.NEXT_PUBLIC_API_URL ||
        "https://api.subnet118.com";
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
      <DialogContent className="sm:max-w-[500px]">
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

        {/* Order Details Form */}
        <div className="grid gap-4 py-4">
          {/* Escrow Wallet Address (always visible) */}
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

          {/* Order Type Select */}
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

          {/* Asset (NETUID) */}
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

          {/* Good Till Date */}
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

          {/* Stop Price */}
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
                onClick={handleNext}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
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
                onClick={isInReviewMode ? handleReviewOrder : handlePlaceOrder}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                {isInReviewMode ? "Review Order" : "Place Order"}
              </Button>
            </>
          )}
        </DialogFooter>

        {/* Review Order Buttons (shown below footer) */}
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

        {/* Payment Buttons (shown below footer) */}
        {showPaymentButtons && (
          <div className="flex gap-2 justify-end mt-4 pt-4 border-t">
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
            <Button
              onClick={handlePlaceOrder}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              Place Order
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
