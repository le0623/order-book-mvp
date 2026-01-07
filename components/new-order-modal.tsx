"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
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
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; // Base58 alphabet
  const prefix = '5'; // Common Substrate/Polkadot address prefix
  let address = prefix;
  for (let i = 0; i < 47; i++) {
    address += chars[Math.floor(Math.random() * chars.length)];
  }
  return address;
};

export function NewOrderModal({ open, onOpenChange, onOrderPlaced }: NewOrderModalProps) {
 
  const [formData, setFormData] = React.useState<NewOrderFormData>({
    type: 1, // 1 = Sell (default)
    asset: 1, // Subnet ID (default)
    gtd: "gtc", // Good till cancel (default)
    stp: 0,
    partial: true,
    public: true,
  });
  const [escrowWallet, setEscrowWallet] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(undefined);
  const [escrowGenerated, setEscrowGenerated] = React.useState(false);
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
    setError("");
    setSelectedDate(undefined);
    setEscrowGenerated(false);
    setShowReviewButtons(false);
    setShowPaymentButtons(false);
    setIsInReviewMode(false);
  };

 
  const handleNext = async () => {
    try {
      setLoading(true);
      setError("");

      // Prepare data for backend with all required fields
      // Mock data for missing fields (will be replaced with real data later)
      const orderData = {
        origin: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY", // Mock ss58 address (order creator)
        escrow: "", // Empty - backend will generate escrow wallet
        wallet: "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty", // Mock ss58 address (user wallet)
        asset: formData.asset,
        type: formData.type,
        ask: formData.type === 1 ? formData.stp : 0, // For sell orders, ask = stop price
        bid: formData.type === 2 ? formData.stp : 0, // For buy orders, bid = stop price
        stp: formData.stp,
        lmt: formData.stp, // Using stop price as limit price for now (mock)
        gtd: formData.gtd === "gtc" ? "gtc" : (selectedDate?.toISOString() || ""),
        partial: formData.partial,
        public: formData.public,
        status: -1, // -1 = Init status (default for new orders)
      };

      // Use Next.js API route proxy to bypass CORS restrictions
      // The proxy route (/api/orders) calls the external API server-side
      const response = await fetch('/api/orders', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      }).catch((error) => {
        if (error.message === 'Failed to fetch') {
          throw new Error('Cannot connect to server. This may be due to network issues or the server being unavailable.');
        }
        throw error;
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error (${response.status}): ${errorText || response.statusText}`);
      }

      const data = await response.json();

      // Generate mock escrow coldkey (backend doesn't implement escrow creation yet)
      // SS58 format: typically 48 characters, base58 encoded
      const mockEscrowAddress = generateMockEscrowAddress();
      
      setEscrowWallet(mockEscrowAddress);
      setEscrowGenerated(true); // Mark escrow as generated, form becomes read-only
    } catch (err: any) {
      console.error("❌ Error creating order:", err);
      setError(err.message || "Failed to create order");
    } finally {
      setLoading(false);
    }
  };

 
  const handlePlaceOrder = () => {
    if (!escrowGenerated) {
      // First "Place Order" click - show review buttons
      setShowReviewButtons(true);
    } else if (showReviewButtons) {
      // "Place Order" from review - proceed to payment
      setShowReviewButtons(false);
      setShowPaymentButtons(true);
    } else if (showPaymentButtons) {
      // Final "Place Order" - complete the order
      onOrderPlaced?.();
      onOpenChange(false);
      resetForm();
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
          {/* Escrow Wallet Address (shown after generation) */}
          {escrowGenerated && (
            <div className="p-4 rounded-lg bg-muted/50 border">
              <p className="text-sm font-medium mb-2">Escrow Wallet Address:</p>
              <code className="text-xs bg-background p-2 rounded block break-all">
                {escrowWallet}
              </code>
            </div>
          )}

          {/* Order Type Select */}
          <div className="grid gap-2">
            <Label htmlFor="type">Order Type</Label>
              <Select
                value={String(formData.type)}
                onValueChange={(value) => setFormData({ ...formData, type: parseInt(value) })}
                disabled={escrowGenerated && !isInReviewMode}
              >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Sell</SelectItem>
                <SelectItem value="2">Buy</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Asset (Subnet ID) */}
          <div className="grid gap-2">
            <Label htmlFor="asset">Asset (Subnet ID)</Label>
              <Input
                id="asset"
                type="number"
                min="0"
                value={formData.asset}
                onChange={(e) => setFormData({ ...formData, asset: parseInt(e.target.value) || 0 })}
                disabled={escrowGenerated && !isInReviewMode}
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
                <SelectTrigger className="w-32">
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
                      {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
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
            <Label htmlFor="stp">Stop Price (Tao)</Label>
              <Input
                id="stp"
                type="number"
                min="0"
                step="0.01"
                value={formData.stp}
                onChange={(e) => setFormData({ ...formData, stp: parseFloat(e.target.value) || 0 })}
                disabled={escrowGenerated && !isInReviewMode}
              />
          </div>

          <div className={cn("flex items-center space-x-2", escrowGenerated && !isInReviewMode && "opacity-60")}>
            <Checkbox
              id="partial"
              checked={formData.partial}
              onCheckedChange={(checked) => {
                setFormData({ ...formData, partial: checked });
              }}
              disabled={escrowGenerated && !isInReviewMode}
            />
            <Label htmlFor="partial" className="text-sm font-normal cursor-pointer">
              Allow partial fills
            </Label>
          </div>

          <div className={cn("flex items-center space-x-2", escrowGenerated && !isInReviewMode && "opacity-60")}>
            <Checkbox
              id="public"
              checked={formData.public}
              onCheckedChange={(checked) => {
                setFormData({ ...formData, public: checked });
              }}
              disabled={escrowGenerated && !isInReviewMode}
            />
            <Label htmlFor="public" className="text-sm font-normal cursor-pointer">
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
              <Button onClick={handleNext} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Escrow
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
              <Button onClick={isInReviewMode ? handleReviewOrder : handlePlaceOrder} disabled={loading}>
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
            <Button onClick={handleReviewOrder}>
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
            <Button onClick={handlePlaceOrder}>
              Place Order
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

