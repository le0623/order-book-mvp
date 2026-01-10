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
import { v4 as uuidv4 } from "uuid";
import { cn } from "@/lib/utils";

interface FillOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  prices?: Record<number, number>; // netuid -> price mapping for live prices
  apiUrl?: string;
  onOrderFilled?: () => void;
}

// Generate a mock SS58 address (fallback if backend doesn't return escrow)
function generateMockEscrowAddress(): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let address = "5";
  for (let i = 0; i < 47; i++) {
    address += chars[Math.floor(Math.random() * chars.length)];
  }
  return address;
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
  const [originWallet, setOriginWallet] = React.useState<string>("");
  const [orderUuid, setOrderUuid] = React.useState<string>("");
  const [escrowGenerated, setEscrowGenerated] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>("");
  const [copiedEscrow, setCopiedEscrow] = React.useState(false);

  // Capture fixed values when modal opens (same as New Order workflow)
  const fixedValues = React.useMemo(() => {
    const asset = Number(order.asset);
    const livePrice = prices[asset];
    const currentPrice =
      livePrice !== undefined && livePrice > 0 ? livePrice : order.stp;

    // Calculate Tao (bid) and Alpha (ask) from escrow balance and price
    // For now, use the parent order's values as fixed
    const tao = order.type === 2 ? order.bid : 0; // Buy orders have bid (Tao)
    const alpha = order.type === 1 ? order.ask : 0; // Sell orders have ask (Alpha)

    return {
      asset: Number(order.asset),
      type: Number(order.type),
      tao: Number(tao),
      alpha: Number(alpha),
      price: Number(currentPrice),
    };
  }, [order, prices]);

  // Reset form when modal closes
  React.useEffect(() => {
    if (!open) {
      setEscrowWallet("");
      setOriginWallet("");
      setOrderUuid("");
      setEscrowGenerated(false);
      setError("");
      setCopiedEscrow(false);
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

  // Step 1: Create Escrow (same logic as New Order's handleNext)
  const handleCreateEscrow = async () => {
    try {
      setLoading(true);
      setError("");

      // Generate unique UUID for the filled order
      const fillOrderUuid = uuidv4();

      // Prepare data for backend with status=-1 to generate escrow (same as New Order)
      const orderData = {
        uuid: fillOrderUuid, // Unique identifier for the filled order
        origin: "", // Backend will populate this when status=-1 (escrow generation)
        escrow: "", // Backend will populate this when status=-1 (escrow generation)
        wallet:
          order.wallet || "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty", // User wallet
        asset: fixedValues.asset, // From parent order
        type: fixedValues.type, // From parent order
        ask: fixedValues.alpha, // Alpha (ask) at fill time
        bid: fixedValues.tao, // Tao (bid) at fill time
        stp: fixedValues.price, // Price (live or stp) at fill time
        lmt: fixedValues.price, // Limit price same as stop price
        gtd: "gtc", // No GTD for filled orders
        partial: false, // No partial for filled orders
        public: false, // No public flag for filled orders
        status: -1, // -1 = Init status (triggers escrow generation in backend)
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
        escrowAddress = data[0].escrow || "";
        originAddress = data[0].origin || "";
      } else if (data && typeof data === "object") {
        escrowAddress = data.escrow || "";
        originAddress = data.origin || "";
      }

      // If no escrow found in response, use mock (shouldn't happen if backend works correctly)
      if (!escrowAddress) {
        escrowAddress = generateMockEscrowAddress();
      }

      setEscrowWallet(escrowAddress);
      setOriginWallet(originAddress || escrowAddress); // Use origin if available, otherwise use escrow
      setOrderUuid(fillOrderUuid); // Store UUID for reuse when filling order
      setEscrowGenerated(true); // Mark escrow as generated
    } catch (err: any) {
      console.error("Error creating escrow:", err);
      setError(err.message || "Failed to create escrow");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Fill Order (same logic as New Order's handleFinalPlaceOrder, but with status=2)
  const handleFillOrder = async () => {
    if (!escrowGenerated) {
      // First, create escrow
      await handleCreateEscrow();
      return;
    }

    try {
      setLoading(true);
      setError("");

      if (!orderUuid || !escrowWallet) {
        throw new Error("Missing order UUID or escrow wallet address");
      }

      // Prepare order data with fixed values (same origin logic as New Order)
      const fillOrderData = {
        uuid: orderUuid, // Reuse the same UUID from escrow generation
        origin: originWallet || escrowWallet, // Use origin wallet from backend response, fallback to escrow (same as New Order)
        escrow: escrowWallet, // Escrow wallet address from backend
        wallet:
          order.wallet || "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty", // User wallet
        asset: fixedValues.asset, // Fixed: from parent order
        type: fixedValues.type, // Fixed: from parent order
        ask: fixedValues.alpha, // Fixed: Alpha (ask) at fill time
        bid: fixedValues.tao, // Fixed: Tao (bid) at fill time
        stp: fixedValues.price, // Fixed: Price (live or stp) at fill time
        lmt: fixedValues.price, // Fixed: Limit price same as stop price
        gtd: "gtc", // No GTD for filled orders
        partial: "False", // No partial for filled orders
        public: "False", // No public flag for filled orders
        status: 2, // 2 = Filled
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
          `Server error (${response.status}): ${
            errorText || response.statusText
          }`
        );
      }

      // Success - order filled with status=2
      onOrderFilled?.();
      onOpenChange(false);
      setEscrowWallet("");
      setOriginWallet("");
      setOrderUuid("");
      setEscrowGenerated(false);
      setError("");
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
      setEscrowGenerated(false);
      setError("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Fill Order</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="grid gap-4 py-4">
          {/* Escrow Wallet Address (same style as New Order modal) */}
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

          {/* Display fixed values (read-only, for reference) */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
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
                {fixedValues.price > 0 ? fixedValues.price.toFixed(6) : "—"}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Tao (Bid)
              </span>
              <p className="font-mono text-sm mt-1">
                {fixedValues.tao > 0 ? fixedValues.tao.toFixed(6) : "—"}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Alpha (Ask)
              </span>
              <p className="font-mono text-sm mt-1">
                {fixedValues.alpha > 0 ? fixedValues.alpha.toFixed(6) : "—"}
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
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
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
