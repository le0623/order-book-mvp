"use client"

import * as React from "react"
import { ChevronDown, ChevronRight, Edit2, X, Check, Copy, CheckCircle2, Filter, XCircle } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Order, OrderType, OrderStatus } from "@/lib/mock-data"
import { formatWalletAddress } from "@/lib/mock-data"

interface OrderBookProps {
  orders: Order[]
  onUpdateOrder?: (id: string, ask: number, bid: number) => void
  onCancelOrder?: (id: string) => void
  onAcceptOrder?: (id: string) => void
}

const ORDER_STATUSES: OrderStatus[] = ["Open", "Pending", "Canceled", "Failed", "Partial", "Completed"]

export function OrderBook({ orders, onUpdateOrder, onCancelOrder, onAcceptOrder }: OrderBookProps) {
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set())
  const [editDialogOpen, setEditDialogOpen] = React.useState<string | null>(null)
  const [editAsk, setEditAsk] = React.useState<number>(0)
  const [editBid, setEditBid] = React.useState<number>(0)
  const [copiedWalletId, setCopiedWalletId] = React.useState<string | null>(null)
  const [selectedStatuses, setSelectedStatuses] = React.useState<Set<OrderStatus>>(
    new Set(["Open"])
  )
  const [dropdownOpen, setDropdownOpen] = React.useState(false)

  const copyToClipboard = async (text: string, orderId: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedWalletId(orderId)
      setTimeout(() => setCopiedWalletId(null), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  const handleEditClick = (order: Order) => {
    setEditAsk(order.ask)
    setEditBid(order.bid)
    setEditDialogOpen(order.id)
  }

  const handleSaveEdit = () => {
    if (editDialogOpen && onUpdateOrder) {
      onUpdateOrder(editDialogOpen, editAsk, editBid)
      setEditDialogOpen(null)
    }
  }

  const getStatusVariant = (
    status: OrderStatus
  ): "statusOpen" | "statusCompleted" | "statusCanceled" | "statusFailed" | "statusPending" | "statusPartial" => {
    switch (status) {
      case "Open":
        return "statusOpen"
      case "Completed":
        return "statusCompleted"
      case "Canceled":
        return "statusCanceled"
      case "Failed":
        return "statusFailed"
      case "Pending":
        return "statusPending"
      case "Partial":
        return "statusPartial"
      default:
        return "statusOpen"
    }
  }

  const getStatusTextColor = (status: OrderStatus): string => {
    switch (status) {
      case "Open":
        return "text-blue-600 dark:text-blue-400"
      case "Completed":
        return "text-emerald-600 dark:text-emerald-400"
      case "Canceled":
        return "text-red-600 dark:text-red-400"
      case "Failed":
        return "text-rose-600 dark:text-rose-400"
      case "Pending":
        return "text-amber-600 dark:text-amber-400"
      case "Partial":
        return "text-slate-500 dark:text-slate-400"
      default:
        return ""
    }
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    }).format(date)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  }

  const handleStatusToggle = (status: OrderStatus) => {
    const newSelected = new Set(selectedStatuses)
    if (newSelected.has(status)) {
      newSelected.delete(status)
    } else {
      newSelected.add(status)
    }
    setSelectedStatuses(newSelected)
  }

  const handleClearFilters = () => {
    setSelectedStatuses(new Set(["Open"]))
  }

  const filteredOrders = orders.filter((order) => selectedStatuses.has(order.status))

  return (
    <Card className="w-full border-border/50 shadow-lg bg-background">
      <CardHeader className="sticky top-[117px] z-10 bg-background border-b border-border/40 pb-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="text-xl font-semibold tracking-tight">Order Book</CardTitle>
          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Filter
                {selectedStatuses.size > 0 && (
                  <span className="ml-1 rounded-full bg-primary text-primary-foreground px-1.5 py-0.5 text-xs">
                    {selectedStatuses.size}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48" onCloseAutoFocus={(e) => e.preventDefault()}>
              <div className="flex items-center justify-between px-2 py-1.5">
                <DropdownMenuLabel className="p-0">Filter by Status</DropdownMenuLabel>
                <button
                  onClick={() => setDropdownOpen(false)}
                  className="rounded-sm p-1 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  title="Close filter"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
              <DropdownMenuSeparator />
              {ORDER_STATUSES.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={selectedStatuses.has(status)}
                  onCheckedChange={() => handleStatusToggle(status)}
                  onSelect={(e) => e.preventDefault()}
                  className={getStatusTextColor(status)}
                >
                  {status}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <TooltipProvider>
          <div className="rounded-b-lg border-t-0">
            <Table noWrapper>
              <TableHeader className="sticky top-[194px] z-10 bg-background shadow-sm border-b border-border/40">
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Order</TableHead>
                  <TableHead className="font-semibold">SN</TableHead>
                  <TableHead className="font-semibold">Wallet</TableHead>
                  <TableHead className="text-right font-semibold">Size</TableHead>
                  <TableHead className="text-right font-semibold">Ask</TableHead>
                  <TableHead className="text-right font-semibold">Bid</TableHead>
                  <TableHead className="font-semibold">Partial</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No orders found with the selected status filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => {
                const isExpanded = expandedRows.has(order.id)
                return (
                  <React.Fragment key={order.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/70 dark:hover:bg-[#2d5977]"
                      onClick={() => toggleRow(order.id)}
                    >
                      <TableCell>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatDate(order.date)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={order.order === "Buy" ? "buy" : "sell"}
                          className="font-medium"
                        >
                          {order.order}
                        </Badge>
                      </TableCell>
                      <TableCell>{order.sn}</TableCell>
                      <TableCell className="font-mono text-xs" onClick={(e) => e.stopPropagation()}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">{formatWalletAddress(order.wallet)}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-mono text-xs">{order.wallet}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(order.size)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(order.ask)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(order.bid)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {order.partial ? "Yes" : "No"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(order.status)} className="font-medium">
                          {order.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="shadow-[0_2px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_4px_rgba(0,0,0,0.2)]">
                        <TableCell colSpan={10} className="bg-muted/20 p-0 border-t border-border/30 shadow-inner">
                          <div className="p-6 space-y-5">
                            <div className="flex items-center justify-between pb-2">
                              <h3 className="text-base font-semibold tracking-tight">Order Details</h3>
                              <div className="flex gap-2">
                                {order.status === "Open" && (
                                  <>
                                    <Dialog
                                      open={editDialogOpen === order.id}
                                      onOpenChange={(open) => !open && setEditDialogOpen(null)}
                                    >
                                      <DialogTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleEditClick(order)
                                          }}
                                        >
                                          <Edit2 className="h-4 w-4 mr-2" />
                                          Update Prices
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent onClick={(e) => e.stopPropagation()}>
                                        <DialogHeader>
                                          <DialogTitle>Update Ask/Bid Prices</DialogTitle>
                                          <DialogDescription>
                                            Update the ask and bid prices for this order.
                                          </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                          <div className="grid gap-2">
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
                                          <div className="grid gap-2">
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
                                        <DialogFooter>
                                          <Button
                                            variant="outline"
                                            onClick={() => setEditDialogOpen(null)}
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
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onCancelOrder?.(order.id)
                                      }}
                                    >
                                      <X className="h-4 w-4 mr-2" />
                                      Cancel Order
                                    </Button>
                                    <Button
                                      variant="default"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onAcceptOrder?.(order.id)
                                      }}
                                    >
                                      <Check className="h-4 w-4 mr-2" />
                                      Accept Order
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                            <Separator className="bg-border/30" />
                            <div>
                              <h4 className="font-semibold mb-3 text-sm tracking-tight">History</h4>
                              <div className="space-y-2">
                                {order.history.map((historyItem, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30 text-sm hover:bg-background hover:shadow-[0_2px_4px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_2px_4px_rgba(0,0,0,0.25)] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
                                  >
                                    <div className="flex items-center gap-4">
                                      <span className="font-mono text-xs">
                                        {formatDate(historyItem.timestamp)}
                                      </span>
                                      {historyItem.ask !== undefined && (
                                        <span className="text-muted-foreground">
                                          Ask: <span className="font-mono">{historyItem.ask}</span>
                                        </span>
                                      )}
                                      {historyItem.bid !== undefined && (
                                        <span className="text-muted-foreground">
                                          Bid: <span className="font-mono">{historyItem.bid}</span>
                                        </span>
                                      )}
                                    </div>
                                    <Badge variant={getStatusVariant(historyItem.status)} className="font-medium">
                                      {historyItem.status}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <Separator className="bg-border/30" />
                            <div className="grid grid-cols-1 gap-4 text-sm">
                              <div className="p-3 rounded-lg bg-background/30 border border-border/20 shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.15)]">
                                <span className="text-muted-foreground text-xs uppercase tracking-wide">Order ID</span>
                                <span className="ml-2 font-mono text-sm">{order.id}</span>
                              </div>
                              <div className="p-3 rounded-lg bg-background/30 border border-border/20 shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.15)]">
                                <span className="text-muted-foreground text-xs uppercase tracking-wide block mb-2">Full Wallet</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs break-all flex-1 text-foreground/90">
                                    {order.wallet}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 flex-shrink-0 hover:bg-accent"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      copyToClipboard(order.wallet, order.id)
                                    }}
                                    title="Copy wallet address"
                                  >
                                    {copiedWalletId === order.id ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <Copy className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })
              )}
              </TableBody>
            </Table>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}

