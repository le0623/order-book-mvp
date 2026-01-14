"use client";

import * as React from "react";
import { Order, getOrderStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Edit2,
  X,
  Copy,
  CheckIcon,
  Wallet2,
  Plus,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { formatDate, formatPrice, formatNumber } from "./columns";
import { FillOrderModal } from "../fill-order-modal";
import { getOrderType, formatWalletAddress } from "@/lib/types";

interface OrderBookRowDetailsProps {
  order: Order;
  filledOrders?: Order[]; // Orders with same UUID and status=2
  prices?: Record<number, number>; // netuid -> price mapping for live prices
  newlyAddedOrderIds?: Map<string, number>; // Track newly added orders for flash animation
  onUpdateOrder?: (uuid: string, updates: Partial<Order>) => void;
  onCancelOrder?: (uuid: string) => void;
  onFillOrder?: () => void;
  apiUrl?: string;
}

export function OrderBookRowDetails({
  order,
  filledOrders = [],
  prices = {},
  newlyAddedOrderIds = new Map(),
  onUpdateOrder,
  onCancelOrder,
  onFillOrder,
  apiUrl,
}: OrderBookRowDetailsProps) {
  const [copiedWalletId, setCopiedWalletId] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isFillOrderModalOpen, setIsFillOrderModalOpen] = React.useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = React.useState(false);
  const [editStp, setEditStp] = React.useState(order.stp);
  const [editPublic, setEditPublic] = React.useState(order.public);
  const [isFlashing, setIsFlashing] = React.useState(false);
  const paneRef = React.useRef<HTMLDivElement>(null);

  // Update local state when order prop changes (after modification)
  React.useEffect(() => {
    setEditStp(order.stp);
    setEditPublic(order.public);
  }, [order.stp, order.public]);

  // Reset edit values when dialog opens
  React.useEffect(() => {
    if (isEditDialogOpen) {
      setEditStp(order.stp);
      setEditPublic(order.public);
    }
  }, [isEditDialogOpen, order.stp, order.public]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedWalletId(true);
      setTimeout(() => setCopiedWalletId(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleSaveEdit = async () => {
    if (onUpdateOrder) {
      // Check if any fields changed
      const hasChanges = editStp !== order.stp || editPublic !== order.public;

      // Close the modal first
      setIsEditDialogOpen(false);

      await onUpdateOrder(order.uuid, { stp: editStp, public: editPublic });

      // Flash the entire pane if there were changes
      if (hasChanges) {
        console.log("Triggering flash animation");
        // Small delay to ensure dialog is closed and pane is visible
        setTimeout(() => {
          setIsFlashing(false); // Reset first
          // Force browser reflow to restart animation
          setTimeout(() => {
            setIsFlashing(true);
            console.log("Flash animation triggered");
            // Reset after animation completes
            setTimeout(() => {
              setIsFlashing(false);
            }, 1500);
          }, 10);
        }, 200);
      }
    }
  };

  return (
    <div className="bg-muted/30 p-6 space-y-6 shadow-inner border-t border-border/50">
      {/* Header / Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            Order Detail
          </h3>
          {order.status === 1 && ( // Status 1 = Open
            <>
              <Dialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-gray-600 rounded-md bg-transparent"
                  >
                    <Edit2 className="h-3.5 w-3.5 mr-2" />
                    Modify
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Modify Order</DialogTitle>
                    <DialogDescription>
                      Update order settings for Escrow{" "}
                      {formatWalletAddress(order.escrow)}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="stp">Stop Price (TAO)</Label>
                      <div className="relative flex items-center">
                        <Input
                          id="stp"
                          type="number"
                          min="0"
                          step="0.001"
                          value={editStp}
                          onChange={(e) =>
                            setEditStp(parseFloat(e.target.value) || 0)
                          }
                          className="font-mono focus-visible:ring-1 focus-visible:ring-blue-500/30 focus-visible:ring-offset-0 focus-visible:border-blue-500/40 pr-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <div className="absolute right-1 flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditStp(Number((editStp + 0.001).toFixed(3)));
                            }}
                            className="h-4 w-6 flex items-center justify-center rounded-sm border border-border bg-background hover:bg-muted active:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            aria-label="Increase stop price"
                          >
                            <ChevronUp className="h-3 w-3 text-muted-foreground" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const newValue = Math.max(
                                0,
                                Number((editStp - 0.001).toFixed(3))
                              );
                              setEditStp(newValue);
                            }}
                            className="h-4 w-6 flex items-center justify-center rounded-sm border border-border bg-background hover:bg-muted active:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            aria-label="Decrease stop price"
                          >
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Stop price for this order
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="public"
                        checked={editPublic}
                        onCheckedChange={(checked: boolean) =>
                          setEditPublic(checked === true)
                        }
                      />
                      <Label
                        htmlFor="public"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Public Order
                      </Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditStp(order.stp);
                        setEditPublic(order.public);
                        setIsEditDialogOpen(false);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveEdit}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    >
                      Save Changes
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button
                variant="outline"
                size="sm"
                className="h-8 border-gray-600 rounded-md bg-transparent"
                onClick={() => setIsCloseConfirmOpen(true)}
              >
                <span className="text-sm mr-2">✗</span>
                Close Order
              </Button>
              <Dialog
                open={isCloseConfirmOpen}
                onOpenChange={setIsCloseConfirmOpen}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Close Order</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to close this order? This action
                      cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsCloseConfirmOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        onCancelOrder?.(order.uuid);
                        setIsCloseConfirmOpen(false);
                      }}
                    >
                      Close Order
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>

        {order.status === 1 && (
          <Button
            size="sm"
            className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => setIsFillOrderModalOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-2" />
            Fill Order
          </Button>
        )}
      </div>

      {/* Simplified Order Details - Only Wallet, Stop Price, Public */}
      <div className="space-y-4">
        <div
          ref={paneRef}
          className={`p-4 rounded-lg border border-grey-600 space-y-4 `}
          style={
            isFlashing
              ? {
                  backgroundColor: "rgb(96 165 250 / 0.5)",
                  animation: "flash-pane 1.5s ease-out",
                }
              : {}
          }
        >
          {order.wallet && (
            <div className="grid gap-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                WALLET
              </span>
              <div className="flex items-start gap-2">
                <code
                  className="font-mono py-2 break-all"
                  style={{ fontSize: "0.875rem" }}
                >
                  {order.wallet}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0 bg-transparent border-transparent hover:bg-transparent hover:border-transparent"
                  onClick={() => copyToClipboard(order.wallet)}
                >
                  {copiedWalletId ? (
                    <CheckIcon className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-2">
                STOP
              </span>
              <span className="font-mono text-sm">
                {order.stp > 0 ? formatPrice(order.stp) : "—"}
              </span>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-2">
                PUBLIC
              </span>
              <span className="text-sm font-bold">
                {order.public ? "Yes" : "No"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filled Orders List */}
      {filledOrders.length > 0 && (
        <>
          <div className="space-y-3">
            <h3 className="text-base font-semibold tracking-tight text-foreground">
              Filled Orders
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <tbody>
                  {filledOrders.map((filledOrder, index) => {
                    // Use filled order's type (opposite of parent order)
                    // Use parent order values for asset, Tao, Alpha, GTD, Partial
                    // Use filled order's stp for Price (fixed at fill time)
                    const orderTypeLabel = getOrderType(filledOrder.type);
                    // Use a unique key combining UUID, escrow, and index for uniqueness
                    const uniqueKey = `${filledOrder.uuid}-${filledOrder.escrow}-${index}`;

                    // For filled orders, GTD is empty
                    const displayGtd = "";

                    // Check if this filled order should flash
                    const filledOrderId = `${filledOrder.uuid}-${
                      filledOrder.status
                    }-${filledOrder.escrow || ""}`;
                    const shouldFlash = newlyAddedOrderIds.has(filledOrderId);
                    const filledOrderType =
                      newlyAddedOrderIds.get(filledOrderId);
                    const flashClass = shouldFlash
                      ? filledOrderType === 2
                        ? "animate-flash-buy"
                        : "animate-flash-sell"
                      : "";

                    return (
                      <tr
                        key={uniqueKey}
                        className={`hover:bg-muted/50 transition-colors ${flashClass}`}
                      >
                        <td
                          className="pr-3 pt-3 pb-3 pl-[0.5rem] font-mono whitespace-nowrap"
                          style={{ width: 160, fontSize: "0.875rem" }}
                        >
                          {formatDate(filledOrder.date)}
                        </td>
                        <td
                          className="pr-3 pt-3 pb-3 pl-[0.5rem] font-mono whitespace-nowrap overflow-hidden text-ellipsis"
                          style={{ width: 100, fontSize: "0.875rem" }}
                        >
                          {formatWalletAddress(filledOrder.escrow)}
                        </td>
                        <td
                          className="pr-3 pt-3 pb-3 pl-[0.5rem]"
                          style={{ width: 75 }}
                        >
                          <Badge
                            variant={
                              orderTypeLabel === "Buy" ? "outline" : "secondary"
                            }
                            className={`font-medium ${
                              orderTypeLabel === "Buy"
                                ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400"
                                : "text-rose-600 border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400"
                            }`}
                          >
                            {orderTypeLabel}
                          </Badge>
                        </td>
                        <td
                          className="pr-3 pt-3 pb-3 pl-[0.5rem] font-mono text-sm"
                          style={{ width: 50 }}
                        >
                          {order.asset === 0 ? "—" : `SN${order.asset}`}
                        </td>
                        <td
                          className="pr-3 pt-3 pb-3 pl-[0.5rem] text-right font-mono text-sm"
                          style={{ width: 70 }}
                        >
                          {formatNumber(order.bid || 0)}
                        </td>
                        <td
                          className="p-3 text-right font-mono text-sm"
                          style={{ width: 70 }}
                        >
                          {formatNumber(order.ask || 0)}
                        </td>
                        <td
                          className="pr-3 pt-3 pb-3 pl-[1rem] font-mono text-sm"
                          style={{ width: 90 }}
                        >
                          {formatPrice(filledOrder.stp || 0)}
                        </td>
                        <td
                          className="pr-3 pt-3 pb-3 pl-[1.5rem] font-mono whitespace-nowrap"
                          style={{ width: 110, fontSize: "0.875rem" }}
                        >
                          {displayGtd}
                        </td>
                        <td
                          className="pr-3 pt-3 pb-3 pl-[2rem] text-center"
                          style={{ width: 80 }}
                        >
                          <span className="text-sm">{""}</span>
                        </td>
                        <td
                          className="pr-3 pt-3 pb-3 pl-[2rem]"
                          style={{ width: 90 }}
                        >
                          <Badge variant="outline" className="font-medium">
                            Filled
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Fill Order Modal */}
      <FillOrderModal
        open={isFillOrderModalOpen}
        onOpenChange={setIsFillOrderModalOpen}
        order={order}
        prices={prices}
        apiUrl={apiUrl}
        onOrderFilled={onFillOrder}
      />
    </div>
  );
}
