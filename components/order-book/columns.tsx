"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Copy, CheckIcon } from "lucide-react";
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
      return "text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800";
    case 4:
      return "text-red-600 dark:text-red-400 border-red-200 dark:border-red-800";
    case 5:
      return "text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800";
    case 6:
      return "text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800";
    default:
      return "text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800";
  }
};

/**
 * Parse a date string/Date into a UTC Date, handling backend formats.
 * Returns null if invalid.
 */
function parseUTCDate(date: string | Date): Date | null {
  let d: Date;
  if (typeof date === "string") {
    let dateStr = date.trim();
    if (dateStr.endsWith(" UTC")) {
      dateStr = dateStr.replace(" UTC", "Z");
    } else if (!dateStr.includes("Z") && !dateStr.match(/[+-]\d{2}:?\d{2}$/)) {
      dateStr = dateStr + "Z";
    }
    d = new Date(dateStr);
  } else {
    d = date;
  }
  return !d || isNaN(d.getTime()) ? null : d;
}

export const formatDate = (date: string | Date) => {
  const d = parseUTCDate(date);
  if (!d) return "—";

  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  const seconds = String(d.getUTCSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
};

export const formatDateOnly = (date: string | Date) => {
  const d = parseUTCDate(date);
  if (!d) return "—";

  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day} UTC`;
};

export const formatNumber = (num: number) => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

/** TAO in main order: 4 decimal places */
export const formatTao = (num: number) => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(num);
};

export const formatPrice = (num: number) => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  }).format(num);
};

function EscrowCell({ escrowAddress }: { escrowAddress: string }) {
  const [copied, setCopied] = React.useState(false);
  const taostatsUrl = `https://taostats.io/account/${escrowAddress}`;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono whitespace-nowrap block text-sm">
        {formatWalletAddress(escrowAddress)}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          copyToClipboard(escrowAddress);
        }}
        className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 opacity-60 hover:opacity-90"
        title="Copy escrow address"
      >
        {copied ? (
          <CheckIcon className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
      <a
        href={taostatsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 opacity-60 hover:opacity-90"
        title={`View on Taostats: ${escrowAddress}`}
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

export const columns = (
  prices: Record<number, number> = {}
): ColumnDef<Order>[] => [
  {
    accessorKey: "date",
    header: () => <div className="pl-4">Date</div>,
    cell: ({ row }) => (
      <div
        className="font-mono whitespace-nowrap pl-4"
        style={{ fontSize: "0.875rem" }}
      >
        {formatDate(row.getValue("date"))}
      </div>
    ),
    size: 160,
    minSize: 160,
  },
  {
    accessorKey: "escrow",
    header: "Escrow",
    cell: ({ row }) => {
      const escrowAddress = row.getValue("escrow") as string;
      return <EscrowCell escrowAddress={escrowAddress} />;
    },
    size: 110,
    minSize: 110,
  },
  {
    accessorKey: "type",
    header: "Order",
    cell: ({ row }) => {
      const orderType = getOrderType(row.getValue("type"));
      return (
        <Badge
          variant={orderType === "Buy" ? "outline" : "secondary"}
            className={`font-medium ${orderType === "Buy"
              ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400"
              : "text-rose-600 border-rose-200 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-400 hover:bg-rose-50 hover:dark:bg-rose-950/30"
          }`}
        >
          {orderType}
        </Badge>
      );
    },
    size: 60,
    minSize: 60,
  },
  {
    accessorKey: "asset",
      header: () => (
        <div className="flex justify-end">
          <span>Asset</span>
        </div>
      ),
    cell: ({ row }) => {
      const asset = row.getValue("asset") as number;
      if (asset === 0) {
          return <span className="font-mono justify-end text-sm">—</span>;
      }
      const taostatsUrl = `https://taostats.io/subnets/${asset}`;
      return (
          <div className="flex justify-end gap-1.5">
          <span className="font-mono text-sm">SN{asset}</span>
          <a
            href={taostatsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground mt-[2px] hover:text-foreground transition-colors flex-shrink-0 opacity-60 hover:opacity-90"
            title={`View subnet ${asset} on Taostats`}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      );
    },
    size: 50,
    minSize: 50,
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
      const taoValue = row.original.tao && row.original.tao > 0 
        ? row.original.tao 
        : row.original.bid;
      
      return (
        <div className="text-right font-mono text-sm">
          {formatTao(taoValue || 0)}
        </div>
      );
    },
    size: 70,
    minSize: 70,
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
      const alphaValue = row.original.alpha && row.original.alpha > 0 
        ? row.original.alpha 
        : row.original.ask;
      
      return (
        <div className="text-right font-mono text-sm">
          {formatNumber(alphaValue || 0)}
        </div>
      );
    },
    size: 70,
    minSize: 70,
  },
  {
    accessorKey: "stp",
    header: () => (
        <div className="flex justify-end pr-4">
        <span>Price</span>
      </div>
    ),
    cell: ({ row }) => {
      const asset = row.original.asset;
      const livePrice = prices[asset];
      const orderPrice = row.original.price;
      
      const displayPrice = orderPrice && orderPrice > 0 
        ? orderPrice 
        : (livePrice !== undefined && livePrice > 0 ? livePrice : row.original.stp);

      return (
          <div className="flex justify-end pr-4">
          <div className="font-mono text-sm">{formatPrice(displayPrice)}</div>
        </div>
      );
    },
    size: 90,
    minSize: 90,
  },
  {
    accessorKey: "status",
    header: () => (
      <div className="flex justify-center pr-4">
        <span>Status</span>
      </div>
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as number;
      const statusText = getOrderStatus(status);

        const badgeVariant = "outline";
        const badgeClassName = status === 2 ? "font-medium" : `${getStatusColor(status)} font-medium`;

      return (
        <div className="flex justify-center pr-4">
          <Badge
              variant={badgeVariant}
              className={badgeClassName}
          >
            {statusText}
          </Badge>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id));
    },
    size: 90,
    minSize: 90,
  },
];
