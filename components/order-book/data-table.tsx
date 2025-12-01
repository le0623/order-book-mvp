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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Filter, X } from "lucide-react";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  renderSubComponent?: (props: { row: Row<TData> }) => React.ReactElement;
}

const ORDER_STATUSES = [
  "Open",
  "Pending",
  "Canceled",
  "Failed",
  "Partial",
  "Completed",
];

const getStatusTextColor = (status: string): string => {
  switch (status) {
    case "Open":
      return "text-blue-600 dark:text-blue-400";
    case "Completed":
      return "text-emerald-600 dark:text-emerald-400";
    case "Canceled":
      return "text-red-600 dark:text-red-400";
    case "Failed":
      return "text-rose-600 dark:text-rose-400";
    case "Pending":
      return "text-amber-600 dark:text-amber-400";
    case "Partial":
      return "text-slate-500 dark:text-slate-400";
    default:
      return "";
  }
};

export function DataTable<TData, TValue>({
  columns,
  data,
  renderSubComponent,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [expanded, setExpanded] = React.useState({});
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [selectedStatuses, setSelectedStatuses] = React.useState<Set<string>>(
    new Set(["Open"])
  );

  const cardHeaderRef = React.useRef<HTMLDivElement | null>(null);
  const tableHeaderRef = React.useRef<HTMLTableSectionElement | null>(null);

  React.useEffect(() => {
    if (columnFilters.length === 0) {
      setColumnFilters([{ id: "status", value: ["Open"] }]);
    }
  }, [columnFilters.length]);

  // Set CSS variable for sticky table header
  React.useLayoutEffect(() => {
    const setTopVar = () => {
      const h = cardHeaderRef.current?.getBoundingClientRect().height ?? 0;
      if (tableHeaderRef.current) {
        (tableHeaderRef.current.style as any).setProperty(
          "--card-header-height",
          `${h}px`
        );
      }
    };
    setTopVar();
    const ro = new ResizeObserver(setTopVar);
    if (cardHeaderRef.current) ro.observe(cardHeaderRef.current);
    window.addEventListener("resize", setTopVar);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", setTopVar);
    };
  }, []);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onExpandedChange: setExpanded,
    state: { sorting, columnFilters, expanded },
  });

  const handleStatusToggle = (status: string) => {
    const newSet = new Set(selectedStatuses);
    newSet.has(status) ? newSet.delete(status) : newSet.add(status);
    setSelectedStatuses(newSet);
    table.getColumn("status")?.setFilterValue(Array.from(newSet));
  };

  return (
    <div className="w-full smooth-scroll">
      <Card className="w-full border-border/60 shadow-sm bg-card/50 backdrop-blur-sm mb-8">
        <CardHeader
          ref={cardHeaderRef as any}
          className="sticky top-[117px] z-30 rounded-t-md bg-background border-b border-border/40 pb-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-xl font-semibold tracking-tight">
              Order Book
            </CardTitle>

            <DropdownMenu open={dropdownOpen} onOpenChange={(open) => {
              setDropdownOpen(open);
              if (!open) {
                // Remove focus from button when dropdown closes to prevent green border
                setTimeout(() => {
                  const trigger = document.activeElement as HTMLElement;
                  if (trigger && trigger.blur) {
                    trigger.blur();
                  }
                }, 0);
              }
            }}>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 focus-visible:ring-0 focus-visible:ring-offset-0"
                >
                  <Filter className="h-4 w-4" />
                  Filter
                  {selectedStatuses.size > 0 && (
                    <span className="ml-1 rounded-full bg-primary text-primary-foreground px-1.5 py-0.5 text-xs">
                      {selectedStatuses.size}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-48">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <DropdownMenuLabel className="p-0">
                    Filter by Status
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    className="h-6 w-6 p-0 justify-center cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      setDropdownOpen(false);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </DropdownMenuItem>
                </div>
                <DropdownMenuSeparator />
                {ORDER_STATUSES.map((status) => (
                  <DropdownMenuCheckboxItem
                    key={status}
                    checked={selectedStatuses.has(status)}
                    onCheckedChange={() => handleStatusToggle(status)}
                    onSelect={(e) => {
                      e.preventDefault();
                    }}
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
          <Table noWrapper className="w-full">
            <TableHeader
              ref={tableHeaderRef as any}
              className="sticky top-[205px] z-20 bg-background shadow-sm border-b"
            >
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHeadCell
                      key={header.id}
                      className="text-sm font-semibold"
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
                      className="cursor-pointer transition-colors hover:bg-muted/50 data-[expanded=true]:bg-muted/50"
                      onClick={() => row.toggleExpanded()}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
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
