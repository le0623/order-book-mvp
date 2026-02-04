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
import { ConnectionState } from "@/lib/websocket-types";

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
import {
  Plus,
  Search,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  X,
  ArrowUp,
  Wifi,
  WifiOff,
} from "lucide-react";
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
  onNewOrder?: () => void;
  newlyAddedOrderIds?: Map<string, number>;
  filledOrdersMap?: Record<string, TData[]>;
  allOrdersForSearch?: TData[];
  walletAddress?: string;
  showMyOrdersOnly?: boolean;
  connectionState?: "connected" | "connecting" | "disconnected" | "error";
}

export function DataTable<TData, TValue>({
  columns,
  data,
  renderSubComponent,
  onNewOrder,
  newlyAddedOrderIds = new Map(),
  filledOrdersMap = {},
  allOrdersForSearch = [],
  walletAddress,
  showMyOrdersOnly = false,
  connectionState = "disconnected",
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
  const [showScrollToTop, setShowScrollToTop] = React.useState(false);
  const [isMobileView, setIsMobileView] = React.useState(false);

  const cardHeaderRef = React.useRef<HTMLDivElement | null>(null);
  const tableHeaderRef = React.useRef<HTMLTableSectionElement | null>(null);
  const headerScrollRef = React.useRef<HTMLDivElement | null>(null);
  const bodyScrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setColumnFilters([{ id: "status", value: [0, 1] }]);
  }, []);

  React.useEffect(() => {
    if (isSearchActive) {
      setColumnFilters((prev) => prev.filter((filter) => filter.id !== "status"));
    } else {
      setColumnFilters((prev) => {
        const hasStatusFilter = prev.some((filter) => filter.id === "status");
        if (!hasStatusFilter) {
          return [...prev, { id: "status", value: [0, 1] }];
        }
        return prev.map((filter) =>
          filter.id === "status" ? { id: "status", value: [0, 1] } : filter
        );
      });
    }
  }, [isSearchActive]);

  React.useEffect(() => {
    const checkMobileView = () => {
      setIsMobileView(window.innerWidth < 968);
    };

    checkMobileView();

    window.addEventListener("resize", checkMobileView);
    return () => window.removeEventListener("resize", checkMobileView);
  }, []);

  React.useLayoutEffect(() => {
    const setTopVar = () => {
      const cardHeaderHeight =
        cardHeaderRef.current?.getBoundingClientRect().height ?? 0;
      const pageHeaderHeight = 105.2;
      const totalOffset = pageHeaderHeight + cardHeaderHeight;

      if (isMobileView && headerScrollRef.current) {
        headerScrollRef.current.style.top = `${totalOffset}px`;
      }
      if (!isMobileView && tableHeaderRef.current) {
        tableHeaderRef.current.style.top = `${totalOffset}px`;
      }
    };

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
  }, [isMobileView]);

  React.useEffect(() => {
    if (!isMobileView) return;

    const headerScroll = headerScrollRef.current;
    const bodyScroll = bodyScrollRef.current;

    if (!headerScroll || !bodyScroll) return;

    let isSyncing = false;

    const syncHeaderToBody = () => {
      if (isSyncing) return;
      isSyncing = true;
      headerScroll.scrollLeft = bodyScroll.scrollLeft;
      requestAnimationFrame(() => {
        isSyncing = false;
      });
    };

    const syncBodyToHeader = () => {
      if (isSyncing) return;
      isSyncing = true;
      bodyScroll.scrollLeft = headerScroll.scrollLeft;
      requestAnimationFrame(() => {
        isSyncing = false;
      });
    };

    bodyScroll.addEventListener("scroll", syncHeaderToBody);
    headerScroll.addEventListener("scroll", syncBodyToHeader);

    return () => {
      bodyScroll.removeEventListener("scroll", syncHeaderToBody);
      headerScroll.removeEventListener("scroll", syncBodyToHeader);
    };
  }, [isMobileView]);

  React.useEffect(() => {
    const handleScroll = () => {
      const scrollThreshold = 400;
      setShowScrollToTop(window.scrollY > scrollThreshold);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const filteredData = React.useMemo(() => {
    if (isSearchActive) {
      const allFilledOrders = Object.values(filledOrdersMap).flat() as any[];
      const searchOrders = allOrdersForSearch.length > 0
        ? allOrdersForSearch
        : [...data, ...allFilledOrders];

      const uniqueOrdersMap = new Map<string, any>();
      searchOrders.forEach((order: any) => {
        const key = `${order.uuid}-${order.status}-${order.escrow || ""}`;
        if (!uniqueOrdersMap.has(key)) {
          uniqueOrdersMap.set(key, order);
        }
      });
      const uniqueOrders = Array.from(uniqueOrdersMap.values());

      return uniqueOrders.filter((order: any) => {
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

        let orderTypeMatch = true;
        if (searchOrderType !== undefined && searchOrderType !== null) {
          orderTypeMatch = Number(order.type) === Number(searchOrderType);
        }

        let assetIdMatch = true;
        if (searchAssetId !== undefined && searchAssetId !== null) {
          assetIdMatch = Number(order.asset) === Number(searchAssetId);
        }

        const matches = addressMatch && orderTypeMatch && assetIdMatch;
        return matches;
      });
    }

    const expandedOrderIds = Object.keys(expanded).filter(
      (id) => (expanded as Record<string, boolean>)[id]
    );

    const filtered = data.filter((order: any) => {
      const orderId = `${order.uuid}-${order.status}-${order.escrow || ""}`;
      const isExpanded = expandedOrderIds.includes(orderId);
      const matches = order.status === 1 && order.public === true;

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
    filledOrdersMap,
    allOrdersForSearch,
  ]);


  const table = useReactTable({
    data: filteredData,
    columns,
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
      <Card className="w-full border-slate-200 dark:border-border/60 shadow-sm bg-white dark:bg-card/50 backdrop-blur-sm mb-3">
        <CardHeader
          ref={cardHeaderRef as any}
          className="sticky top-[105.2px] z-30 rounded-t-md bg-white dark:bg-background h-[93.07px] pt-[0.4rem]  sm:pt-6 sm:px-6 px-3 pb-4 border-b border-slate-200 dark:border-border/40"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                {isSearchActive ? "Order History" : showMyOrdersOnly ? "My Orders" : "Order Book"}
              </CardTitle>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] border border-slate-200 dark:border-border/60 bg-white dark:bg-card/50 shadow-sm">
                {connectionState === "connected" ? (
                  <>
                    <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 hidden md:inline">
                      Live
                    </span>
                  </>
                ) : connectionState === "connecting" ? (
                  <>
                    <Wifi className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 hidden md:inline">
                      Connecting...
                    </span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3.5 w-3.5 text-red-500" />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 hidden md:inline">
                      Offline
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col min-[550px]:flex-row items-end min-[550px]:items-center gap-2">
              <Popover
                open={searchPopoverOpen}
                onOpenChange={setSearchPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-full min-[550px]:w-auto gap-2 bg-white hover:bg-slate-50 border-slate-200 text-slate-600 dark:bg-background/80 dark:hover:bg-muted dark:border-border/60 dark:text-foreground">
                    <Search className="h-4 w-4" />
                    Search Order
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[480px] max-w-[calc(100vw-2rem)] min-[550px]:w-[480px] bg-white dark:bg-background border-slate-200 dark:border-border/60"
                  align="end"
                  sideOffset={1}
                >
                  <div className="grid gap-4">
                    <div className="flex items-start justify-between pt-1">
                      <h4 className="font-medium leading-none">
                        Search Orders
                      </h4>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 -mt-1 -mr-1"
                        onClick={() => setSearchPopoverOpen(false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="search-address">
                          History (by wallet address)
                        </Label>
                        <Input
                          id="search-address"
                          type="text"
                          placeholder="Search by ss58 address"
                          value={searchAddress}
                          onChange={(e) => setSearchAddress(e.target.value)}
                          className="h-9 text-sm font-normal focus-visible:ring-1 focus-visible:ring-blue-500/30 focus-visible:ring-offset-0 focus-visible:border-blue-500/40 bg-background placeholder:opacity-60 placeholder:text-muted-foreground"
                        />
                      </div>

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
                            className="text-sm font-normal focus:ring-1 focus:ring-blue-500/30 focus:ring-offset-0 focus:border-blue-500/40 bg-background [&[data-placeholder]>span]:opacity-60 [&[data-placeholder]>span]:text-muted-foreground"
                          >
                            <SelectValue placeholder="Select order type" />
                          </SelectTrigger>
                          <SelectContent className="bg-background">
                            <SelectItem value="1" className="opacity-60">Sell</SelectItem>
                            <SelectItem value="2" className="opacity-60">Buy</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="search-asset-id">Asset ID</Label>
                        <div className="relative flex items-center">
                          <Input
                            id="search-asset-id"
                            type="number"
                            min="1"
                            placeholder="Asset ID (NETUID)"
                            value={searchAssetId === undefined ? "" : searchAssetId}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === "" || value === "0") {
                                setSearchAssetId(undefined);
                                return;
                              }
                              const parsed = parseInt(value);
                              if (isNaN(parsed) || parsed < 1) {
                                setSearchAssetId(undefined);
                                return;
                              }
                              setSearchAssetId(parsed);
                            }}
                            className="text-sm font-normal focus-visible:ring-1 focus-visible:ring-blue-500/30 focus-visible:ring-offset-0 focus-visible:border-blue-500/40 pr-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-background placeholder:opacity-60 placeholder:text-muted-foreground"
                          />
                          <div className="absolute right-1 flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSearchAssetId((prev) =>
                                  prev === undefined ? 1 : Math.max(1, prev + 1)
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
                                  if (prev === undefined || prev <= 1) {
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
                        className="h-9"
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
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setIsSearchActive(true);
                          setSearchPopoverOpen(false);
                        }}
                      >
                        Search Order
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
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
                  className="h-9 w-full min-[550px]:w-auto gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              ) : (
                onNewOrder && (
                  <Button
                    onClick={onNewOrder}
                    className="h-9 w-full min-[550px]:w-auto gap-2 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-semibold shadow-[0_4px_14px_0_rgba(37,99,235,0.3)] hover:shadow-[0_6px_20px_0_rgba(37,99,235,0.4)]"
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                    New Order
                  </Button>
                )
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isMobileView ? (
            <>
              <div
                ref={headerScrollRef}
                className="overflow-x-auto overflow-y-hidden sticky z-40 bg-slate-50 dark:bg-background border-b border-slate-200 dark:border-border/40 scrollbar-hide"
              >
                <div className="min-w-[1200px]">
                  <Table noWrapper className="w-full table-fixed">
                    <TableHeader ref={tableHeaderRef as any}>
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
                  </Table>
                </div>
              </div>

              <div ref={bodyScrollRef} className="overflow-x-auto scrollbar-hide">
                <div className="min-w-[1200px]">
                  <Table noWrapper className="w-full table-fixed">
                    <TableBody>
                      {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                          <React.Fragment key={row.id}>
                            <TableRow
                              data-state={row.getIsSelected() && "selected"}
                              data-expanded={row.getIsExpanded()}
                              className={`cursor-pointer ${newlyAddedOrderIds.has(row.id) ? "" : "transition-colors bg-white dark:bg-transparent"} data-[expanded=true]:bg-slate-50 dark:data-[expanded=true]:bg-muted/30 ${newlyAddedOrderIds.has(row.id)
                                ? newlyAddedOrderIds.get(row.id) === 2
                                  ? "animate-flash-buy"
                                  : "animate-flash-sell"
                                : ""
                                }`}
                              onClick={() => {
                                const currentExpanded = expanded as Record<
                                  string,
                                  boolean
                                >;
                                const allExpandedIds = Object.keys(
                                  currentExpanded
                                ).filter((id) => currentExpanded[id]);

                                const newExpanded: Record<string, boolean> = {};
                                allExpandedIds.forEach((id) => {
                                  newExpanded[id] = false;
                                });

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
              </div>
            </>
          ) : (
            <Table noWrapper className="w-full table-fixed">
              <TableHeader
                ref={tableHeaderRef as any}
                className="sticky z-40 bg-slate-50 dark:bg-background border-b border-slate-200 dark:border-border/40"
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
                        className={`cursor-pointer ${newlyAddedOrderIds.has(row.id) ? "" : "transition-colors bg-white dark:bg-transparent"} data-[expanded=true]:bg-slate-50 dark:data-[expanded=true]:bg-muted/30 ${newlyAddedOrderIds.has(row.id)
                          ? newlyAddedOrderIds.get(row.id) === 2
                            ? "animate-flash-buy"
                            : "animate-flash-sell"
                          : ""
                          }`}
                        onClick={() => {
                          const currentExpanded = expanded as Record<
                            string,
                            boolean
                          >;
                          const allExpandedIds = Object.keys(
                            currentExpanded
                          ).filter((id) => currentExpanded[id]);

                          const newExpanded: Record<string, boolean> = {};
                          allExpandedIds.forEach((id) => {
                            newExpanded[id] = false;
                          });

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
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end space-x-2 rounded-b-md bg-background dark:bg-background mb-12">
        <div className="text-xs text-muted-foreground">
          Showing {table.getRowModel().rows.length} rows
        </div>
      </div>

      {showScrollToTop && (
        <Button
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="fixed bottom-8 right-8 z-50 h-12 w-12 rounded-full bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white shadow-[0_4px_20px_rgba(37,99,235,0.4)] hover:shadow-[0_6px_28px_rgba(37,99,235,0.5)] transition-all duration-200"
          size="icon"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
