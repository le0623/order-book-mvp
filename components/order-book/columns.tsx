"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, ChevronsUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Order, formatWalletAddress, getOrderType, getOrderStatus } from "@/lib/types";

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

const formatDate = (date: string | Date) => {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
};

const formatNumber = (num: number) => {
  if (num === 0) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

interface SortableColumnHeaderProps {
  column: any;
  title: string;
  className?: string;
}

function SortableColumnHeader({ column, title, className = "" }: SortableColumnHeaderProps) {
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

export const columns: ColumnDef<Order>[] = [
  {
    id: "expander",
    header: () => null,
    cell: ({ row }) => {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => row.toggleExpanded()}
          className="p-0 h-8 w-8 hover:bg-accent"
        >
          {row.getIsExpanded() ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      );
    },
  },
  {
    accessorKey: "date",
    header: ({ column }) => (
      <SortableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => (
      <div className="font-mono text-xs whitespace-nowrap">
        {formatDate(row.getValue("date"))}
      </div>
    ),
  },
  {
    accessorKey: "escrow",
    header: "Escrow",
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {formatWalletAddress(row.getValue("escrow"))}
      </span>
    ),
  },
  {
    accessorKey: "wallet",
    header: "Wallet",
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {formatWalletAddress(row.getValue("wallet"))}
      </span>
    ),
  },
  {
    accessorKey: "type",
    header: ({ column }) => (
      <SortableColumnHeader column={column} title="Order" />
    ),
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
  },
  {
    accessorKey: "asset",
    header: ({ column }) => (
      <SortableColumnHeader column={column} title="Asset" />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-sm">
        {row.getValue("asset") === 0 ? "—" : `#${row.getValue("asset")}`}
      </span>
    ),
  },
  {
    id: "size",
    header: ({ column }) => (
      <div className="flex justify-end">
        <SortableColumnHeader column={column} title="Size" className="ml-0" />
      </div>
    ),
    cell: ({ row }) => {
      const orderType = getOrderType(row.original.type);
      const value = orderType === "Sell" ? row.original.ask : row.original.bid;
      return (
        <div className="text-right font-mono text-sm">
          {formatNumber(value as number)}
        </div>
      );
    },
    accessorFn: (row) => {
      const orderType = getOrderType(row.type);
      return orderType === "Sell" ? row.ask : row.bid;
    },
  },
  {
    accessorKey: "stp",
    header: ({ column }) => (
      <div className="flex justify-end">
        <SortableColumnHeader column={column} title="Price" className="ml-0" />
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-right font-mono text-sm">
        {formatNumber(row.getValue("stp"))}
      </div>
    ),
  },
  {
    accessorKey: "gtd",
    header: "GTD",
    cell: ({ row }) => {
      const gtd = row.getValue("gtd") as string;
      return (
        <span className="font-mono text-xs whitespace-nowrap">
          {gtd || "—"}
        </span>
      );
    },
  },
  {
    accessorKey: "partial",
    header: "Partial",
    cell: ({ row }) => {
      const partial = row.getValue("partial");
      return (
        <div className="flex justify-center">
          <span className="text-sm">
            {partial ? "✓" : "—"}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <SortableColumnHeader column={column} title="Status" />
    ),
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
  },
];
