"use client"

import {
  FileText,
  Film,
  ImageIcon,
  // LayoutDashboard,
  // Menu,
  // Plus,
  // Settings,
  // Upload,
  // Users,
  // X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function DashboardPage() {
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
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">1,284</div>
                <p className="text-xs text-muted-foreground">+24 files from last week</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Images</CardTitle>
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">684</div>
                <p className="text-xs text-muted-foreground">53% of total files</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Documents</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">492</div>
                <p className="text-xs text-muted-foreground">38% of total files</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Videos</CardTitle>
                <Film className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">108</div>
                <p className="text-xs text-muted-foreground">9% of total files</p>
              </CardContent>
            </Card>
          </div>

          {/* Storage usage */}
          <Card>
            <CardHeader>
              <CardTitle>Storage Usage</CardTitle>
              <CardDescription>You've used 68% of your storage (6.8 GB of 10 GB)</CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={68} className="h-2" />
              <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-full bg-primary"></div>
                    <span>Images</span>
                  </div>
                  <span className="font-medium">3.4 GB</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                    <span>Documents</span>
                  </div>
                  <span className="font-medium">1.2 GB</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                    <span>Videos</span>
                  </div>
                  <span className="font-medium">2.2 GB</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent uploads */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Uploads</CardTitle>
              <CardDescription>You've uploaded 24 files in the last 7 days.</CardDescription>
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
                        <TableRow>
                          <TableCell className="font-medium">presentation.pdf</TableCell>
                          <TableCell className="hidden md:table-cell">PDF</TableCell>
                          <TableCell className="hidden md:table-cell">2.4 MB</TableCell>
                          <TableCell>Just now</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">vacation-photo.jpg</TableCell>
                          <TableCell className="hidden md:table-cell">JPG</TableCell>
                          <TableCell className="hidden md:table-cell">3.2 MB</TableCell>
                          <TableCell>2 hours ago</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">project-demo.mp4</TableCell>
                          <TableCell className="hidden md:table-cell">MP4</TableCell>
                          <TableCell className="hidden md:table-cell">24.8 MB</TableCell>
                          <TableCell>Yesterday</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">budget-2023.xlsx</TableCell>
                          <TableCell className="hidden md:table-cell">XLSX</TableCell>
                          <TableCell className="hidden md:table-cell">1.8 MB</TableCell>
                          <TableCell>Yesterday</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">profile-picture.png</TableCell>
                          <TableCell className="hidden md:table-cell">PNG</TableCell>
                          <TableCell className="hidden md:table-cell">0.8 MB</TableCell>
                          <TableCell>2 days ago</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-4 flex justify-center">
                    <Button variant="outline">View All Files</Button>
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
                        <TableRow>
                          <TableCell className="font-medium">vacation-photo.jpg</TableCell>
                          <TableCell className="hidden md:table-cell">JPG</TableCell>
                          <TableCell className="hidden md:table-cell">3.2 MB</TableCell>
                          <TableCell>2 hours ago</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">profile-picture.png</TableCell>
                          <TableCell className="hidden md:table-cell">PNG</TableCell>
                          <TableCell className="hidden md:table-cell">0.8 MB</TableCell>
                          <TableCell>2 days ago</TableCell>
                        </TableRow>
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
                        <TableRow>
                          <TableCell className="font-medium">presentation.pdf</TableCell>
                          <TableCell className="hidden md:table-cell">PDF</TableCell>
                          <TableCell className="hidden md:table-cell">2.4 MB</TableCell>
                          <TableCell>Just now</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">budget-2023.xlsx</TableCell>
                          <TableCell className="hidden md:table-cell">XLSX</TableCell>
                          <TableCell className="hidden md:table-cell">1.8 MB</TableCell>
                          <TableCell>Yesterday</TableCell>
                        </TableRow>
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
                        <TableRow>
                          <TableCell className="font-medium">project-demo.mp4</TableCell>
                          <TableCell className="hidden md:table-cell">MP4</TableCell>
                          <TableCell className="hidden md:table-cell">24.8 MB</TableCell>
                          <TableCell>Yesterday</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
