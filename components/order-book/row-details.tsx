"use client";

import * as React from "react";
import { Order } from "@/lib/mock-data";
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

// Define styling map locally or import if shared
const getStatusVariantColor = (status: string) => {
  const statusColors: Record<string, string> = {
    Open: "text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    Completed:
      "text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    Canceled:
      "text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
    Pending:
      "text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    Failed:
      "text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800",
    Partial:
      "text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  };
  return statusColors[status] || "";
};

interface OrderBookRowDetailsProps {
  order: Order;
  onUpdateOrder?: (id: string, ask: number, bid: number) => void;
  onCancelOrder?: (id: string) => void;
  onAcceptOrder?: (id: string) => void;
}

export function OrderBookRowDetails({
  order,
  onUpdateOrder,
  onCancelOrder,
  onAcceptOrder,
}: OrderBookRowDetailsProps) {
  const [copiedWalletId, setCopiedWalletId] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [editAsk, setEditAsk] = React.useState(order.ask);
  const [editBid, setEditBid] = React.useState(order.bid);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedWalletId(true);
      setTimeout(() => setCopiedWalletId(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleSaveEdit = () => {
    if (onUpdateOrder) {
      onUpdateOrder(order.id, editAsk, editBid);
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
          {order.status === "Open" && (
            <>
              <Dialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <Edit2 className="h-3.5 w-3.5 mr-2" />
                    Adjust Limits
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Update Order Limits</DialogTitle>
                    <DialogDescription>
                      Modify the Ask and Bid prices for Order #{order.sn}.
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
                onClick={() => onCancelOrder?.(order.id)}
              >
                <X className="h-3.5 w-3.5 mr-2" />
                Cancel
              </Button>

              <Button
                size="sm"
                className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => onAcceptOrder?.(order.id)}
              >
                <Check className="h-3.5 w-3.5 mr-2" />
                Accept
              </Button>
            </>
          )}
        </div>
      </div>

      <Separator />

      <div className="grid md:grid-cols-2 gap-8">
        {/* History Column */}
        <div>
          <h4 className="font-medium text-sm mb-4 flex items-center gap-2">
            <Timer className="w-4 h-4" />
            Transaction History
          </h4>
          <div className="space-y-3 pl-2 border-dashed border-l-2 border-border/50">
            {order.history.map((item, idx) => (
              <div key={idx} className="relative pl-6 pb-2">
                <div className="absolute -left-[12px] top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-muted-foreground/30" />
                <div className="flex flex-col gap-1 p-3 rounded-md bg-background border text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-mono">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                    <Badge
                      variant="outline"
                      className={`${getStatusVariantColor(
                        item.status
                      )} text-[10px] px-1.5 py-0 h-5`}
                    >
                      {item.status}
                    </Badge>
                  </div>
                  {(item.ask !== undefined || item.bid !== undefined) && (
                    <div className="flex gap-4 mt-1 font-mono text-xs">
                      {item.ask && <span>Ask: {item.ask}</span>}
                      {item.bid && <span>Bid: {item.bid}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Details Column */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm mb-4 flex items-center gap-2">
            <Wallet2 className="w-4 h-4" />
            Wallet & Metadata
          </h4>

          <div className="p-4 rounded-lg bg-background border space-y-4">
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                ORDER ID
              </span>
              <p className="font-mono text-sm mt-1 select-all">{order.id}</p>
            </div>

            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                FULL WALLET
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
          </div>
        </div>
      </div>
    </div>
  );
}
