"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getBucketIdsFromFolderId, getBucketInfo, useBucketStore } from "@/hooks/use-bucket-store"
import { Bucket, formatBytes } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { PaintBucketIcon } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "../ui/button"
import { Skeleton } from "../ui/skeleton"
import FileIcon from "./FileIcon"
import IncompleteUploads from "./IncompleteUploads"
import { StorageProgress } from "./StorageProgress"

// Type for the file statistics API response
type Stats = {
  total_files: number
  last_week_files: number
  total_images: number
  total_documents: number
  total_videos: number
  images_percent: number
  documents_percent:  number
  videos_percent: number
  images_size_gb: number
  documents_size_gb: number
  videos_size_gb: number
}

// Type for a single file object
type RecentFile = {
  id: number;
  filename: string;
  type: string;
  size: number;
  uploaded_at: string;
}

// Type for aggregated storage information
type AggregatedStorage = {
    storageUsedBytes: number;
    totalCapacityBytes: number;
    storageUsedGB: string;
    totalCapacityGB: string;
}

// Reusable component for the recent files table to keep code DRY
function RecentFilesTable({ files }: { files: RecentFile[] }) {
    if (files.length === 0) {
        return <p className="text-center text-muted-foreground py-4">No recent files found.</p>;
    }

    return (
        <div className="overflow-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden md:table-cell">Type</TableHead>
                        <TableHead className="hidden md:table-cell">Size</TableHead>
                        <TableHead>Uploaded</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {files.map((file) => (
                        <TableRow key={file.id}>
                            <TableCell className="font-medium truncate max-w-xs">{file.filename}</TableCell>
                            <TableCell className="hidden md:table-cell">{file.type.split('/')[1]?.toUpperCase()}</TableCell>
                            <TableCell className="hidden md:table-cell">{formatBytes(file.size)}</TableCell>
                            <TableCell>{formatDistanceToNow(new Date(file.uploaded_at), { addSuffix: true })}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}


export default function DashboardPage() {
    const { selectedFolderId, isLoading: isStoreLoading } = useBucketStore();
    const [stats, setStats] = useState<Stats | null>(null);
    const [storage, setStorage] = useState<AggregatedStorage | null>(null);
    const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
    const [isFetching, setIsFetching] = useState(true);
    const [loadIncompleteUpload, setLoadIncompleteUpload] = useState(false);
    useEffect(() => {
        const fetchData = async () => {
            if (!selectedFolderId || isStoreLoading) {
                return; // Wait for store to hydrate and a folder to be selected
            }
            setIsFetching(true);

            try {
                // Use the helper function to get all relevant bucket IDs
                const bucketIds = getBucketIdsFromFolderId(selectedFolderId);

                if (bucketIds.length === 0) {
                    setStats(null);
                    setStorage(null);
                    setRecentFiles([]);
                    return;
                }

                // Fetch stats and recent files concurrently
                const [statsResponse, filesResponse] = await Promise.all([
                    fetch(process.env.NEXT_PUBLIC_APP_URL + `/api/files/stats`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ bucketIds }),
                    }),
                    fetch(process.env.NEXT_PUBLIC_APP_URL + `/api/files?folderId=${selectedFolderId}&recent=true&sort=uploaded_at_desc&limit=15`)
                ]);

                if (!statsResponse.ok) throw new Error('Failed to fetch statistics.');
                if (!filesResponse.ok) throw new Error('Failed to fetch recent files.');

                const statsData = await statsResponse.json();
                const filesData = await filesResponse.json();

                setStats(statsData);
                setRecentFiles(filesData.files || []);

                // Aggregate storage info from the buckets in the store
                const bucketInfos = bucketIds.map(id => getBucketInfo(id)).filter((b): b is Bucket => b !== null);

                const totalUsed = bucketInfos.reduce((sum, b) => sum + Number(b.storage_used_bytes), 0);
                const totalCapacity = bucketInfos.reduce((sum, b) => sum + (+b.total_capacity_gb * 1024 * 1024 * 1024), 0);

                setStorage({
                    storageUsedBytes: totalUsed,
                    totalCapacityBytes: totalCapacity,
                    storageUsedGB: (totalUsed / (1024 * 1024 * 1024)).toFixed(2),
                    totalCapacityGB: (totalCapacity / (1024 * 1024 * 1024)).toFixed(2),
                });

            } catch (e: any) {
                toast.error(e.message || "An error occurred while fetching dashboard data.");
                setStats(null);
                setStorage(null);
                setRecentFiles([]);
            } finally {
                setIsFetching(false);
            }
        };

        fetchData();
    }, [selectedFolderId, isStoreLoading]);

    // Memoize file filtering to avoid re-calculation on every render
    const { recentImages, recentVideos, recentDocs } = useMemo(() => {
        return {
            recentImages: recentFiles.filter(f => f.type.startsWith('image/')),
            recentVideos: recentFiles.filter(f => f.type.startsWith('video/')),
            recentDocs: recentFiles.filter(f => f.type.startsWith('application/') || f.type.startsWith('text/')),
        };
    }, [recentFiles]);

    const usagePercentage = useMemo(() => {
        if (!storage || !storage.totalCapacityBytes) return 0;
        return (storage.storageUsedBytes / storage.totalCapacityBytes) * 100;
    }, [storage]);


    if (isFetching || isStoreLoading) {
        return <DashboardSkeleton />;
    }

    return (
        <div className="flex min-h-screen flex-col md:flex-row">
            <div className="flex-1 overflow-auto md:p-6">
                <div className="mx-auto max-w-6xl space-y-6">
                    <div className="flex flex-col gap-2">
                        <p className="text-muted-foreground">Overview of your file storage and recent uploads.</p>
                    </div>

                    {/* Stats cards */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Total Files</CardTitle>
                                <FileIcon fileType="document.txt" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats?.total_files ?? 0}</div>
                                <p className="text-xs text-muted-foreground">+{stats?.last_week_files ?? 0} from last week</p>
                            </CardContent>
                        </Card>
                        <Card>
                             <CardHeader className="flex flex-row items-center justify-between pb-2">
                                 <CardTitle className="text-sm font-medium">Images</CardTitle>
                                 <FileIcon fileType="image.jpg" />
                             </CardHeader>
                             <CardContent>
                                 <div className="text-2xl font-bold">{stats?.total_images ?? 0}</div>
                                 {/*<p className="text-xs text-muted-foreground">{stats?.images_percent ? stats?.images_percent?.toFixed(2) : 0}% of total files</p>*/}
                             </CardContent>
                         </Card>
                         <Card>
                             <CardHeader className="flex flex-row items-center justify-between pb-2">
                                 <CardTitle className="text-sm font-medium">Documents</CardTitle>
                                 <FileIcon fileType="document.pdf" />
                             </CardHeader>
                             <CardContent>
                                 <div className="text-2xl font-bold">{stats?.total_documents ?? 0}</div>
                                 <p className="text-xs text-muted-foreground">{stats?.documents_percent?.toFixed(2) ?? 0}% of total files</p>
                             </CardContent>
                         </Card>
                         <Card>
                             <CardHeader className="flex flex-row items-center justify-between pb-2">
                                 <CardTitle className="text-sm font-medium">Videos</CardTitle>
                                 <FileIcon fileType="video.mp4" />
                             </CardHeader>
                             <CardContent>
                                 <div className="text-2xl font-bold">{stats?.total_videos ?? 0}</div>
                                 {/*<p className="text-xs text-muted-foreground">{stats?.videos_percent?.toFixed(2) ?? 0}% of total files</p>*/}
                             </CardContent>
                        </Card>
                    </div>

                    {/* Storage usage */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex flex-row justify-between items-center"><p>Storage Usage</p><Button variant='link'>
                              <Link href={`/buckets`} className="flex flex-row gap-2 items-center">
                               <PaintBucketIcon /> Configure
                              </Link>
                            </Button></CardTitle>
                            <CardDescription >
                                This folder used {usagePercentage.toFixed(2)}% of the available buckets storage ({storage?.storageUsedGB ?? 0} GB out of {storage?.totalCapacityGB ?? 0} GB)

                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <StorageProgress
                                used={parseFloat(storage?.storageUsedGB ?? '0')}
                                total={parseFloat(storage?.totalCapacityGB ?? '0')}
                                breakdown={{
                                    images_size_gb: stats?.images_size_gb ?? 0,
                                    documents_size_gb: stats?.documents_size_gb ?? 0,
                                    videos_size_gb: stats?.videos_size_gb ?? 0
                                }}
                            />
                        </CardContent>
                    </Card>

                    {/* Recent uploads */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Uploads</CardTitle>
                            <CardDescription>You've uploaded {stats?.last_week_files ?? 0} files in the last 7 days.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="all">
                                <TabsList className="mb-4">
                                    <TabsTrigger value="all">All ({recentFiles.length})</TabsTrigger>
                                    <TabsTrigger value="images">Images ({recentImages.length})</TabsTrigger>
                                    <TabsTrigger value="documents">Documents ({recentDocs.length})</TabsTrigger>
                                    <TabsTrigger value="videos">Videos ({recentVideos.length})</TabsTrigger>
                                </TabsList>
                                <TabsContent value="all" className="m-0"><RecentFilesTable files={recentFiles} /></TabsContent>
                                <TabsContent value="images" className="m-0"><RecentFilesTable files={recentImages} /></TabsContent>
                                <TabsContent value="documents" className="m-0"><RecentFilesTable files={recentDocs} /></TabsContent>
                                <TabsContent value="videos" className="m-0"><RecentFilesTable files={recentVideos} /></TabsContent>
                            </Tabs>
                            <div className="mt-4 flex justify-center">
                                <Link href='/uploads'><Button variant={'outline'}> View All Files</Button></Link>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Incomplete Uploads - Kept as is */}
                    {loadIncompleteUpload ?
                    <Card>
                        <CardHeader>
                            <CardTitle>Incomplete Multipart Uploads</CardTitle>
                        </CardHeader>
                        <CardContent>
                           <IncompleteUploads />
                        </CardContent>
                    </Card>
                    : <Button variant="outline" onClick={()=>setLoadIncompleteUpload(true)}>Load incomplete multipart uploads!</Button>
                    }
                </div>
            </div>
        </div>
    )
}

export function DashboardSkeleton() {
    return (
        <div className="flex min-h-screen flex-col md:flex-row">
            <div className="flex-1 overflow-auto md:p-6">
                <div className="mx-auto max-w-6xl space-y-6">
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-5 w-3/4" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <Card key={index}>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-6 w-6" />
                                </CardHeader>
                                <CardContent>
                                    <Skeleton className="h-8 w-12 mb-2" />
                                    <Skeleton className="h-3 w-32" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="h-4 w-3/4 mt-2" />
                        </CardHeader>
                        <CardContent>
                           <Skeleton className="h-8 w-full" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-5 w-40" />
                            <Skeleton className="h-4 w-1/2 mt-2" />
                        </CardHeader>
                        <CardContent>
                            <div className="flex space-x-4 border-b mb-4">
                               <Skeleton className="h-8 w-20" />
                               <Skeleton className="h-8 w-20" />
                               <Skeleton className="h-8 w-24" />
                            </div>
                            <div className="space-y-4">
                                {Array.from({ length: 5 }).map((_, index) => (
                                    <div key={index} className="flex items-center space-x-4">
                                        <Skeleton className="h-6 flex-1" />
                                        <Skeleton className="h-6 w-24 hidden md:block" />
                                        <Skeleton className="h-6 w-24 hidden md:block" />
                                        <Skeleton className="h-6 w-32" />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
