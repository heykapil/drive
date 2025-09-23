"use client";

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    getBucketIdsFromFolderId,
    getBucketInfo,
    useBucketStore,
} from "@/hooks/use-bucket-store";
import { Bucket } from "@/lib/utils";
import { Box } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "./ui/skeleton";

type ConnectionStatus = {
  bucket?: number | string;
  name?: string;
  status?: string;
  message?: string;
};

export function BucketSelector({
  testS3ConnectionAction,
  testConnection = false,
}: {
  testS3ConnectionAction: (bucketIds: number | number[])=> Promise<ConnectionStatus[]>,
  testConnection?: boolean;
}) {
  const {
    selectedFolderId,
    selectedBucketId,
    setSelectedBucket,
    folderTree, // Used to trigger re-calculation
    isLoading,
  } = useBucketStore();

  const [statuses, setStatuses] = useState<ConnectionStatus[]>([]);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  // Buckets available for current folder
  const availableBuckets = useMemo(() => {
    if (!selectedFolderId) return [];
    const bucketIds = getBucketIdsFromFolderId(selectedFolderId);
    return bucketIds
      .map((id) => getBucketInfo(id))
      .filter((b): b is Bucket => b !== null);
  }, [selectedFolderId, folderTree]);

  // String key for useEffect dependency
  const bucketIdKey = useMemo(() => {
    return availableBuckets.map((b) => b.bucket_id).sort().join(",");
  }, [availableBuckets]);

  useEffect(() => {
    if (isLoading || !bucketIdKey) {
      setStatuses([]);
      return;
    }

    if (testConnection) {
      const testConnections = async () => {
        setIsTesting(true);
        try {
          const bucketIds = availableBuckets.map((b) => b.bucket_id);
          const results = await testS3ConnectionAction(bucketIds);
          setStatuses(results);
        } catch (error) {
          console.error("Failed to test S3 connections:", error);
          toast.error("Could not get bucket connection statuses.");
        } finally {
          setIsTesting(false);
        }
      };
      testConnections();
    }
  }, [bucketIdKey, isLoading, testConnection]);

  const handleBucketChange = (bucketIdStr: string) => {
    const bucketId = parseInt(bucketIdStr, 10);
    const selected = availableBuckets.find((b) => b.bucket_id === bucketId);

    if (selected) {
      if (selected.bucket_id === selectedBucketId) return;
      setSelectedBucket(selected.bucket_id, selected.bucket_name);
      toast.success(`Bucket switched to ${selected.bucket_name}.`);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-10 w-full max-w-xs" />;
  }

  return (
    <Select
      value={selectedBucketId ? selectedBucketId.toString() : ""}
      onValueChange={handleBucketChange}
      disabled={availableBuckets.length === 0}
    >
      <SelectTrigger className="w-full max-w-[16rem] flex items-center gap-2">
        <Box className="h-4 w-4 text-muted-foreground" />
        <SelectValue placeholder="Select a bucket..." />
      </SelectTrigger>
      <SelectContent>
        {availableBuckets.length > 0 ? (
          availableBuckets.map((bucket) => {
            const statusInfo = statuses.find(
              (s) => Number(s.bucket) === bucket.bucket_id
            );

            const getStatusColor = () => {
              if (isTesting) return "bg-yellow-500";
              if (!statusInfo) return "bg-gray-400";
              return statusInfo.status === "Success"
                ? "bg-green-500"
                : "bg-red-500";
            };

            return (
              <SelectItem
                key={bucket.bucket_id}
                value={bucket.bucket_id.toString()}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    title={isTesting ? "Testing..." : statusInfo?.status}
                    className={`h-2 w-2 rounded-full mr-3 flex-shrink-0 ${getStatusColor()}`}
                  />

                  <div className="flex flex-col text-left">
                    <span className="font-medium">{bucket.bucket_name}</span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {bucket.provider}
                    </span>
                  </div>

                  <span className="ml-4 text-xs font-mono text-muted-foreground">
                    {parseFloat(bucket.available_storage_gb.toString()).toFixed(
                      2
                    )}{" "}
                    GB Free
                  </span>
                </div>
              </SelectItem>
            );
          })
        ) : (
          <SelectItem value="no-buckets" disabled>
            No buckets in this folder.
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
