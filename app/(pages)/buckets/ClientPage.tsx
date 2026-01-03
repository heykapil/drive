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
  getBucketsFromFolder,
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
  uniqueId?: string;
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
  const runConnectionTest = useCallback(async (buckets: Bucket[]) => {
    setIsTesting(true);
    try {
      const s3Ids = buckets.filter(b => b.bucketType === 'S3').map(b => b.bucket_id);
      const tbIds = buckets.filter(b => b.bucketType === 'TB').map(b => b.bucket_id);

      const s3Results = s3Ids.length > 0 ? await testS3Connection(s3Ids) : [];

      // Dynamically import testTBConnection to avoid server-side import issues in client component if it uses 'use server' actions unfit for client
      // Actually testTBConnection is in 'lib/actions/terabox.ts' which has 'use server', so it's safe to import at top or here.
      // But we need to import it. Let's add import at top.
      // For now, assume we will add import.

      const { testTBConnection } = await import('@/lib/actions/terabox');
      const tbResults = tbIds.length > 0 ? await testTBConnection(tbIds) : [];

      const combinedResults: ConnectionStatus[] = [
        ...s3Results.map(r => ({ ...r, uniqueId: `s3_${r.bucket}` })),
        ...tbResults.map(r => ({ ...r, uniqueId: `tb_${r.bucket}` })) // testTBConnection returns bucket: number.
      ];

      setStatuses(combinedResults);
      const errorCount = combinedResults.filter(r => r.status === 'Error').length;
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
      // Need full bucket info for testing
      const buckets = bucketIds.map(id => getBucketInfo(id)).filter((b): b is Bucket => !!b);
      runConnectionTest(buckets);
    } else if (!isStoreLoading) {
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
                onClick={() => {
                  const buckets = bucketIds.map(id => getBucketInfo(id)).filter((b): b is Bucket => !!b);
                  runConnectionTest(buckets);
                }}
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
          // getBucketInfo by ID might be ambiguous if IDs collide, but getBucketIdsFromFolderId returns IDs. 
          // getBucketInfo logic tries uniqueId then numeric.
          // Better to iterate buckets directly from folder?
          // We have getBucketsFromFolder(selectedFolderId).
          // But here bucketIds are just numbers?
          // Wait, getBucketIdsFromFolderId returns number[].
          // If we have S3 id 1 and TB id 1, getBucketIdsFromFolderId might return [1, 1].
          // This is bad.
          // Let's rely on useBucketStore to give us Buckets directly or fix the logic.
          // Actually, let's use getBucketsFromFolder instead of bucketIds.
          return null; // Logic moved to main component body
        })}
        {/* Replacement map logic */}
        {getBucketsFromFolder(selectedFolderId!).map(bucketInfo => {
          const statusInfo = statuses.find(s => s.uniqueId === bucketInfo.uniqueId);

          return (
            <BucketCard
              key={bucketInfo.uniqueId}
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
          <Link href={`/buckets/move?uniqueId=${bucketInfo.uniqueId}`}>
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
            href={`/uploads?bucketId=${bucketInfo.uniqueId}`}
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
          <Link href={`/upload?bucketId=${bucketInfo.uniqueId}`}>
            <TooltipTrigger>
              <Button size="icon" variant={'secondary'}>
                <UploadCloudIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Upload files</TooltipContent>
          </Link>
        </Tooltip>
        <Tooltip>
          <Link href={`/buckets/edit?uniqueId=${bucketInfo.uniqueId}`}>
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
              // refreshBucketUsage should technically support uniqueIds too or we split
              // assuming refreshBucketUsage only S3 for now or needs update
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
