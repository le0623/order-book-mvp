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
import { Edit2, X, Copy, CheckIcon, Wallet2, Plus } from "lucide-react";
import { formatDate } from "./columns";
import { FillOrderModal } from "../fill-order-modal";
import { getOrderType, formatWalletAddress } from "@/lib/types";
import { formatNumber, formatPrice } from "./columns";

interface OrderBookRowDetailsProps {
  order: Order;
  filledOrders?: Order[]; // Orders with same UUID and status=2
  prices?: Record<number, number>; // netuid -> price mapping for live prices
  onUpdateOrder?: (uuid: string, updates: Partial<Order>) => void;
  onCancelOrder?: (uuid: string) => void;
  onFillOrder?: () => void;
  apiUrl?: string;
}

export function OrderBookRowDetails({
  order,
  filledOrders = [],
  prices = {},
  onUpdateOrder,
  onCancelOrder,
  onFillOrder,
  apiUrl,
}: OrderBookRowDetailsProps) {
  const [copiedWalletId, setCopiedWalletId] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isFillOrderModalOpen, setIsFillOrderModalOpen] = React.useState(false);
  const [editStp, setEditStp] = React.useState(order.stp);
  const [editPublic, setEditPublic] = React.useState(order.public);

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
      await onUpdateOrder(order.uuid, { stp: editStp, public: editPublic });
      // Close the modal after saving
      // The order pane will stay expanded because the row remains expanded
      setIsEditDialogOpen(false);
    }
  };

  return (
    <div className="bg-muted/30 p-6 space-y-6 shadow-inner border-t border-border/50">
      {/* Header / Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            Order Detail
          </h3>
          <p className="text-sm text-muted-foreground">
            Manage order parameters and view history.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {order.status === 1 && ( // Status 1 = Open
            <>
              <Dialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <Edit2 className="h-3.5 w-3.5 mr-2" />
                    Modify
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Modify Order</DialogTitle>
                    <DialogDescription>
                      Update order settings for Order {order.uuid.slice(0, 8)}
                      ...
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="stp">Stop Price</Label>
                      <Input
                        id="stp"
                        type="number"
                        step="0.000001"
                        value={editStp}
                        onChange={(e) =>
                          setEditStp(parseFloat(e.target.value) || 0)
                        }
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground">
                        Stop price for this order
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="public"
                        checked={editPublic}
                        onCheckedChange={(checked) =>
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
                    <Button onClick={handleSaveEdit}>Save Changes</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => onCancelOrder?.(order.uuid)}
              >
                <X className="h-3.5 w-3.5 mr-2" />
                Close Order
              </Button>

              <Button
                size="sm"
                className="h-8 bg-blue-600 hover:bg-blue-700 text-white ml-auto"
                onClick={() => setIsFillOrderModalOpen(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-2" />
                Fill Order
              </Button>
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* Simplified Order Details - Only Wallet, Stop Price, Public */}
      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-background border space-y-4">
          {order.wallet && (
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                WALLET
              </span>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 text-xs bg-muted p-2 rounded break-all">
                  {order.wallet}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
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
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                STOP
              </span>
              <p className="font-mono text-sm mt-1">
                {order.stp > 0 ? order.stp.toFixed(2) : "—"}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                PUBLIC
              </span>
              <p className="text-sm mt-1">{order.public ? "Yes" : "No"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filled Orders List */}
      {filledOrders.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Filled Orders</h4>
            <div className="rounded-lg border bg-background overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="text-left p-3 font-semibold text-xs">
                        Date
                      </th>
                      <th className="text-left p-3 font-semibold text-xs">
                        Escrow
                      </th>
                      <th className="text-left p-3 font-semibold text-xs">
                        Order
                      </th>
                      <th className="text-left p-3 font-semibold text-xs">
                        Asset
                      </th>
                      <th className="text-right p-3 font-semibold text-xs">
                        Tao
                      </th>
                      <th className="text-right p-3 font-semibold text-xs">
                        Alpha
                      </th>
                      <th className="text-left p-3 font-semibold text-xs">
                        Price
                      </th>
                      <th className="text-left p-3 font-semibold text-xs">
                        GTD
                      </th>
                      <th className="text-center p-3 font-semibold text-xs">
                        Partial
                      </th>
                      <th className="text-left p-3 font-semibold text-xs">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filledOrders.map((filledOrder, index) => {
                      // Use parent order type and asset (these don't change)
                      // Use filled order's own bid (Tao), ask (Alpha), stp (Price) - values captured when filled
                      const orderType = getOrderType(order.type);
                      // Use a unique key combining UUID, escrow, and index for uniqueness
                      const uniqueKey = `${filledOrder.uuid}-${filledOrder.escrow}-${index}`;
                      return (
                        <tr
                          key={uniqueKey}
                          className="border-b last:border-b-0 hover:bg-muted/30"
                        >
                          <td className="p-3 font-mono text-xs">
                            {formatDate(filledOrder.date)}
                          </td>
                          <td className="p-3 font-mono text-xs">
                            {formatWalletAddress(filledOrder.escrow)}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={
                                orderType === "Buy" ? "outline" : "secondary"
                              }
                              className={`text-xs ${
                                orderType === "Buy"
                                  ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400"
                                  : "text-rose-600 border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400"
                              }`}
                            >
                              {orderType}
                            </Badge>
                          </td>
                          <td className="p-3 font-mono text-sm">
                            {order.asset === 0 ? "—" : `SN${order.asset}`}
                          </td>
                          <td className="p-3 text-right font-mono text-sm">
                            {formatNumber(filledOrder.bid || 0)}
                          </td>
                          <td className="p-3 text-right font-mono text-sm">
                            {formatNumber(filledOrder.ask || 0)}
                          </td>
                          <td className="p-3 font-mono text-sm">
                            {formatPrice(filledOrder.stp || 0)}
                          </td>
                          <td className="p-3 font-mono text-xs whitespace-nowrap">
                            —
                          </td>
                          <td className="p-3 text-center">
                            <span className="text-sm">—</span>
                          </td>
                          <td className="p-3">
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
