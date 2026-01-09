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
import { Loader2 } from "lucide-react";
import { Order } from "@/lib/types";

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
  const [escrowWallet, setEscrowWallet] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");

  const handleFillOrder = async () => {
    if (!escrowWallet || escrowWallet.trim() === "") {
      setError("Please enter an escrow wallet address");
      return;
    }

    try {
      setLoading(true);
      setError("");

      // Validate SS58 address format (basic check)
      if (!/^[1-9A-HJ-NP-Za-km-z]{47,48}$/.test(escrowWallet.trim())) {
        throw new Error("Invalid SS58 wallet address format");
      }

      // Calculate current display price: use live price if available, otherwise use stp
      // This ensures the filled order captures the price at the moment of filling
      const asset = Number(order.asset);
      const livePrice = prices[asset];
      const currentPrice =
        livePrice !== undefined && livePrice > 0 ? livePrice : order.stp;

      // Prepare order data with all parent fields + new escrow + status=2
      // Use currentPrice (live or stp) for stp field to fix the price at fill time
      const fillOrderData = {
        uuid: order.uuid, // Same UUID as parent
        origin: order.origin || "",
        escrow: escrowWallet.trim(),
        wallet: order.wallet || "",
        asset: Number(order.asset),
        type: Number(order.type),
        ask: Number(order.ask),
        bid: Number(order.bid),
        stp: Number(currentPrice), // Use current displayed price (live or stp) - this will be fixed
        lmt: Number(order.lmt),
        gtd: order.gtd || "gtc",
        partial: order.partial ? "True" : "False",
        public: order.public ? "True" : "False",
        status: 2, // 2 = Filled
      };

      const backendUrl =
        apiUrl || process.env.NEXT_PUBLIC_API_URL || "https://api.subnet118.com";
      const response = await fetch(`${backendUrl}/rec`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fillOrderData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Failed to fill order";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      
      // Check if status is 2 (filled) or 3 (error)
      if (responseData.status === 3) {
        throw new Error("Order fill resulted in error status");
      }

      // Success
      onOrderFilled?.();
      onOpenChange(false);
      setEscrowWallet("");
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to fill order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false);
      setEscrowWallet("");
      setError("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Fill Order</DialogTitle>
          <DialogDescription>
            Enter the escrow wallet address to fill this order.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="escrow">Escrow Wallet Address</Label>
            <Input
              id="escrow"
              placeholder="5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
              value={escrowWallet}
              onChange={(e) => setEscrowWallet(e.target.value)}
              disabled={loading}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              SS58 format wallet address
            </p>
          </div>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-md border border-red-200 dark:border-red-900">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleFillOrder}
            disabled={loading || !escrowWallet.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Filling...
              </>
            ) : (
              "Fill Order"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

