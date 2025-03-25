"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useEffect, useState } from "react"
import { useBucketStore } from "@/hooks/use-bucket-store"
import FileIcon from "./FileIcon"
import { getSingleBucketStorageUsage } from "@/service/s3-tebi"
import { StorageProgress } from "./StorageProgress"
import { formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { Button } from "../ui/button"
import { formatBytes } from "@/lib/utils"
import { Skeleton } from "../ui/skeleton"
import { toast } from "sonner"
import IncompleteUploads from "./IncompleteUploads"

type Stats = {
  total_files: number
  last_week_files: number
  total_images: number
  total_documents: number
  total_videos: number
  images_percent: number
  documents_percent: number
  videos_percent: number
  images_size_gb: number
  documents_size_gb: number
  videos_size_gb: number
}

export default function DashboardPage() {
  const { selectedBucket } = useBucketStore()
  const [stats, setStats] = useState<Stats| null>(null);
   const [storage, setStorage] = useState<any|null>(null);
   const [recentFiles, setRecentFiles] = useState<any[]>([]);
   const [recentImages, setRecentImages] = useState<any[]>([]);
   const [recentVideos, setRecentVideos] = useState<any[]>([]);
   const [recentDocs, setRecentDocs] = useState<any[]>([]);
   // const [activeTab, setActiveTab] = useState("all");
   useEffect(() => {
     try {
      Promise.all([
       fetch(`/api/files/stats?bucket=${selectedBucket}`)
         .then(res => res.json())
         .then(setStats),
       // Fetch storage usage
       fetchStorageUsage(selectedBucket),
       // Fetch recent files
       fetchRecentFiles('all')])

     } catch(e: any){
       toast.error(e)
     } finally {
     }
     }, [selectedBucket]);


   const fetchRecentFiles = async (type: string) => {
     try {
       const url = `/api/files?bucket=${selectedBucket}&recent=true&sort=uploaded_at_desc&limit=15`;
       const response = await fetch(url);
       const data = await response.json();

       // Set all files
       setRecentFiles(data.files);

       // Filter and set categories
       setRecentImages(data.files.filter((f: any) => f.type.startsWith('image/')));
       setRecentVideos(data.files.filter((f: any) => f.type.startsWith('video/')));
       setRecentDocs(data.files.filter((f:any) =>
         f.type.startsWith('application/') ||
         f.type.startsWith('text/')
       ));
     } catch (error) {
       toast.error('Error fetching recent files:'+ error);
     }
   };
  const fetchStorageUsage = async (bucketId: string) => {
  const usage =   await getSingleBucketStorageUsage(bucketId)
    setStorage(usage)
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
                <div className="text-2xl font-bold">{stats?.total_files || 0}</div>
                <p className="text-xs text-muted-foreground">+{stats?.last_week_files || 0} files from last week</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Images</CardTitle>
                <FileIcon fileType="image.jpg" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.total_images || 0}</div>
                <p className="text-xs text-muted-foreground">{stats?.images_percent || 0}% of total files</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Documents</CardTitle>
                <FileIcon fileType="document.pdf" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.total_documents || 0}</div>
                <p className="text-xs text-muted-foreground">{stats?.documents_percent || 0}% of total files</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Videos</CardTitle>
                <FileIcon fileType="video.mp4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.total_videos || 0}</div>
                <p className="text-xs text-muted-foreground">{stats?.videos_percent|| 0}% of total files</p>
              </CardContent>
            </Card>
          </div>

          {/* Storage usage */}
          <Card>
            <CardHeader>
              <CardTitle>Storage Usage</CardTitle>
              <CardDescription>You've used {((storage?.storageUsedGB || 0)*100 / (storage?.totalStorage || 25)).toFixed(2) || 0} % of your storage ({storage?.storageUsedGB || 0} GB out of {storage?.totalStorage || 0} GB)</CardDescription>
            </CardHeader>
            <CardContent>
              <StorageProgress
                used={storage?.storageUsedGB || 0}
                total={storage?.totalStorage || 25}
                breakdown={{
                  images_size_gb: stats?.images_size_gb || 0,
                  documents_size_gb: stats?.documents_size_gb || 0,
                  videos_size_gb: stats?.videos_size_gb || 0
                }}
              />
            </CardContent>
          </Card>

          {/* Recent uploads */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Uploads</CardTitle>
              <CardDescription>You've uploaded {stats?.last_week_files || 0} files in the last 7 days.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="all">
                <TabsList className="mb-4">
                  <TabsTrigger value="all">All Files</TabsTrigger>
                  <TabsTrigger value="images">Images</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                  <TabsTrigger value="videos">Videos</TabsTrigger>
                </TabsList>
                <TabsContent value="all" className="m-0">
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
                        {recentFiles.map((file: any) => (
                          <TableRow key={file?.id}>
                            <TableCell className="font-medium">{file?.filename}</TableCell>
                            <TableCell className="hidden md:table-cell">
                              {file?.type.split('/')[1].toUpperCase()}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">{formatBytes(file?.size)}</TableCell>
                            <TableCell>
                              {formatDistanceToNow(new Date(file?.uploaded_at), { addSuffix: true })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
                <TabsContent value="images" className="m-0">
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
                        {recentImages.map((file: any) => (
                          <TableRow key={file?.id}>
                            <TableCell className="font-medium">{file?.filename}</TableCell>
                            <TableCell className="hidden md:table-cell">
                              {file?.type.split('/')[1].toUpperCase()}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">{formatBytes(file?.size)}</TableCell>
                            <TableCell>
                              {formatDistanceToNow(new Date(file?.uploaded_at), { addSuffix: true })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
                <TabsContent value="documents" className="m-0">
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
                        {recentDocs.map((file: any) => (
                          <TableRow key={file?.id}>
                            <TableCell className="font-medium">{file?.filename}</TableCell>
                            <TableCell className="hidden md:table-cell">
                              {file?.type.split('/')[1].toUpperCase()}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">{formatBytes(file?.size)}</TableCell>
                            <TableCell>
                              {formatDistanceToNow(new Date(file?.uploaded_at), { addSuffix: true })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
                <TabsContent value="videos" className="m-0">
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
                        {recentVideos.map((file: any) => (
                          <TableRow key={file?.id}>
                            <TableCell className="font-medium">{file?.filename}</TableCell>
                            <TableCell className="hidden md:table-cell">
                              {file?.type.split('/')[1].toUpperCase()}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">{formatBytes(file?.size)}</TableCell>
                            <TableCell>
                              {formatDistanceToNow(new Date(file?.uploaded_at), { addSuffix: true })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
              <div className="mt-4 flex justify-center">
                <Link href='/uploads'><Button variant={'outline'}> View All Files</Button></Link>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Incomplete Multipart Uploads</CardTitle>
              {/* <CardDescription>You've uploaded {stats?.last_week_files || 0} files in the last 7 days.</CardDescription> */}
            </CardHeader>
            <CardContent>
              <IncompleteUploads />
            </CardContent>
          </Card>
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
          {/* Overview Text */}
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-64" />
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="p-4 border rounded shadow-sm">
                <div className="flex items-center justify-between pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-6 rounded" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>

          {/* Storage Usage Card */}
          <div className="border rounded p-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-60" />
            </div>
            <div className="mt-4">
              <Skeleton className="h-4 w-full" />
              <div className="mt-2 space-y-1">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
          </div>

          {/* Recent Uploads Card */}
          <div className="border rounded p-4">
            <div className="space-y-2 mb-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-48" />
            </div>
            <div className="overflow-auto">
              <div className="min-w-full">
                {/* Table header */}
                <div className="border-b">
                  <div className="flex">
                    {["Name", "Type", "Size", "Uploaded"].map((header, index) => (
                      <div key={index} className={`px-4 py-2 ${index > 0 ? "hidden md:block" : ""}`}>
                        <Skeleton className="h-4 w-16" />
                      </div>
                    ))}
                  </div>
                </div>
                {/* Table rows */}
                <div className="space-y-2 mt-4">
                  {Array.from({ length: 4 }).map((_, rowIndex) => (
                    <div key={rowIndex} className="flex items-center">
                      <div className="px-4 py-2 flex-1">
                        <Skeleton className="h-4 w-24" />
                      </div>
                      <div className="px-4 py-2 flex-1 hidden md:block">
                        <Skeleton className="h-4 w-16" />
                      </div>
                      <div className="px-4 py-2 flex-1 hidden md:block">
                        <Skeleton className="h-4 w-16" />
                      </div>
                      <div className="px-4 py-2 flex-1">
                        <Skeleton className="h-4 w-20" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-center">
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
