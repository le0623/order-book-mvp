"use client";

import * as React from "react";
import { Order, getOrderStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Edit2, X, Check, Copy, CheckIcon, Timer, Wallet2 } from "lucide-react";


interface OrderBookRowDetailsProps {
  order: Order;
  onUpdateOrder?: (uuid: string, updates: Partial<Order>) => void;
  onCancelOrder?: (uuid: string) => void;
  onAcceptOrder?: (uuid: string) => void;
}

export function OrderBookRowDetails({
  order,
  onUpdateOrder,
  onCancelOrder,
  onAcceptOrder,
}: OrderBookRowDetailsProps) {
  const [copiedWalletId, setCopiedWalletId] = React.useState(false);
  const [copiedOriginId, setCopiedOriginId] = React.useState(false);
  const [copiedEscrowId, setCopiedEscrowId] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [editAsk, setEditAsk] = React.useState(order.ask);
  const [editBid, setEditBid] = React.useState(order.bid);

  const copyToClipboard = async (text: string, type: 'wallet' | 'origin' | 'escrow') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'wallet') {
      setCopiedWalletId(true);
      setTimeout(() => setCopiedWalletId(false), 2000);
      } else if (type === 'origin') {
        setCopiedOriginId(true);
        setTimeout(() => setCopiedOriginId(false), 2000);
      } else {
        setCopiedEscrowId(true);
        setTimeout(() => setCopiedEscrowId(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleSaveEdit = () => {
    if (onUpdateOrder) {
      onUpdateOrder(order.uuid, { ask: editAsk, bid: editBid });
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
                    Adjust Prices
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Update Order Prices</DialogTitle>
                    <DialogDescription>
                      Modify ask/bid prices for Order {order.uuid.slice(0, 8)}...
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="ask">Ask Price (Tao)</Label>
                        <Input
                          id="ask"
                          type="number"
                          step="0.01"
                          value={editAsk}
                          onChange={(e) =>
                            setEditAsk(parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bid">Bid Price (Tao)</Label>
                        <Input
                          id="bid"
                          type="number"
                          step="0.01"
                          value={editBid}
                          onChange={(e) =>
                            setEditBid(parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsEditDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleSaveEdit}>Save Changes</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button
                variant="destructive"
                size="sm"
                className="h-8 bg-red-600/10 text-red-600 hover:bg-red-600/20 hover:text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900"
                onClick={() => onCancelOrder?.(order.uuid)}
              >
                <X className="h-3.5 w-3.5 mr-2" />
                Cancel
              </Button>

              <Button
                size="sm"
                className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => onAcceptOrder?.(order.uuid)}
              >
                <Check className="h-3.5 w-3.5 mr-2" />
                Accept
              </Button>
            </>
          )}
        </div>
      </div>

      <Separator />

      <div className="grid md:grid-cols-1 gap-8">
        {/* Details Column */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm mb-4 flex items-center gap-2">
            <Wallet2 className="w-4 h-4" />
            Wallet & Metadata
          </h4>

          <div className="p-4 rounded-lg bg-background border space-y-4">
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                ORDER UUID
              </span>
              <p className="font-mono text-sm mt-1 select-all">{order.uuid}</p>
            </div>

            {order.origin && (
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  ORIGIN ADDRESS
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-xs bg-muted p-2 rounded break-all">
                    {order.origin}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => copyToClipboard(order.origin, 'origin')}
                  >
                    {copiedOriginId ? (
                      <CheckIcon className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {order.wallet && (
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  WALLET ADDRESS
              </span>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 text-xs bg-muted p-2 rounded break-all">
                  {order.wallet}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                    onClick={() => copyToClipboard(order.wallet, 'wallet')}
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

            {order.escrow && (
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  ESCROW ADDRESS
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 text-xs bg-muted p-2 rounded break-all">
                    {order.escrow}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => copyToClipboard(order.escrow, 'escrow')}
                  >
                    {copiedEscrowId ? (
                      <CheckIcon className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  ASSET
                </span>
                <p className="font-mono text-sm mt-1">{order.asset}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  STOP PRICE
                </span>
                <p className="font-mono text-sm mt-1">{order.stp > 0 ? order.stp.toFixed(2) : "—"}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  LIMIT PRICE
                </span>
                <p className="font-mono text-sm mt-1">{order.lmt > 0 ? order.lmt.toFixed(2) : "—"}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  PARTIAL FILLS
                </span>
                <p className="text-sm mt-1">{order.partial ? "Yes" : "No"}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  PUBLIC
                </span>
                <p className="text-sm mt-1">{order.public ? "Yes" : "No"}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  GOOD TILL
                </span>
                <p className="font-mono text-xs mt-1">{order.gtd || "—"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
