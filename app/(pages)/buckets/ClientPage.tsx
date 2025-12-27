'use client';

import { StorageChart } from '@/components/data/StoragePieChart'; // Assuming component and props are here
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  getBucketIdsFromFolderId,
  getBucketInfo,
  useBucketStore,
} from '@/hooks/use-bucket-store';
import { Bucket } from '@/lib/utils';
import { refreshBucketUsage } from '@/service/bucket.config';
import { testS3Connection } from '@/service/s3-tebi'; // Assuming this is the correct path
import {
  FileJson,
  InfoIcon,
  Move3DIcon,
  PlusIcon,
  RefreshCwIcon,
  Settings2Icon,
  TestTube2Icon,
  UploadCloudIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type ConnectionStatus = {
  bucket: number;
  status?: string;
  name?: string;
  message?: string;
};

export function S3BucketViewer() {
  const { selectedFolderId, isLoading: isStoreLoading } = useBucketStore();
  const [statuses, setStatuses] = useState<ConnectionStatus[]>([]);
  const [isTesting, setIsTesting] = useState<boolean>(true);
  const [testS3, setTestS3] = useState<boolean>(false);
  const bucketIds = useMemo(() => {
    return selectedFolderId ? getBucketIdsFromFolderId(selectedFolderId) : [];
  }, [selectedFolderId]);

  // useCallback to memoize the function for stability
  const runConnectionTest = useCallback(async (ids: number[]) => {
    setIsTesting(true);
    try {
      const results = await testS3Connection(ids);
      setStatuses(results);
      const errorCount = results.filter(r => r.status === 'Error').length;
      if (errorCount > 0) {
        toast.error(`${errorCount} bucket(s) failed the connection test.`);
      }
    } catch (error) {
      toast.error('Failed to run connection tests.');
      console.error(error);
    } finally {
      setIsTesting(false);
    }
  }, []);

  useEffect(() => {
    setTestS3(false);
  }, [selectedFolderId]);

  useEffect(() => {
    if (!isStoreLoading && bucketIds.length > 0 && testS3) {
      runConnectionTest(bucketIds);
    } else if (!isStoreLoading) {
      // Handle case where there are no buckets
      setIsTesting(false);
    }
  }, [bucketIds, isStoreLoading, runConnectionTest, testS3]);

  if (isStoreLoading) {
    return <S3BucketViewerSkeleton />;
  }

  if (bucketIds.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-center">
        <p className="text-muted-foreground">
          No buckets found in this folder.{' '}
          <a href="/buckets/new" className="text-underline">
            Add a bucket
          </a>{' '}
          to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center space-y-6 justify-between">
        <h1 className="text-2xl font-semibold">Bucket Management</h1>
        <div className="flex flex-row space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTestS3(true)}
            disabled={isTesting}
          >
            {testS3 ? (
              <span
                className="flex flex-row gap-2 items-center"
                onClick={() => runConnectionTest(bucketIds)}
              >
                {' '}
                <RefreshCwIcon
                  className={`mr-2 h-4 w-4 ${isTesting ? 'animate-spin' : ''}`}
                />
                {isTesting ? 'Testing...' : 'Refresh Status'}
              </span>
            ) : (
              <span className="flex flex-row gap-2 items-center">
                <TestTube2Icon /> Test Connection
              </span>
            )}
          </Button>
          <Link href={`/buckets/new?folderId=${selectedFolderId}`}>
            <Button variant={'outline'} size={'sm'}>
              <PlusIcon /> New Bucket
            </Button>
          </Link>
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {bucketIds.map(id => {
          const bucketInfo = getBucketInfo(id);
          if (!bucketInfo) return null;

          const statusInfo = statuses.find(s => s.bucket === id);

          return (
            <BucketCard
              key={id}
              bucketInfo={bucketInfo}
              statusInfo={statusInfo}
              isTesting={isTesting}
              testS3={testS3}
            />
          );
        })}
      </div>
    </div>
  );
}

// Sub-component for individual bucket cards
function BucketCard({
  bucketInfo,
  statusInfo,
  isTesting,
  testS3,
}: {
  bucketInfo: Bucket;
  statusInfo?: ConnectionStatus;
  isTesting: boolean;
  testS3: boolean;
}) {
  const usagePercentage = parseFloat(bucketInfo.usage_percentage.toString());
  const usedGB =
    parseFloat(bucketInfo?.storage_used_bytes.toString()) /
    (1024 * 1024 * 1024);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="truncate">{bucketInfo.bucket_name}</CardTitle>
            <CardDescription className="capitalize">
              {bucketInfo.provider}
            </CardDescription>
          </div>
          {testS3 ? (
            <>
              {' '}
              {isTesting ? (
                <Skeleton className="h-4 w-20 rounded-full" />
              ) : (
                <Tooltip>
                  <Button
                    size={'sm'}
                    variant="ghost"
                    className="flex items-center gap-1.5"
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${statusInfo?.status === 'Success' ? 'bg-green-500' : 'bg-red-500'}`}
                    />
                    {statusInfo?.status || 'Testing...'}
                    {statusInfo?.message ? (
                      <>
                        <TooltipTrigger>
                          <InfoIcon />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{statusInfo?.message}</p>
                        </TooltipContent>
                      </>
                    ) : null}
                  </Button>
                </Tooltip>
              )}
            </>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <StorageChart
          storageUsedGB={usedGB}
          availableCapacityGB={parseFloat(
            bucketInfo.available_storage_gb.toString(),
          )}
          usagePercentage={parseFloat(bucketInfo.usage_percentage.toString())}
        />
        <div>
          <div className="flex justify-between mb-1 text-sm text-muted-foreground">
            <span>
              {usedGB.toFixed(2)} GB ({usagePercentage.toFixed(2)}%)
            </span>
            <span>{bucketInfo.total_capacity_gb} GB total</span>
          </div>
          <Progress value={usagePercentage} />
        </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Tooltip>
          <Link href={`/buckets/move?bucketId=${bucketInfo.bucket_id}`}>
            <TooltipTrigger asChild>
              <Button size="icon" variant={'secondary'}>
                <Move3DIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move to folder</TooltipContent>
          </Link>
        </Tooltip>
        <Tooltip>
          <Link
            href={`/uploads?bucketId=${bucketInfo.bucket_id}`}
            className="cursor-auto"
          >
            <TooltipTrigger asChild>
              <Button size="icon" variant={'secondary'}>
                <FileJson />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Manage Files</TooltipContent>
          </Link>
        </Tooltip>
        <Tooltip>
          <Link href={`/upload?bucketId=${bucketInfo.bucket_id}`}>
            <TooltipTrigger>
              <Button size="icon" variant={'secondary'}>
                <UploadCloudIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Upload files</TooltipContent>
          </Link>
        </Tooltip>
        <Tooltip>
          <Link href={`/buckets/edit?bucketId=${bucketInfo.bucket_id}`}>
            <TooltipTrigger>
              <Button size="icon" variant={'secondary'}>
                <Settings2Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Configure</TooltipContent>
          </Link>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger>
            <Button size="icon" variant={'secondary'} onClick={async () => {
              refreshBucketUsage([bucketInfo.bucket_id]);
            }}>
              <RefreshCwIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh usage</TooltipContent>
        </Tooltip>
      </CardFooter>
    </Card>
  );
}

// Skeleton loader component
export function S3BucketViewerSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <Skeleton className="h-32 w-32 rounded-full" />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-full" />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-20" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
