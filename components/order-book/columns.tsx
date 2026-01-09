"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  Order,
  formatWalletAddress,
  getOrderType,
  getOrderStatus,
} from "@/lib/types";

const getStatusColor = (status: number): string => {
  switch (status) {
    case 0:
      return "text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800";
    case 1:
      return "text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800";
    case 2:
      return "text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800";
    case 3:
      return "text-red-600 dark:text-red-400 border-red-200 dark:border-red-800";
    case 4:
      return "text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800";
    case 5:
      return "text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800";
    case 6:
      return "text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800";
    default:
      return "text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800";
  }
};

export const formatDate = (date: string | Date) => {
  const d = typeof date === "string" ? new Date(date) : date;
  if (!d || isNaN(d.getTime())) return "—";

  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  const seconds = String(d.getUTCSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
};

export const formatNumber = (num: number) => {
  if (num === 0) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

export const formatPrice = (num: number) => {
  if (num === 0) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  }).format(num);
};

interface SortableColumnHeaderProps {
  column: any;
  title: string;
  className?: string;
}

function SortableColumnHeader({
  column,
  title,
  className = "",
}: SortableColumnHeaderProps) {
  const isSorted = column.getIsSorted();

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`-ml-3 h-8 data-[state=open]:bg-accent hover:bg-transparent ${className}`}
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      <span>{title}</span>
      {isSorted === "asc" ? (
        <ArrowUp className="ml-2 h-4 w-4" />
      ) : isSorted === "desc" ? (
        <ArrowDown className="ml-2 h-4 w-4" />
      ) : (
        <ChevronsUpDown className="ml-2 h-4 w-4" />
      )}
    </Button>
  );
}

export const columns = (
  prices: Record<number, number> = {}
): ColumnDef<Order>[] => [
  {
    accessorKey: "date",
    header: () => <div className="pl-4">Date</div>,
    cell: ({ row }) => (
      <div className="font-mono text-xs whitespace-nowrap pl-4">
        {formatDate(row.getValue("date"))}
      </div>
    ),
    size: 160,
    minSize: 160,
  },
  {
    accessorKey: "escrow",
    header: "Escrow",
    cell: ({ row }) => (
      <span
        className="font-mono text-xs whitespace-nowrap overflow-hidden text-ellipsis block"
        title={row.getValue("escrow")}
      >
        {formatWalletAddress(row.getValue("escrow"))}
      </span>
    ),
    size: 100,
    minSize: 100,
  },
  {
    accessorKey: "type",
    header: "Order",
    cell: ({ row }) => {
      const orderType = getOrderType(row.getValue("type"));
      return (
        <Badge
          variant={orderType === "Buy" ? "outline" : "secondary"}
          className={`font-medium ${
            orderType === "Buy"
              ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400"
              : "text-rose-600 border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400"
          }`}
        >
          {orderType}
        </Badge>
      );
    },
    size: 90,
    minSize: 90,
  },
  {
    accessorKey: "asset",
    header: ({ column }) => (
      <SortableColumnHeader column={column} title="Asset" />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-sm">
        {row.getValue("asset") === 0 ? "—" : `SN${row.getValue("asset")}`}
      </span>
    ),
    size: 80,
    minSize: 80,
  },
  {
    accessorKey: "bid",
    id: "tao",
    header: () => (
      <div className="flex justify-end">
        <span>Tao</span>
      </div>
    ),
    cell: ({ row }) => {
      return (
        <div className="text-right font-mono text-sm">
          {formatNumber(row.original.bid || 0)}
        </div>
      );
    },
    size: 80,
    minSize: 80,
  },
  {
    accessorKey: "ask",
    id: "alpha",
    header: () => (
      <div className="flex justify-end">
        <span>Alpha</span>
      </div>
    ),
    cell: ({ row }) => {
      return (
        <div className="text-right font-mono text-sm">
          {formatNumber(row.original.ask || 0)}
        </div>
      );
    },
    size: 80,
    minSize: 80,
  },
  {
    accessorKey: "stp",
    header: "Price",
    cell: ({ row }) => {
      // Use live price from /ws/price if available, otherwise fall back to stop price (stp)
      const asset = row.original.asset;
      const livePrice = prices[asset];
      const displayPrice =
        livePrice !== undefined && livePrice > 0 ? livePrice : row.original.stp;

      return (
        <div className="font-mono text-sm">{formatPrice(displayPrice)}</div>
      );
    },
    size: 90,
    minSize: 90,
  },
  {
    accessorKey: "gtd",
    header: "GTD",
    cell: ({ row }) => {
      const gtd = row.getValue("gtd") as string;
      // Convert "gtc" to uppercase "GTC", otherwise format as date
      let displayValue = "—";
      if (gtd) {
        if (gtd.toLowerCase() === "gtc") {
          displayValue = "GTC";
        } else {
          // Format as date if it's a date string
          try {
            displayValue = formatDate(gtd);
          } catch {
            displayValue = gtd; // Fallback to original value if parsing fails
          }
        }
      }
      return (
        <span className="font-mono text-xs whitespace-nowrap">
          {displayValue}
        </span>
      );
    },
    size: 150,
    minSize: 150,
  },
  {
    accessorKey: "partial",
    header: "Partial",
    cell: ({ row }) => {
      const partial = row.getValue("partial");
      return (
        <div className="flex justify-center">
          <span className="text-sm">{partial ? "✓" : "—"}</span>
        </div>
      );
    },
    size: 80,
    minSize: 80,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as number;
      const statusText = getOrderStatus(status);

      return (
        <Badge
          variant="outline"
          className={`${getStatusColor(status)} font-medium`}
        >
          {statusText}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
    size: 90,
    minSize: 90,
  },
];
