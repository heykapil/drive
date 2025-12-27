'use client';

import { BucketSelector } from '@/components/bucket-selector';
import { DiffTable } from '@/components/diff-table';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useBucketStore } from '@/hooks/use-bucket-store';
import { testS3Connection } from '@/service/s3-tebi';
import { Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function DiffPage() {
  const { selectedFolderId, selectedUniqueId: selectedBucketId } = useBucketStore();
  type FileItem = {
    key: string;
    size: number;
    lastModified: string;
    bucketId: number;
    bucketName: string;
    url: string | null;
  };
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchDiff = useCallback(async () => {
    if (!selectedFolderId && !selectedBucketId) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      // Prefer bucketId if available, otherwise folderId
      if (selectedBucketId) {
        params.set('bucketId', selectedBucketId.toString());
      } else if (selectedFolderId) {
        params.set('folderId', selectedFolderId.toString());
      }

      const res = await fetch(`/api/files/diff?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch diff');
      const data = (await res.json()) as { files?: Partial<FileItem>[] };
      setFiles((data.files || []).map(f => ({
        key: f.key || '',
        size: f.size || 0,
        lastModified: f.lastModified || new Date().toISOString(),
        bucketId: f.bucketId || 0,
        bucketName: f.bucketName || '',
        url: f.url || null
      })));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error('Error fetching diff', { description: message });
    } finally {
      setIsLoading(false);
    }
  }, [selectedFolderId, selectedBucketId]);

  useEffect(() => {
    fetchDiff();
  }, [fetchDiff]);

  const handleSync = async (filesToSync: FileItem[]) => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/files/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: filesToSync }),
      });

      if (!res.ok) throw new Error('Failed to sync files');
      const data = (await res.json()) as { syncedCount?: number };

      toast.success(`Synced ${data.syncedCount ?? 0} files successfully`);

      // Refresh the diff list
      fetchDiff();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error('Error syncing files', { description: message });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="container mx-auto py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            File Synchronization
          </h1>
          <p className="text-muted-foreground mt-2">
            Compare files in S3 with your database and sync missing entries.
          </p>
        </div>
        <Button variant="outline" onClick={fetchDiff} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      <Card className="p-0 border-none shadow-none bg-background">
        <CardHeader className="p-0">
          <CardTitle className="p-0">Select the bucket</CardTitle>
          <CardDescription>
            <BucketSelector
              testConnection={false}
              testS3ConnectionAction={testS3Connection}
            />
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <DiffTable
              files={files}
              onSync={handleSync}
              isSyncing={isSyncing}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
