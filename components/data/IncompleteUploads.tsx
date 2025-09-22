"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getBucketIdsFromFolderId, getBucketInfo, useBucketStore } from "@/hooks/use-bucket-store";
import { formatDistanceToNow } from "date-fns";
import { Trash2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// Enhanced type to include bucket info with each upload
type IncompleteUpload = {
  Key: string;
  UploadId: string;
  Initiated?: string;
  bucketId: number;
  bucketName: string;
};

export default function IncompleteUploads() {
  const [uploads, setUploads] = useState<IncompleteUpload[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // State for managing confirmation dialogs
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    upload?: IncompleteUpload;
    isAbortingAll?: boolean;
  }>({ isOpen: false });

  const { selectedFolderId, isLoading: isStoreLoading } = useBucketStore();

  // Memoize bucketIds to prevent re-calculating on every render
  const bucketIds = useMemo(() => {
    return selectedFolderId ? getBucketIdsFromFolderId(selectedFolderId) : [];
  }, [selectedFolderId]);


  useEffect(() => {
    const fetchUploads = async () => {
      if (isStoreLoading || !selectedFolderId) {
        return;
      }
      setLoading(true);
      setError("");

      try {
        // Fetch all incomplete uploads in parallel for better performance
        const responses = await Promise.all(
          bucketIds.map(id =>
            fetch(process.env.NEXT_PUBLIC_APP_URL + `/api/upload/multipart/info?bucket=${id}`).then(res => res.json())
          )
        );

        const allUploads: IncompleteUpload[] = [];
        responses.forEach((data, index) => {
          if (data.success && data.uploads) {
            const bucketId = bucketIds[index];
            const bucketInfo = getBucketInfo(bucketId);
            // Add bucket context to each upload
            const enrichedUploads = data.uploads.map((up: any) => ({
              ...up,
              bucketId: bucketId,
              bucketName: bucketInfo?.bucket_name || 'Unknown',
            }));
            allUploads.push(...enrichedUploads);
          } else {
            // Optionally collect errors per bucket, for now just log
            console.warn(`Failed to fetch uploads for bucket ID ${bucketIds[index]}:`, data.error);
          }
        });

        setUploads(allUploads);

      } catch (err) {
        setError("An unexpected error occurred while fetching uploads.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUploads();
  }, [bucketIds, selectedFolderId, isStoreLoading]); // Re-run when the folder changes

  const handleAbort = async () => {
    const { upload, isAbortingAll } = dialogState;

    if (isAbortingAll) {
      // Abort All Logic
      toast.info(`Aborting ${uploads.length} uploads...`);
      const results = await Promise.allSettled(
        uploads.map(up =>
          fetch(`/api/upload/multipart/info?bucketId=${up.bucketId}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uploadId: up.UploadId, key: up.Key, bucket: up.bucketId }),
          }).then(res => res.json())
        )
      );

      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failedCount = results.length - successCount;

      if (successCount > 0) toast.success(`Successfully aborted ${successCount} uploads.`);
      if (failedCount > 0) toast.error(`Failed to abort ${failedCount} uploads.`);

    } else if (upload) {
      // Abort Single Logic
      try {
        const res = await fetch(`/api/upload/multipart/info?bucketId=${upload.bucketId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId: upload.UploadId, key: upload.Key, bucket: upload.bucketId }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success(`Upload for ${upload.Key} aborted.`);
        } else {
          throw new Error(data.error || "Unknown error");
        }
      } catch (err: any) {
        toast.error(`Failed to abort upload: ${err.message}`);
      }
    }

    setDialogState({ isOpen: false }); // Close dialog
    // Refresh the list by re-triggering the effect
    const updatedBucketIds = selectedFolderId ? getBucketIdsFromFolderId(selectedFolderId) : [];
    if (JSON.stringify(bucketIds) === JSON.stringify(updatedBucketIds)) {
       // Manually trigger if bucketIds haven't changed
       // This is a bit of a hack, ideally you'd have a refresh function
       setLoading(true);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  return (
    <div>
      {uploads.length > 0 && (
        <div className="flex justify-end mb-4">
          <Button
            variant="destructive"
            onClick={() => setDialogState({ isOpen: true, isAbortingAll: true })}
          >
            <Trash2Icon className="mr-2 h-4 w-4" />
            Abort All ({uploads.length})
          </Button>
        </div>
      )}

      {uploads.length === 0 ? (
        <p className="text-sm text-muted-foreground">No incomplete uploads found in this folder.</p>
      ) : (
        <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Key</TableHead>
                  <TableHead className="hidden sm:table-cell">Bucket</TableHead>
                  <TableHead>Initiated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploads.map((upload) => (
                  <TableRow key={upload.UploadId}>
                    <TableCell className="font-medium truncate max-w-xs">{upload.Key}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{upload.bucketName}</TableCell>
                    <TableCell>{upload.Initiated ? formatDistanceToNow(new Date(upload.Initiated), { addSuffix: true }) : "N/A"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDialogState({ isOpen: true, upload })}
                      >
                        Abort
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={dialogState.isOpen} onOpenChange={(isOpen) => setDialogState({ ...dialogState, isOpen })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {dialogState.isAbortingAll
                ? `This will permanently abort all ${uploads.length} incomplete uploads. This action cannot be undone.`
                : `This will permanently abort the multipart upload for "${dialogState.upload?.Key}". This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAbort}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm Abort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
