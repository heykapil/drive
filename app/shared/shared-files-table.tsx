// shared-files-table.tsx
'use client'

import { ColumnDef, ColumnFiltersState, flexRender, getCoreRowModel, getSortedRowModel, SortingState, useReactTable } from "@tanstack/react-table"
import { format } from 'date-fns'
import { MoreHorizontal } from "lucide-react"
import { useState } from 'react'

import { DataTablePagination } from "@/components/data-table-pagination"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export type SharedFile = {
  token: string
  id: number
  filename: string
  size: number
  type: string
  bucket: string
  expires: string | null
  created_at: string
}

interface SharedFilesTableProps {
  data: SharedFile[]
  rowCount: number
  onDeleteToken: (token: string) => void
  pageIndex: number
  pageSize: number
  onPageChange: (pageIndex: number) => void
  onPageSizeChange: (pageSize: number) => void
  isLoading: boolean
}

export function SharedFilesTable({
  data,
  rowCount,
  onDeleteToken,
  pageIndex,
  pageSize,
  onPageChange,
  onPageSizeChange,
  isLoading,
}: SharedFilesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const columns: ColumnDef<SharedFile>[] = [
    {
      accessorKey: "filename",
      header: "Filename",
    },
    {
      accessorKey: "size",
      header: "Size",
      cell: ({ row }) => formatFileSize(row.getValue("size")),
    },
    {
      accessorKey: "type",
      header: "Type",
    },
    {
      accessorKey: "bucket",
      header: "Bucket",
    },
    {
      accessorKey: "expires",
      header: "Expires",
      cell: ({ row }) => row.getValue("expires")
        ? format(new Date(row.getValue("expires")), 'PPpp')
        : 'Never',
    },
    {
      accessorKey: "created_at",
      header: "Shared At",
      cell: ({ row }) => format(new Date(row.getValue("created_at")), 'PPpp'),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 w-8 p-0"
              disabled={isLoading}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(
                `${window.location.origin}/file?id=${row.original.id}&token=${row.original.token}`
              )}
            >
              Copy Link
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => onDeleteToken(row.original.token)}
              disabled={isLoading}
            >
              Revoke
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    rowCount,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center flex-row justify-between">
        <div className="flex">
          <Input
            placeholder="Filter files..."
            value={(table.getColumn("filename")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("filename")?.setFilterValue(event.target.value)
            }
            className="flex w-full max-w-sm"
          />
        </div>
        <div className="flex">
          <DataTablePagination
            table={table}
            totalItems={rowCount}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// Utility function to format file sizes
function formatFileSize(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}
