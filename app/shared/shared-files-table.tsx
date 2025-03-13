// shared-files-table.tsx
'use client'

import { ColumnDef, ColumnFiltersState, flexRender, getCoreRowModel, getSortedRowModel, SortingState, useReactTable } from "@tanstack/react-table"
import { format } from 'date-fns'
import { MoreHorizontal } from "lucide-react"
import { useEffect, useState } from 'react'

import { DataTablePagination } from "@/components/data-table-pagination"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatBytes } from "@/lib/utils"

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
  const [filenameFilter, setFilenameFilter] = useState('')
  const [globalFilter, setGlobalFilter] = useState('')

  const columns: ColumnDef<SharedFile>[] = [
    {
      accessorKey: "filename",
      header: "Filename",
    },
    {
      accessorKey: "size",
      header: "Size",
      cell: ({ row }) => formatBytes(row.getValue("size")),
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

  const filteredData = filenameFilter
    ? data.filter((file) =>
        file.filename.toLowerCase().includes(filenameFilter.toLowerCase())
      )
    : data;

  // Update the table configuration
  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    rowCount,
  })


  useEffect(() => {
    setColumnFilters(
      filenameFilter
        ? [{ id: "filename", value: filenameFilter }]
        : []
    )
  }, [filenameFilter])


  return (
    <div className="space-y-4">
      <div className="flex justify-center flex-col">
        <div className="flex">
          <Input
            placeholder="Filter files..."
            value={filenameFilter}
            onChange={(event) => setFilenameFilter(event.target.value)}
            className="flex w-full max-w-sm"
          />
        </div>
        <div className="flex mt-4">
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

      <div className="rounded-md max-w-[95vw] lg:max-w-full border overflow-x-auto">
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
