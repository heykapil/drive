"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBytes } from "@/lib/utils";
import {
  ColumnDef,
  ColumnFiltersState,
  FilterFn,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { CircleX, Ellipsis, Filter, ListFilter } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Badge } from "../ui/badge";

// FileItem type coming from the API. The "bucket" field is the S3 bucket name.
type FileItem = {
  id: number;
  filename: string;
  key: string;
  size: number;
  type: string;
  uploaded_at: string;
  is_public: boolean;
  liked: boolean;
  bucket: string;
  bucket_id: number;
};

// Filter functions for boolean values and bucket keys.
const booleanFilterFn: FilterFn<FileItem> = (row, columnId, filterValue: boolean[]) =>
  filterValue.length === 0 || filterValue.includes(row.getValue(columnId));

const bucketFilterFn: FilterFn<FileItem> = (row, columnId, filterValue: string[]) =>
  filterValue.length === 0 || filterValue.includes(row.getValue(columnId));

// Define columns.
const columns: ColumnDef<FileItem>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    header: "Filename",
    accessorKey: "filename",
    cell: ({ row }) => <span className="font-medium">{row.getValue("filename")}</span>,
    filterFn: "includesString",
  },
  {
    header: "Size",
    accessorKey: "size",
    cell: ({ row }) => formatBytes(row.getValue("size")),
  },
  {
    header: "Type",
    accessorKey: "type",
  },
  {
    header: "Uploaded At",
    accessorKey: "uploaded_at",
    cell: ({ row }) => new Date(row.getValue("uploaded_at")).toLocaleString(),
  },
  {
    header: "Public",
    accessorKey: "is_public",
    cell: ({ row }) => (
      <Badge variant={row.getValue("is_public") ? "default" : "secondary"}>
        {row.getValue("is_public") ? "Public" : "Private"}
      </Badge>
    ),
    filterFn: booleanFilterFn,
  },
  {
    header: "Liked",
    accessorKey: "liked",
    cell: ({ row }) => (
      <Checkbox
        checked={row.getValue("liked")}
        aria-label="Liked status"
        className="pointer-events-none"
      />
    ),
    filterFn: booleanFilterFn,
  },
  {
    // Use an accessor function to derive the bucket identifier from the API bucket name.
    header: "Bucket",
    id: "bucket",
    accessorFn: async (row: FileItem) => row.bucket || row.bucket_id,
    cell: ({ row }) => {
      const bucketKey = row.getValue("bucket") as string;
      return bucketKey.charAt(0).toUpperCase() + bucketKey.slice(1);
    },
    filterFn: bucketFilterFn,
  },
  {
    id: "actions",
    cell: ({ row }) => <RowActions row={row} />,
    enableHiding: false,
  },
];


export default function FilesTable({ options }:{ options: any[]}) {
  const initialBuckets = options.map((option) => option.value);
  const [data, setData] = useState<FileItem[]>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([
    { id: "bucket", value: initialBuckets },
    { id: "is_public", value: [true, false] },
    { id: "liked", value: [true, false] },
  ]);
  const [sorting, setSorting] = useState<SortingState>([{ id: "uploaded_at", desc: true }]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
  const inputRef = useRef<HTMLInputElement>(null);

  const table = useReactTable({
    data,
    columns,
    state: { columnFilters, sorting, pagination },
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Fetch data on mount.
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Call the API with all bucket keys.
        const res = await fetch(`/api/files?bucket=${initialBuckets.join(",")}`);
        const { files } = await res.json();
        // Ensure size is a number.
        setData(
          files.map((file: any) => ({
            ...file,
            size: Number(file.size),
          }))
        );
      } catch (error) {
        console.error("Failed to fetch files:", error);
      }
    };
    fetchData();
  }, []);

  // Handler for boolean filters (visibility and liked).
  const handleBooleanFilter = (columnId: string, value: boolean) => {
    const current = (table.getColumn(columnId)?.getFilterValue() as boolean[]) || [];
    const newValue = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    table.getColumn(columnId)?.setFilterValue(newValue.length > 0 ? newValue : undefined);
  };

  // Handler for bucket filter.
  const handleBucketFilter = (value: string) => {
    const current = (table.getColumn("bucket")?.getFilterValue() as string[]) || [];
    const newValue = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    table.getColumn("bucket")?.setFilterValue(newValue.length > 0 ? newValue : initialBuckets);
  };

  return (
    <div className="space-y-4 max-w-[1000px]">
      <div className="flex flex-wrap gap-3">
        {/* Search Input */}
        <div className="relative">
          <Input
            placeholder="Search files..."
            value={(table.getColumn("filename")?.getFilterValue() as string) ?? ""}
            onChange={(e) => table.getColumn("filename")?.setFilterValue(e.target.value)}
            className="pl-9 pr-9"
            ref={inputRef}
          />
          <ListFilter className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          {Boolean(table.getColumn("filename")?.getFilterValue()) && (
            <CircleX
              className="absolute right-3 top-3 h-4 w-4 cursor-pointer text-muted-foreground"
              onClick={() => table.getColumn("filename")?.setFilterValue("")}
            />
          )}
        </div>

        {/* Visibility Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Visibility
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48">
            <div className="space-y-2">
              {[true, false].map((value) => (
                <div key={String(value)} className="flex items-center gap-2">
                  <Checkbox
                    checked={
                      ((table.getColumn("is_public")?.getFilterValue() as boolean[]) || []).includes(value)
                    }
                    onCheckedChange={() => handleBooleanFilter("is_public", value)}
                  />
                  <Label>{value ? "Public" : "Private"}</Label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Liked Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Liked
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48">
            <div className="space-y-2">
              {[true, false].map((value) => (
                <div key={String(value)} className="flex items-center gap-2">
                  <Checkbox
                    checked={
                      ((table.getColumn("liked")?.getFilterValue() as boolean[]) || []).includes(value)
                    }
                    onCheckedChange={() => handleBooleanFilter("liked", value)}
                  />
                  <Label>{value ? "Liked" : "Not Liked"}</Label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Bucket Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Bucket
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48">
            <div className="space-y-2">
              {options.map((option) => (
                <div key={option.value} className="flex items-center gap-2">
                  <Checkbox
                    checked={((table.getColumn("bucket")?.getFilterValue() as string[]) || []).includes(option.value)}
                    onCheckedChange={() => handleBucketFilter(option.value)}
                  />
                  <Label>{option.label}</Label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">
            Page {pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function RowActions({ row }: { row: any }) {
  return (
    <div className="flex justify-end">
      <Button variant="ghost" size="icon">
        <Ellipsis className="h-4 w-4" />
      </Button>
    </div>
  );
}
