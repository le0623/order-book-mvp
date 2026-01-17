"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  Row,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableHead as TableHeadCell,
} from "@/components/ui/table";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Search, ChevronUp, ChevronDown, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  renderSubComponent?: (props: { row: Row<TData> }) => React.ReactElement;
  onNewOrder?: () => void; // NEW: Callback to open New Order modal
  newlyAddedOrderIds?: Map<string, number>; // Track newly added orders for flash animation: orderId -> orderType
}

export function DataTable<TData, TValue>({
  columns,
  data,
  renderSubComponent,
  onNewOrder,
  newlyAddedOrderIds = new Map(),
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [expanded, setExpanded] = React.useState({});
  const [searchPopoverOpen, setSearchPopoverOpen] = React.useState(false);
  const [searchAddress, setSearchAddress] = React.useState<string>("");
  const [searchOrderType, setSearchOrderType] = React.useState<
    number | undefined
  >(undefined);
  const [searchAssetId, setSearchAssetId] = React.useState<number | undefined>(
    undefined
  );
  const [isSearchActive, setIsSearchActive] = React.useState(false);

  const cardHeaderRef = React.useRef<HTMLDivElement | null>(null);
  const tableHeaderRef = React.useRef<HTMLTableSectionElement | null>(null);

  React.useEffect(() => {
    if (columnFilters.length === 0) {
      setColumnFilters([{ id: "status", value: [0, 1] }]);
    }
  }, [columnFilters.length]);

  // Set CSS variable for sticky table header position (below CardHeader)
  React.useLayoutEffect(() => {
    const setTopVar = () => {
      const cardHeaderHeight =
        cardHeaderRef.current?.getBoundingClientRect().height ?? 0;
      const pageHeaderHeight = 100; // Page header height
      const totalOffset = pageHeaderHeight + cardHeaderHeight;
      if (tableHeaderRef.current) {
        tableHeaderRef.current.style.top = `${totalOffset}px`;
      }
    };

    // Initial calculation with a small delay to ensure DOM is ready
    const timeoutId = setTimeout(setTopVar, 0);

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(setTopVar);
    });

    if (cardHeaderRef.current) {
      ro.observe(cardHeaderRef.current);
    }

    window.addEventListener("resize", setTopVar);
    window.addEventListener("scroll", setTopVar);

    return () => {
      clearTimeout(timeoutId);
      ro.disconnect();
      window.removeEventListener("resize", setTopVar);
      window.removeEventListener("scroll", setTopVar);
    };
  }, []);

  // Filter data by search parameters (address, orderType, assetId) with AND logic
  // Default: only show Open (status=1) AND public orders
  // When searching: show all matching orders regardless of status/public using AND logic
  const filteredData = React.useMemo(() => {
    // If search is active, filter by all search parameters with AND logic
    if (isSearchActive) {
      return data.filter((order: any) => {
        // Address filter: match origin, escrow, or wallet with partial search
        let addressMatch = true;
        if (searchAddress && searchAddress.trim() !== "") {
          const searchLower = searchAddress.toLowerCase().trim();
          const originMatch = order.origin
            ? String(order.origin).toLowerCase().includes(searchLower)
            : false;
          const escrowMatch = order.escrow
            ? String(order.escrow).toLowerCase().includes(searchLower)
            : false;
          const walletMatch = order.wallet
            ? String(order.wallet).toLowerCase().includes(searchLower)
            : false;
          addressMatch = originMatch || escrowMatch || walletMatch;
        }

        // Order type filter
        let orderTypeMatch = true;
        if (searchOrderType !== undefined && searchOrderType !== null) {
          orderTypeMatch = Number(order.type) === Number(searchOrderType);
        }

        // Asset ID filter
        let assetIdMatch = true;
        if (searchAssetId !== undefined && searchAssetId !== null) {
          assetIdMatch = Number(order.asset) === Number(searchAssetId);
        }

        // AND logic: all non-empty filters must match
        return addressMatch && orderTypeMatch && assetIdMatch;
      });
    }

    // Default: only show Open (status=1) AND public orders
    // But keep expanded orders visible even if they don't match
    const expandedOrderIds = Object.keys(expanded).filter(
      (id) => (expanded as Record<string, boolean>)[id]
    );

    const filtered = data.filter((order: any) => {
      // Match expanded state using the same ID format as getRowId
      const orderId = `${order.uuid}-${order.status}-${order.escrow || ""}`;
      const isExpanded = expandedOrderIds.includes(orderId);
      const matches = order.status === 1 && order.public === true;

      // Include order if it matches filter OR if it's currently expanded
      return matches || isExpanded;
    });
    return filtered;
  }, [
    data,
    isSearchActive,
    searchAddress,
    searchOrderType,
    searchAssetId,
    expanded,
  ]);

  const table = useReactTable({
    data: filteredData,
    columns,
    // Use UUID + status + escrow to ensure uniqueness (filled orders can have same UUID but different escrow)
    getRowId: (row: any) => `${row.uuid}-${row.status}-${row.escrow || ""}`,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onExpandedChange: setExpanded,
    state: { sorting, columnFilters, expanded },
  });

  const rows = table.getRowModel().rows;
  return (
    <div className="w-full smooth-scroll">
      <Card className="w-full border-border/60 shadow-sm bg-card/50 backdrop-blur-sm mb-8">
        <CardHeader
          ref={cardHeaderRef as any}
          className="sticky top-[100px] z-30 rounded-t-md bg-background border-b border-border/40 pb-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-xl font-semibold tracking-tight">
              {isSearchActive ? "Order History" : "Order Book"}
            </CardTitle>

            <div className="flex items-center gap-2">
              {/* SEARCH BUTTON WITH POPOVER */}
              <Popover
                open={searchPopoverOpen}
                onOpenChange={setSearchPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9">
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[480px] bg-background" align="end">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium leading-none">
                        Search Orders
                      </h4>
                    </div>
                    <div className="grid gap-4">
                      {/* Search Address */}
                      <div className="grid gap-2">
                        <Label htmlFor="search-address">
                          History(by wallet address)
                        </Label>
                        <Input
                          id="search-address"
                          type="text"
                          placeholder="Search by ss58 address"
                          value={searchAddress}
                          onChange={(e) => setSearchAddress(e.target.value)}
                          className="h-9 focus-visible:ring-1 focus-visible:ring-blue-500/30 focus-visible:ring-offset-0 focus-visible:border-blue-500/40 bg-background"
                        />
                      </div>

                      {/* Order Type */}
                      <div className="grid gap-2">
                        <Label htmlFor="search-order-type">Order Type</Label>
                        <Select
                          value={
                            searchOrderType === undefined
                              ? undefined
                              : String(searchOrderType)
                          }
                          onValueChange={(value) => {
                            setSearchOrderType(parseInt(value));
                          }}
                        >
                          <SelectTrigger
                            id="search-order-type"
                            className="focus:ring-1 focus:ring-blue-500/30 focus:ring-offset-0 focus:border-blue-500/40 bg-background"
                          >
                            <SelectValue placeholder="Select order type" />
                          </SelectTrigger>
                          <SelectContent className="bg-background">
                            <SelectItem value="1">Sell</SelectItem>
                            <SelectItem value="2">Buy</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Asset ID */}
                      <div className="grid gap-2">
                        <Label htmlFor="search-asset-id">Asset ID</Label>
                        <div className="relative flex items-center">
                          <Input
                            id="search-asset-id"
                            type="number"
                            min="0"
                            placeholder="Asset ID (NETUID)"
                            value={searchAssetId ?? ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              setSearchAssetId(
                                value === ""
                                  ? undefined
                                  : parseInt(value) || undefined
                              );
                            }}
                            className="focus-visible:ring-1 focus-visible:ring-blue-500/30 focus-visible:ring-offset-0 focus-visible:border-blue-500/40 pr-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-background"
                          />
                          <div className="absolute right-1 flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSearchAssetId((prev) =>
                                  prev === undefined ? 0 : Math.max(0, prev + 1)
                                );
                              }}
                              className="h-4 w-6 flex items-center justify-center rounded-sm border border-border bg-background hover:bg-muted active:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              aria-label="Increase asset ID"
                            >
                              <ChevronUp className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSearchAssetId((prev) => {
                                  if (prev === undefined || prev === 0) {
                                    return undefined;
                                  }
                                  return prev - 1;
                                });
                              }}
                              className="h-4 w-6 flex items-center justify-center rounded-sm border border-border bg-background hover:bg-muted active:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              aria-label="Decrease asset ID"
                            >
                              <ChevronDown className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSearchAddress("");
                          setSearchOrderType(undefined);
                          setSearchAssetId(undefined);
                          setSearchPopoverOpen(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                        onClick={() => {
                          setIsSearchActive(true);
                          setSearchPopoverOpen(false);
                        }}
                      >
                        Search
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* BACK BUTTON (when search active) OR NEW ORDER BUTTON (when not searching) */}
              {isSearchActive ? (
                <Button
                  onClick={() => {
                    setIsSearchActive(false);
                    setSearchAddress("");
                    setSearchOrderType(undefined);
                    setSearchAssetId(undefined);
                  }}
                  variant="outline"
                  size="sm"
                  className="h-9"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              ) : (
                onNewOrder && (
                  <Button
                    onClick={onNewOrder}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Order
                  </Button>
                )
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="">
            <Table noWrapper className="w-full table-fixed">
              <TableHeader
                ref={tableHeaderRef as any}
                className="sticky z-30 bg-background shadow-sm border-b"
              >
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHeadCell
                        key={header.id}
                        className="text-sm font-semibold normal-case"
                        style={{ width: header.getSize() }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHeadCell>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>

              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <React.Fragment key={row.id}>
                      <TableRow
                        data-state={row.getIsSelected() && "selected"}
                        data-expanded={row.getIsExpanded()}
                        className={`cursor-pointer transition-colors hover:bg-muted/50 data-[expanded=true]:bg-muted/30 ${
                          newlyAddedOrderIds.has(row.id)
                            ? newlyAddedOrderIds.get(row.id) === 2
                              ? "animate-flash-buy"
                              : "animate-flash-sell"
                            : ""
                        }`}
                        onClick={() => {
                          // Close all other rows first (only one pane open at a time)
                          const currentExpanded = expanded as Record<
                            string,
                            boolean
                          >;
                          const allExpandedIds = Object.keys(
                            currentExpanded
                          ).filter((id) => currentExpanded[id]);

                          // Close all expanded rows
                          const newExpanded: Record<string, boolean> = {};
                          allExpandedIds.forEach((id) => {
                            newExpanded[id] = false;
                          });

                          // If current row is not expanded, expand it
                          if (!row.getIsExpanded()) {
                            newExpanded[row.id] = true;
                          }

                          setExpanded(newExpanded);
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            style={{ width: cell.column.getSize() }}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>

                      {row.getIsExpanded() && renderSubComponent && (
                        <TableRow>
                          <TableCell
                            colSpan={columns.length}
                            className="p-0 border-t-0"
                          >
                            {renderSubComponent({ row })}
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No results found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-end space-x-2 p-4 rounded-b-md bg-white dark:bg-background">
            <div className="text-xs text-muted-foreground">
              Showing {table.getRowModel().rows.length} rows
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
