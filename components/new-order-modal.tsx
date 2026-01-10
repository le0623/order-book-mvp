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
import { CalendarIcon, Loader2, Copy, CheckIcon } from "lucide-react";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import { NewOrderFormData } from "@/lib/types";

interface NewOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderPlaced?: () => void;
  apiUrl?: string;
}

// Generate a random mock ss58 address (coldkey format)
// SS58 addresses are base58 encoded, typically 48 characters
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
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(
    undefined
  );
  const [escrowGenerated, setEscrowGenerated] = React.useState(false);
  const [copiedEscrow, setCopiedEscrow] = React.useState(false);
  const [showReviewButtons, setShowReviewButtons] = React.useState(false);
  const [showPaymentButtons, setShowPaymentButtons] = React.useState(false);
  const [isInReviewMode, setIsInReviewMode] = React.useState(false);

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

      // Prepare data for backend with all required fields
      // Backend expects: uuid, origin, escrow, wallet, asset, type, ask, bid, stp, lmt, gtd, partial, public, status
      // Note: 'date' is automatically added by backend
      // Column order from records.ini: date,uuid,origin,escrow,wallet,asset,type,ask,bid,stp,lmt,gtd,partial,public,status
      const orderUuid = uuidv4(); // Generate unique UUID for this order
      const orderData = {
        uuid: orderUuid, // Unique identifier for the order (required by backend)
        origin: "", // Backend will populate this when status=-1 (escrow generation)
        escrow: "", // Backend will populate this when status=-1 (escrow generation)
        wallet: "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty", // Mock ss58 address (user wallet)
        asset: Number(formData.asset), // NETUID - ensure it's a number
        type: Number(formData.type), // 1: sell, 2: buy - ensure it's a number
        ask: Number(formData.type === 1 ? formData.stp : 0.0), // For sell orders, ask = stop price
        bid: Number(formData.type === 2 ? formData.stp : 0.0), // For buy orders, bid = stop price
        stp: Number(formData.stp), // Stop price - ensure it's a number
        lmt: Number(formData.stp), // Limit price (using stop price for now) - ensure it's a number
        gtd:
          formData.gtd === "gtc" ? "gtc" : selectedDate?.toISOString() || "gtc", // Good till date
        partial: Boolean(formData.partial), // Allow partial fills - ensure it's a boolean
        public: Boolean(formData.public), // Public order visibility - ensure it's a boolean
        status: -1, // -1 = Init status (triggers escrow generation in backend)
      };

      // Call backend API directly (CORS is now handled by backend)
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
          `Server error (${response.status}): ${
            errorText || response.statusText
          }`
        );
      }

      // Parse response - backend returns JSON array with the created order
      let data: any;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        try {
          data = await response.json();
        } catch {
          // If JSON parsing fails, try as text
          const text = await response.text();
          data = { message: text };
        }
      } else {
        const text = await response.text();
        data = { message: text };
      }

      // Backend returns array of records: [{"date": "...", "uuid": "...", "origin": "...", "escrow": "...", ...}]
      // Extract escrow and origin addresses from the response
      let escrowAddress = "";
      let originAddress = "";
      if (Array.isArray(data) && data.length > 0) {
        // Response is an array of records
        escrowAddress = data[0].escrow || "";
        originAddress = data[0].origin || "";
      } else if (data && typeof data === "object") {
        // Response might be a single object
        escrowAddress = data.escrow || "";
        originAddress = data.origin || "";
      }

      // If no escrow found in response, use mock (shouldn't happen if backend works correctly)
      if (!escrowAddress) {
        escrowAddress = generateMockEscrowAddress();
      }

      setEscrowWallet(escrowAddress);
      setOriginWallet(originAddress || escrowAddress); // Use origin if available, otherwise use escrow
      setOrderUuid(orderUuid); // Store UUID for reuse when placing order
      setEscrowGenerated(true); // Mark escrow as generated, form becomes read-only
    } catch (err: any) {
      console.error("Error creating order:", err);
      setError(err.message || "Failed to create order");
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!escrowGenerated) {
      // First "Place Order" click - show review buttons
      setShowReviewButtons(true);
    } else if (showReviewButtons) {
      // "Place Order" from review - proceed to payment
      setShowReviewButtons(false);
      setShowPaymentButtons(true);
    } else if (showPaymentButtons) {
      // Final "Place Order" - send order to backend with status = 1 (Open)
      await handleFinalPlaceOrder();
    } else if (escrowGenerated && !isInReviewMode) {
      // Escrow generated, user clicks "Place Order" for the first time
      await handleFinalPlaceOrder();
    }
  };

  const handleFinalPlaceOrder = async () => {
    try {
      setLoading(true);
      setError("");

      if (!orderUuid || !escrowWallet) {
        throw new Error("Missing order UUID or escrow wallet address");
      }

      // Prepare data for backend with status = 1 (Open)
      // Backend expects: uuid, origin, escrow, wallet, asset, type, ask, bid, stp, lmt, gtd, partial, public, status
      const orderData = {
        uuid: orderUuid, // Reuse the same UUID from escrow generation
        origin: originWallet || escrowWallet, // Use origin wallet from backend response, fallback to escrow
        escrow: escrowWallet, // Escrow wallet address
        wallet: "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty", // Mock ss58 address (user wallet)
        asset: Number(formData.asset), // NETUID
        type: Number(formData.type), // 1: sell, 2: buy
        ask: Number(formData.type === 1 ? formData.stp : 0.0), // For sell orders, ask = stop price
        bid: Number(formData.type === 2 ? formData.stp : 0.0), // For buy orders, bid = stop price
        stp: Number(formData.stp), // Stop price
        lmt: Number(formData.stp), // Limit price (using stop price)
        gtd:
          formData.gtd === "gtc" ? "gtc" : selectedDate?.toISOString() || "gtc", // Good till date
        partial: formData.partial ? "True" : "False", // Backend expects string "True"/"False"
        public: formData.public ? "True" : "False", // Backend expects string "True"/"False"
        status: 1, // 1 = Open status (order is now active)
      };

      // Call backend API
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
          `Server error (${response.status}): ${
            errorText || response.statusText
          }`
        );
      }

      // Order placed successfully
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
      // Back from payment to review
      setShowPaymentButtons(false);
      setShowReviewButtons(true);
    } else if (showReviewButtons) {
      // Back from review to initial place order
      setShowReviewButtons(false);
    } else if (escrowGenerated && isInReviewMode) {
      // Back from review mode - exit review mode, reset to before escrow generation
      setIsInReviewMode(false);
      setEscrowGenerated(false);
      setEscrowWallet("");
    } else if (escrowGenerated && !isInReviewMode) {
      // Back from place order state - enter review mode (form becomes editable)
      setIsInReviewMode(true);
    }
  };

  const handleCancel = () => {
    // Close modal and reset everything
    onOpenChange(false);
    resetForm();
  };

  const handleReviewOrder = () => {
    if (isInReviewMode) {
      // Review Order clicked - exit review mode, make form read-only again
      setIsInReviewMode(false);
    } else {
      // Move from review to payment buttons
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
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
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
                <SelectItem value="1">Sell</SelectItem>
                <SelectItem value="2">Buy</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Asset (NETUID) */}
          <div className="grid gap-2">
            <Label htmlFor="asset">Asset (NETUID)</Label>
            <Input
              id="asset"
              type="number"
              min="0"
              value={formData.asset}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  asset: parseInt(e.target.value) || 0,
                })
              }
              disabled={escrowGenerated && !isInReviewMode}
              className="focus-visible:ring-1 focus-visible:ring-blue-500/30 focus-visible:ring-offset-0 focus-visible:border-blue-500/40"
            />
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
                  <SelectItem value="gtc">GTC</SelectItem>
                  <SelectItem value="date">Specific Date</SelectItem>
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
            <Input
              id="stp"
              type="number"
              min="0"
              step="0.01"
              value={formData.stp}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  stp: parseFloat(e.target.value) || 0,
                })
              }
              disabled={escrowGenerated && !isInReviewMode}
              className="focus-visible:ring-1 focus-visible:ring-blue-500/30 focus-visible:ring-offset-0 focus-visible:border-blue-500/40"
            />
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
            <Button onClick={handleReviewOrder}>Review Order</Button>
          </div>
        )}

        {/* Payment Buttons (shown below footer) */}
        {showPaymentButtons && (
          <div className="flex gap-2 justify-end mt-4 pt-4 border-t">
            <Button variant="outline" onClick={handleBack}>
              Back
            </Button>
            <Button onClick={handlePlaceOrder}>Place Order</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
