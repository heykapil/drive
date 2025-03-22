// shared-files-page.tsx
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import type { SharedFile } from '../../components/data/shared-files-table'
import { SharedFilesTable } from '../../components/data/shared-files-table'

interface ApiResponse {
  files: SharedFile[]
  totalCount: number
}

export function SharedFilesPage() {
  const queryClient = useQueryClient()
  const [pagination, setPagination] = useState<{ pageIndex: number; pageSize: number }>({
    pageIndex: 0,
    pageSize: 10,
  })

  const { data, error, isPending, isError } = useQuery<ApiResponse, Error>({
    queryKey: ['shared-files', pagination],
    queryFn: async () => {
      const response = await fetch(
        `/api/files/share?page=${pagination.pageIndex}&pageSize=${pagination.pageSize}`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch shared files')
      }

      const responseData = await response.json()
      console.log(responseData)
      return responseData?.data // Ensure this matches the actual API response structure
    },
    placeholderData: (previousData) => previousData,
  })

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: async (token: string) => {
      const response = await fetch(`/api/files/share?token=${token}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to revoke token')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-files'] })
      toast.success('Token revoked successfully')
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const handlePageChange = (newPageIndex: number) => {
    setPagination((prev) => ({
      ...prev,
      pageIndex: newPageIndex,
    }))
  }

  const handlePageSizeChange = (newPageSize: number) => {
    setPagination(() => ({
      pageIndex: 0, // Reset to first page
      pageSize: newPageSize,
    }))
  }

  if (isError) {
    toast.error(error.message || 'Unknown error occurred')
    return <div className="text-red-500 p-4">Error loading shared files</div>
  }

  return (
    <div className="space-y-4">
      {isPending ? (
        <div className="space-y-4">
          <div className="h-10 w-[200px] bg-muted animate-pulse rounded-md" />
          <div className="h-[400px] bg-muted/50 animate-pulse rounded-md" />
        </div>
      ) : (
        <SharedFilesTable
          data={data?.files || []}
          rowCount={data?.totalCount || 0}
          onDeleteToken={(token) => deleteMutation.mutate(token)}
          pageIndex={pagination.pageIndex}
          pageSize={pagination.pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          isLoading={deleteMutation.isPending} // Correct property
        />
      )}
    </div>
  )
}
