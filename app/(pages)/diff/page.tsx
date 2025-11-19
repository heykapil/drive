'use client';

import { DiffTable } from '@/components/diff-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useBucketStore } from '@/hooks/use-bucket-store';
import { Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function DiffPage() {
    const { selectedFolderId, selectedFolderName, selectedBucketId, selectedBucketName } = useBucketStore();
    const [files, setFiles] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const fetchDiff = async () => {
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
            const data = await res.json();
            setFiles(data.files || []);
        } catch (error: any) {
            toast.error('Error fetching diff', { description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDiff();
    }, [selectedFolderId, selectedBucketId]);

    const handleSync = async (filesToSync: any[]) => {
        setIsSyncing(true);
        try {
            const res = await fetch('/api/files/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: filesToSync }),
            });

            if (!res.ok) throw new Error('Failed to sync files');
            const data = await res.json();

            toast.success(`Synced ${data.syncedCount} files successfully`);

            // Refresh the diff list
            fetchDiff();
        } catch (error: any) {
            toast.error('Error syncing files', { description: error.message });
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="container mx-auto py-10 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">File Synchronization</h1>
                    <p className="text-muted-foreground mt-2">
                        Compare files in S3 with your database and sync missing entries.
                    </p>
                </div>
                <Button variant="outline" onClick={fetchDiff} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Refresh
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>
                        {selectedBucketId
                            ? `Bucket: ${selectedBucketName}`
                            : `Folder: ${selectedFolderName}`}
                    </CardTitle>
                    <CardDescription>
                        Showing files present in S3 but missing from Postgres.
                    </CardDescription>
                </CardHeader>
                <CardContent>
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
