"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBucketStore } from "@/hooks/use-bucket-store";
import { ArrowDown, ArrowDownAZ, ArrowDownNarrowWideIcon, ArrowDownWideNarrowIcon, ArrowDownZA, ArrowUp, CalendarArrowDown, CalendarArrowUp, Copy, Eye, EyeOff, FileText, Grid, List, RefreshCw, Square, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { ConfirmModal } from "./ConfirmModal";
import FileIcon from "./FileIcon";
export default function FileList() {
  const { selectedBucketId: selectedBucket } = useBucketStore();
  const [state, setState] = useState<Record<string, any>>({
    files: [],
    loading: false,
    sort: "name_asc",
    search: "",
    page: 1,
    limit: 10,
    totalPages: 1,
    totalFiles: 0,
    view: "list",
    selectedFile: null,
    modals: { delete: false, privacy: false },
  });

  useEffect(() => {
    if (selectedBucket) {
      fetchFiles();
    }
  }, [selectedBucket, state.sort, state.search, state.page, state.limit]);

  const fetchFiles = async () => {
    setState((prev) => ({ ...prev, loading: true }));

    try {
      const res = await fetch(
        `/api/files?sort=${state.sort}&search=${state.search}&page=${state.page}&limit=${state.limit}`, {
        }
      );
      const data = await res.json();

      const publicFilesWithUrls = data.files.map((file: any) => ({
        ...file,
        url: `https://s3.tebi.io/${file.bucket}/${file.key}`,
      }));

      setState((prev) => ({
        ...prev,
        files: publicFilesWithUrls,
        totalPages: Math.ceil(data.total / state.limit),
        totalFiles: data.total,
        loading: false,
      }));
    } catch (error) {
      toast.error("Error fetching files:"+ error);
      setState((prev) => ({ ...prev, loading: false }));
    }
  };

  const deleteFile = async () => {
    if (!state.selectedFile) return;
    setState((prev => ({ ...prev, loading: true })));
    const { message, error } = await fetch(`/api/files`, { method: "DELETE", body: JSON.stringify({ fileId: state.selectedFile.id }) }).then((res) => res.json());
    if(error){
      toast.error(error)
    }
    if(message){
      toast.success(message)
    }
    setState((prev) => ({ ...prev, loading: false, modals: { ...prev.modals, delete: false } }));
    fetchFiles();
  };

  const togglePrivacy = async () => {
    if (!state.selectedFile) return;
    setState((prev => ({ ...prev, loading: true })));
    const { message, error } = await fetch(`/api/files/privacy`, {
      method: "PATCH",
      body: JSON.stringify({ fileId: state.selectedFile.id, isPublic: !state.selectedFile.is_public }),
    }).then((res) => res.json());
    if(error){
      toast.error(error)
    }
    if(message){
      toast.success(message)
    }
    setState((prev) => ({ ...prev, loading: false, modals: { ...prev.modals, privacy: false } }));
    fetchFiles();
  };

  const copyToClipboard = async (text: string) => {
    try {
      console.log(text)
      if (!text) {
        toast.error("No link to copy!")
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Link copied to clipboard!");
      }
    } catch {
      toast.error("Failed to copy link.");
    }
  };

  const getDownloadUrl = async(id: string) =>{
      if (!id) return null;
      const res = await fetch(`/api/files/url?fileId=${id}&expiresIn=7200`);
      const {url, error} = await res.json();
      if(error){
        return null
      }
    return url;
  }

  const goToNextPage = () => {
    setState((prev) => ({
      ...prev,
      page: Math.min(prev.page + 1, prev.totalPages), // Prevent exceeding total pages
    }));
  };

  const goToPreviousPage = () => {
    setState((prev) => ({
      ...prev,
      page: Math.max(prev.page - 1, 1), // Prevent going below page 1
    }));
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <Input placeholder="Search files..." value={state.search} onChange={(e) => setState({ ...state, search: e.target.value })} className="w-auto md:w-[200px] lg:w-[400px]" />
        <div className="flex gap-2">
          <Select onValueChange={(val) => setState({ ...state, sort: val })} defaultValue="name_asc">
            <SelectTrigger><SelectValue placeholder="Sort by" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc"><ArrowDownAZ className="mr-2"/> Alphabatically</SelectItem>
              <SelectItem value="name_desc"><ArrowDownZA className="mr-2"/> Alphabatically</SelectItem>
              <SelectItem value="size_asc"><ArrowDownNarrowWideIcon className="mr-2"/> Size</SelectItem>
              <SelectItem value="size_desc"><ArrowDownWideNarrowIcon className="mr-2"/> Size</SelectItem>
              <SelectItem value="type_asc"><ArrowUp className="mr-2"/> Type</SelectItem>
              <SelectItem value="type_desc"><ArrowDown className="mr-2"/> Type</SelectItem>
              <SelectItem value="uploaded_at_asc"><CalendarArrowUp className="mr-2"/> Date</SelectItem>
              <SelectItem value="uploaded_at_desc"><CalendarArrowDown className="mr-2"/> Date</SelectItem>
            </SelectContent>
          </Select>
          <Select onValueChange={(val) => setState({ ...state, limit: parseInt(val) })} defaultValue="10">
            <SelectTrigger><SelectValue placeholder="Items per page" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex space-x-2">
        {["list", "grid", "compact"].map((mode) => (
          <Button key={mode} size="icon" variant={state.view === mode ? "default" : "outline"} onClick={() => setState({ ...state, view: mode })}>
            {mode === "list" ? <List className="w-5 h-5" /> : mode === "grid" ? <Grid className="w-5 h-5" /> : <Square className="w-5 h-5" />}
          </Button>
        ))}
        <Button size="icon" variant="outline" onClick={fetchFiles}><RefreshCw /></Button>
      </div>
      <p className="text-sm text-gray-500">Showing {state.files.length} of total {state.totalFiles} files</p>
      {state.view === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {state.files.map((file: any) => (
             <div
              key={file?.id}
              className="relative group border rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-all bg-gray-500"
            >
              {/* File Preview */}
              <div className="h-40 flex items-center justify-center bg-background">
                {(file.is_public && file.type.startsWith("image/")) ? (
                  <img src={file.url} alt={file.filename} className="w-full h-full object-cover" />
                ) : (file.is_public && file.type.startsWith("video/")) ? (
                  <video src={file.url} className="w-full h-full object-cover" controls />
                ) : file.type === "application/pdf" ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <FileText className="w-12 h-12 text-gray-500" />
                    <span className="text-sm text-gray-500">PDF File</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full">
                    <FileIcon fileType={file.filename} />
                    <span className="text-sm text-gray-500">{file.type.startsWith("image/") ? 'Image file': (file.type.startsWith('video/') ? 'Video file': 'Unknown file')}</span>
                  </div>
                )}
              </div>

              {/* File Info & Actions */}
              <div className="p-3 flex bg-background border-t justify-between items-center">
                <span className="text-sm font-medium truncate">{file.filename}</span>

                {/* Action Buttons (Visible on Hover) */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-2 transition-opacity">
                  <Button
                    onClick={async () => {
                      const link:string = await getDownloadUrl(file.id);
                      await copyToClipboard(link)
                    }}
                    size="icon"
                    variant="outline"
                   >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setState({ ...state, selectedFile: file, modals: { ...state.modals, privacy: true } })}
                  >
                    {file.is_public ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button
                    onClick={() => setState((prev) => ({
                      ...prev,
                      selectedFile: file,
                      modals: { ...prev.modals, delete: true }
                    }))}
                    size="icon"
                    variant="destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {state.view === "compact" && (
        <div className="flex flex-col gap-2">
          {state.files.map((file: any) => (
            <div
              key={file.id}
              className="flex group justify-between items-center p-3 border rounded-lg hover:bg-muted/80 hover:border transition-colors"
            >
              {/* File Info */}
              <div className="flex items-center gap-3 truncate">
                <div className="w-8 h-8 bg-gray-200 rounded-md flex items-center justify-center">
                  <FileIcon fileType={file.filename}  />
                </div>
                <div className="truncate">
                  <p className="text-sm font-medium truncate max-w-[150px] sm:max-w-none">{file.filename}</p>
                  <p className="text-xs truncate text-neutral-500 max-w-[150px] sm:max-w-none">{(file.size / 1024).toFixed(2)} KB <br/> uploaded on {new Date(file.uploaded_at).toLocaleString('en-IN', {month: 'short', day: 'numeric', year: 'numeric'})}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 lg:transition-opacity">
                <Button
                  variant="default"
                  size="icon"
                  onClick={async () => {
                  const link:string = await getDownloadUrl(file.id);
                  await copyToClipboard(link)
                }}>
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  variant="default"
                  size="icon"
                  onClick={() => setState({ ...state, selectedFile: file, modals: { ...state.modals, privacy: true } })}
                >
                  {file.is_public ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => setState({ ...state, selectedFile: file, modals: { ...state.modals, delete: true } })}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {state.view === "list" && (
        <div className="overflow-x-auto">
        <Table className="w-full border border-muted rounded-lg ">
          <TableHeader>
            <TableRow>
              <TableHead className="font-bold">Filename</TableHead>
              <TableHead className="font-bold">Size</TableHead>
              <TableHead className="font-bold">Uploaded</TableHead>
              <TableHead className="sr-only lg:not-sr-only font-bold">Visibility</TableHead>
              <TableHead className="font-bold" align="right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.files.length >0 ? (state.files.map((file: any) => (
              <TableRow key={file.id}>
                <TableCell className="truncate max-w-[150px] sm:max-w-none">{file.filename}</TableCell>
                <TableCell>{(file.size / 1024).toFixed(2)} KB</TableCell>
                <TableCell>{new Date(file.uploaded_at).toLocaleDateString('en-IN')}</TableCell>
                <TableCell className="sr-only lg:not-sr-only">{file.is_public ? "Public" : "Private"}</TableCell>
                <TableCell align="right" className="mr-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="icon">...</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setState({ ...state, selectedFile: file, modals: { ...state.modals, privacy: true } })}>
                        {file.is_public ? <><EyeOff className="mr-2 h-4 w-4" /> Make file private</> : <><Eye className="mr-2 h-4 w-4" /> Make file public</>}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={async () => {
                        const link:string = await getDownloadUrl(file.id);
                        await copyToClipboard(link)
                      }}>
                        <Copy className="mr-2 h-4 w-4" /> Copy Link
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => setState({ ...state, selectedFile: file, modals: { ...state.modals, delete: true } })}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete file
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))): <TableRow><TableCell colSpan={5} className="text-left text-primary/80">No files found!</TableCell></TableRow>}
          </TableBody>
        </Table>
        </div>
      )}


      <ConfirmModal open={state.modals.delete} onClose={() => setState({ ...state, modals: { ...state.modals, delete: false } })} onConfirm={deleteFile} title="Delete file" description={`Are you sure you want to delete ${state.selectedFile?.filename}? This action cannot be undone.`} confirmText={state?.loading ? 'Deleting' : 'Delete'} danger />
      <ConfirmModal open={state.modals.privacy} onClose={() => setState({ ...state, modals: { ...state.modals, privacy: false } })} onConfirm={togglePrivacy} title="Change Privacy" description="Are you sure? You want to change the privacy of this file." confirmText={state.loading ? `Waiting...` : `Change`} />
      {/* Pagination */}
      <div className="flex justify-between items-center mt-12">
          <Button onClick={goToPreviousPage} disabled={state.page === 1}>
            Previous
          </Button>
          <span>
            Page {state.page} of {state.totalPages}
          </span>
          <Button onClick={goToNextPage} disabled={state.page === state.totalPages}>
            Next
          </Button>
        </div>
    </div>
  );
}
