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
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

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
  const [searchQuery, setSearchQuery] = React.useState<string>("");

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

  // Filter data by ss58 address search (origin, escrow, wallet)
  // Default: only show Open (status=1) AND public orders
  // When searching: show all matching orders regardless of status/public
  // Keep expanded orders visible even if they don't match default filter
  const filteredData = React.useMemo(() => {
    // Get list of expanded order UUIDs
    const expandedOrderIds = Object.keys(expanded).filter(
      (id) => (expanded as Record<string, boolean>)[id]
    );

    // If searching, show all matching orders regardless of status/public
    if (searchQuery && searchQuery.trim() !== "") {
      const searchLower = searchQuery.toLowerCase().trim();
      const filtered = data.filter((order: any) => {
        const originMatch =
          order.origin?.toLowerCase().includes(searchLower) || false;
        const escrowMatch =
          order.escrow?.toLowerCase().includes(searchLower) || false;
        const walletMatch =
          order.wallet?.toLowerCase().includes(searchLower) || false;
        return originMatch || escrowMatch || walletMatch;
      });
      return filtered;
    }

    // Default: only show Open (status=1) AND public orders
    // But keep expanded orders visible even if they don't match
    const filtered = data.filter((order: any) => {
      // Match expanded state using the same ID format as getRowId
      const orderId = `${order.uuid}-${order.status}-${order.escrow || ""}`;
      const isExpanded = expandedOrderIds.includes(orderId);
      const matches = order.status === 1 && order.public === true;

      // Include order if it matches filter OR if it's currently expanded
      return matches || isExpanded;
    });
    return filtered;
  }, [data, searchQuery, expanded]);

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
              Order Book
            </CardTitle>

            <div className="flex items-center gap-2">
              {/* SEARCH INPUT */}
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by ss58 address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
                />
              </div>

              {/* NEW ORDER BUTTON */}
              {onNewOrder && (
                <Button
                  onClick={onNewOrder}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Order
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="min-w-[1200px]">
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
