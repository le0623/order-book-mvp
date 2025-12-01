"use client";

import { ColumnDef, Column } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Order, OrderStatus, formatWalletAddress } from "@/lib/mock-data";

export const getStatusVariant = (status: OrderStatus) => {
  switch (status) {
    case "Open":
      return "statusOpen";
    case "Completed":
      return "statusCompleted";
    case "Canceled":
      return "statusCanceled";
    case "Failed":
      return "statusFailed";
    case "Pending":
      return "statusPending";
    case "Partial":
      return "statusPartial";
    default:
      return "default";
  }
};

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
  }).format(date);
};

const formatNumber = (num: number) => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

// --- Sortable Header Component ---

interface SortableColumnHeaderProps {
  column: Column<Order, unknown>;
  title: string;
  className?: string;
}

function SortableColumnHeader({
  column,
  title,
  className,
}: SortableColumnHeaderProps) {
  const sortingState = column.getIsSorted();
  const handleSort = () => {
    if (sortingState === false) {
      column.toggleSorting(false);
    } else if (sortingState === "asc") {
      column.toggleSorting(true);
    } else {
      column.clearSorting();
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`-ml-3 h-8 data-[state=open]:bg-accent ${className}`}
      onClick={handleSort}
    >
      <span>{title}</span>

      {sortingState === "desc" ? (
        <ArrowDown className="ml-2 h-4 w-4" />
      ) : sortingState === "asc" ? (
        <ArrowUp className="ml-2 h-4 w-4" />
      ) : (
        <ChevronsUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />
      )}
    </Button>
  );
}

export const columns: ColumnDef<Order>[] = [
  {
    id: "expander",
    header: () => null,
    cell: ({ row }) => {
      return (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0 hover:bg-muted"
        >
          {row.getIsExpanded() ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span className="sr-only">Toggle Row</span>
        </Button>
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "date",
    header: ({ column }) => (
      <SortableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {formatDate(row.getValue("date"))}
      </span>
    ),
  },
  {
    accessorKey: "order",
    header: ({ column }) => (
      <SortableColumnHeader column={column} title="Order" />
    ),
    cell: ({ row }) => (
      <Badge
        variant={row.getValue("order") === "Buy" ? "outline" : "secondary"}
        className={`font-medium ${
          row.getValue("order") === "Buy"
            ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400"
            : "text-rose-600 border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400"
        }`}
      >
        {row.getValue("order")}
      </Badge>
    ),
  },
  {
    accessorKey: "sn",
    header: ({ column }) => <SortableColumnHeader column={column} title="SN" />,
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.getValue("sn")}</span>
    ),
  },
  {
    accessorKey: "wallet",
    header: ({ column }) => (
      <SortableColumnHeader column={column} title="Wallet" />
    ),
    cell: ({ row }) => {
      const wallet = row.getValue("wallet") as string;
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help font-mono text-xs text-primary underline decoration-dotted underline-offset-2">
                {formatWalletAddress(wallet)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p className="font-mono text-xs">{wallet}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
  },
  {
    accessorKey: "size",
    header: ({ column }) => (
      <div className="flex justify-end">
        <SortableColumnHeader column={column} title="Size" className="ml-0" />
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-right font-mono text-sm">
        {formatNumber(row.getValue("size"))}
      </div>
    ),
  },
  {
    accessorKey: "ask",
    header: ({ column }) => (
      <div className="flex justify-end">
        <SortableColumnHeader column={column} title="Ask" className="ml-0" />
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-right font-mono text-sm">
        {formatNumber(row.getValue("ask"))}
      </div>
    ),
  },
  {
    accessorKey: "bid",
    header: ({ column }) => (
      <div className="flex justify-end">
        <SortableColumnHeader column={column} title="Bid" className="ml-0" />
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-right font-mono text-sm">
        {formatNumber(row.getValue("bid"))}
      </div>
    ),
  },
  {
    accessorKey: "partial",
    header: ({ column }) => (
      <SortableColumnHeader column={column} title="Partial" />
    ),
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs">
        {row.getValue("partial") ? "Yes" : "No"}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <SortableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as OrderStatus;
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

      return (
        <Badge
          variant="outline"
          className={`${statusColors[status]} font-medium`}
        >
          {status}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
  },
];
