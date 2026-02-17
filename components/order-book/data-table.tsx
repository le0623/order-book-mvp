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
  ExpandedState,
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
import {
  Plus,
  Search,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  X,
  ArrowUp,
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
  const [expanded, setExpanded] = React.useState<ExpandedState>({});
  // Track expanded ids separately so filteredData doesn't depend on `expanded`
  const expandedIdsRef = React.useRef<Set<string>>(new Set());
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
      // Collapse any expanded row when showing search results
      setExpanded({});
      expandedIdsRef.current = new Set();
    } else if (showMyOrdersOnly) {
      // My Orders: show all statuses (no status filter)
      setColumnFilters((prev) => prev.filter((filter) => filter.id !== "status"));
      setExpanded({});
      expandedIdsRef.current = new Set();
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
  }, [isSearchActive, showMyOrdersOnly]);

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
      // Reason: Dynamically read page header height so the sticky offset
      // stays correct regardless of header content / viewport width.
      const pageHeader = document.querySelector("header");
      const pageHeaderHeight = pageHeader?.getBoundingClientRect().height ?? 114;
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
      const searchOrders = [
        ...(allOrdersForSearch.length > 0 ? allOrdersForSearch : data),
        ...allFilledOrders,
      ];

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

    // My Orders: show all statuses (0, 1, 2, 3); column filter will restrict
    if (showMyOrdersOnly) {
      return data;
    }
    // Order Book: include rows that match open book OR are currently expanded
    const currentExpandedIds = expandedIdsRef.current;
    const filtered = data.filter((order: any) => {
      const orderId = `${order.uuid}-${order.status}-${order.escrow || ""}`;
      const matches = order.status === 1 && order.public === true;
      return matches || currentExpandedIds.has(orderId);
    });
    return filtered;
  }, [
    data,
    isSearchActive,
    showMyOrdersOnly,
    searchAddress,
    searchOrderType,
    searchAssetId,
    filledOrdersMap,
    allOrdersForSearch,
  ]);


  // Wrap expand changes in startTransition so the click stays responsive
  const handleExpandedChange = React.useCallback((updater: React.SetStateAction<ExpandedState>) => {
    React.startTransition(() => {
      setExpanded(updater);
    });
  }, []);

  // Stable callback for row click — toggles one row, collapses others
  const handleRowClick = React.useCallback((rowId: string, isCurrentlyExpanded: boolean) => {
    const newExpanded: Record<string, boolean> = {};
    // Collapse all currently expanded
    expandedIdsRef.current.forEach((id) => {
      newExpanded[id] = false;
    });
    if (!isCurrentlyExpanded) {
      newExpanded[rowId] = true;
      expandedIdsRef.current = new Set([rowId]);
    } else {
      expandedIdsRef.current = new Set();
    }
    React.startTransition(() => {
      setExpanded(newExpanded);
    });
  }, []);

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
    onExpandedChange: handleExpandedChange,
    state: { sorting, columnFilters, expanded },
  });

  const rows = table.getRowModel().rows;
  return (
    <div className="w-full smooth-scroll">
      <Card className="w-full border-slate-200 dark:border-border/60 shadow-sm bg-white dark:bg-card/50 backdrop-blur-sm mb-3">
        <CardHeader
          ref={cardHeaderRef as any}
          className="sticky z-30 rounded-t-md bg-white dark:bg-background h-[93.07px] py-2 sm:px-6 px-3 border-b border-slate-200 dark:border-border/40 flex flex-row items-center justify-between"
          style={{ top: "var(--page-header-height, 114px)" }}
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <CardTitle className="text-[3.5rem] sm:text-[4.25rem] font-normal tracking-wide leading-none text-foreground font-[family-name:var(--font-geist-pixel-circle)]">
                {isSearchActive ? "Order History" : showMyOrdersOnly ? "My Orders" : "Order Book"}
              </CardTitle>
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
                        Search Order
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
                        <Label htmlFor="search-asset-id">Asset (NETUID)</Label>
                        <div className="relative flex items-center">
                          <Input
                            id="search-asset-id"
                            type="number"
                            min="1"
                            placeholder="Enter asset"
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
                    Open Order
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
                              className="text-[0.75rem] font-semibold uppercase"
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
                              onClick={() => handleRowClick(row.id, row.getIsExpanded())}
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
                              <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
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
            <Table noWrapper className="w-full table-fixed border-separate border-spacing-0 [&_tbody_td]:border-b [&_tbody_td]:border-slate-100 dark:[&_tbody_td]:border-border/40 [&_tbody_tr:last-child_td]:border-b-0">
              <TableHeader
                ref={tableHeaderRef as any}
                className="sticky z-40 bg-slate-50 dark:bg-background"
              >
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHeadCell
                        key={header.id}
                        className="text-[0.75rem] font-semibold uppercase"
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
                        onClick={() => handleRowClick(row.id, row.getIsExpanded())}
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
                        <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
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
          variant="outline"
          size="icon"
          className="fixed bottom-8 right-8 z-50 h-12 w-12 rounded-full bg-white hover:bg-slate-50 border-slate-200 text-slate-600 dark:bg-background/80 dark:hover:bg-muted dark:border-border/60 dark:text-foreground"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
