"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBucketStore } from "@/hooks/use-bucket-store";
import { formatBytes, formatDate } from "@/lib/utils";
import { ArrowDownAZ, ArrowDownNarrowWide, ArrowDownWideNarrow, ArrowDownZA, CalendarDays, CheckSquare, Copy, Eye, EyeOff, FileText, Fullscreen, Grid, List, RefreshCw, Share, Square, Trash2 } from "lucide-react";
import { useEffect, useReducer, useState } from "react";
import { toast } from "sonner";
import { ConfirmModal } from "./ConfirmModal";
import FileIcon from "./FileIcon";
import FileViewer from "./FileViewer3";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Skeleton } from "./ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { VideoPlayer } from "./VideoPlayer4";

type FileState = {
  files: any[];
  sort: string;
  search: string;
  page: number;
  limit: number;
  totalPages: number;
  totalFiles: number;
  view: 'list' | 'grid' | 'compact';
  selectedFile: any | null;
  previewFile: any | null;
  modals: {
    delete: boolean;
    privacy: boolean;
    multidelete: boolean;
    multipublic: boolean;
    multiprivate: boolean;
  };
  loading: boolean;
  error: string | null;
};

type FileAction =
  | { type: 'SET_FIELD'; field: string; value: any }
  | { type: 'SET_MODAL'; modal: keyof FileState['modals']; value: boolean }
  | { type: 'RESET' };

const initialState: FileState = {
  files: [],
  sort: 'uploaded_at_desc',
  search: '',
  page: 1,
  limit: 25,
  totalPages: 1,
  totalFiles: 0,
  view: 'list',
  selectedFile: null,
  previewFile: null,
  modals: { delete: false, privacy: false, multidelete: false, multipublic: false, multiprivate: false },
  loading: false,
  error: null,
};

function fileReducer(state: FileState, action: FileAction): FileState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'SET_MODAL':
      return { ...state, modals: { ...state.modals, [action.modal]: action.value } };
    case 'RESET':
      return { ...initialState, view: state.view };
    default:
      return state;
  }
}

export default function FileList() {
  const { selectedBucket } = useBucketStore();
  const [state, dispatch] = useReducer(fileReducer, initialState);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles((prev) => {
      const newSelection = new Set(prev);
      if (newSelection.has(fileId)) {
        newSelection.delete(fileId);
      } else {
        newSelection.add(fileId);
      }
      return newSelection;
    });
  };

  const togglePrivacyForSelected = async (isPublic: boolean) => {
    if (selectedFiles.size === 0) return;

    try {
      dispatch({ type: "SET_FIELD", field: "loading", value: true });

      const fileIds = Array.from(selectedFiles); // Convert Set to array

      const response = await fetch(`/api/files/privacy?bucket=${selectedBucket}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileIds,  // ✅ Send all file IDs in **one request**
          isPublic,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update privacy");
      }

      toast.success(`${result.updatedCount} files are now ${isPublic ? "public" : "private"}`);

      // ✅ Close modals only on success
      dispatch({ type: "SET_MODAL", modal: "multiprivate", value: false });
      dispatch({ type: "SET_MODAL", modal: "multipublic", value: false });

      fetchFiles(); // ✅ Refresh file list
      setSelectedFiles(new Set()); // ✅ Clear selection only after success
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update privacy");
    } finally {
      dispatch({ type: "SET_FIELD", field: "loading", value: false });
    }
  };


  const deleteFiles = async () => {
    if (selectedFiles.size === 0) return;

    try {
      dispatch({ type: "SET_FIELD", field: "loading", value: true });

      const fileIds = Array.from(selectedFiles); // ✅ Convert Set to array

      const response = await fetch(`/api/files?bucket=${selectedBucket}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileIds }), // ✅ Send all fileIds in **one request**
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete files");
      }

      toast.success(`Deleted ${result.deletedCount} files successfully`);

      // ✅ Close modal only on success
      dispatch({ type: "SET_MODAL", modal: "multidelete", value: false });

      fetchFiles(); // ✅ Refresh file list
      setSelectedFiles(new Set()); // ✅ Clear selection only after success
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete files");
    } finally {
      dispatch({ type: "SET_FIELD", field: "loading", value: false });
    }
  };


  useEffect(() => {
    if (selectedBucket) {
      fetchFiles();
    } else {
      dispatch({ type: 'RESET' });
    }
  }, [selectedBucket, state.sort, state.search, state.page, state.limit]);

  const fetchFiles = async () => {
    try {
      dispatch({ type: 'SET_FIELD', field: 'loading', value: true });
      dispatch({ type: 'SET_FIELD', field: 'error', value: null });

      const res = await fetch(
        `/api/files?bucket=${selectedBucket}&sort=${state.sort}&search=${state.search}&page=${state.page}&limit=${state.limit}`, {
          // cache: 'no-store',
        }
      );

      if (!res.ok) toast.error('Failed to fetch files... Kindly refresh!');

      const data = await res.json();
      const publicFilesWithUrls = data.files.map((file: any) => ({
        ...file,
        url:  `https://s3.tebi.io/${file.bucket}/${file.key}`,
      }));

      dispatch({ type: 'SET_FIELD', field: 'files', value: publicFilesWithUrls });
      dispatch({ type: 'SET_FIELD', field: 'totalPages', value: Math.ceil(data.total / state.limit) });
      dispatch({ type: 'SET_FIELD', field: 'totalFiles', value: data.total });
    } catch (error) {
      dispatch({ type: 'SET_FIELD', field: 'error', value: error instanceof Error ? error.message : 'Failed to fetch files' });
      toast.error('Error fetching files');
    } finally {
      dispatch({ type: 'SET_FIELD', field: 'loading', value: false });
    }
  };

  const deleteFile = async () => {
    if (!state.selectedFile) return;

    try {
      dispatch({ type: "SET_FIELD", field: "loading", value: true });

      const response = await fetch(`/api/files?bucket=${selectedBucket}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }, // ✅ Proper headers
        body: JSON.stringify({ fileIds: [state.selectedFile.id] }), // ✅ Uses consistent API structure
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete file");
      }

      toast.success(result.message);
      fetchFiles(); // ✅ Refresh file list

      // ✅ Close modal only on success
      dispatch({ type: "SET_MODAL", modal: "delete", value: false });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete file");
    } finally {
      dispatch({ type: "SET_FIELD", field: "loading", value: false });
    }
  };


  const shareFile = async (duration: number) => {
    if (!state.selectedFile) return;
    try{
      const response = await fetch(`/api/files/share?bucket=${selectedBucket}`,{
        method: "POST",
        body: JSON.stringify({fileId: state.selectedFile.id, duration})
      })
      const { url, error } = await response.json();
      if(error || !url) toast.error(error || 'Failed to generate shared url for file')
      toast.success(`${state.selectedFile.filename} has been shared`,{ description: url })
    } catch(error){
      toast.error(error instanceof Error ? error.message : 'Failed to share the file')
    } finally {
      dispatch({ type: 'SET_FIELD', field: 'loading', value: false });
    }
  }

  const togglePrivacy = async () => {
    if (!state.selectedFile) return;

    try {
      dispatch({ type: "SET_FIELD", field: "loading", value: true });

      const response = await fetch(`/api/files/privacy?bucket=${selectedBucket}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" }, // ✅ Proper headers
        body: JSON.stringify({
          fileIds: [state.selectedFile.id], // ✅ Wrap in an array for API consistency
          isPublic: !state.selectedFile.is_public,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update privacy");
      }

      toast.success(`File is now ${!state.selectedFile.is_public ? "public" : "private"}`);
      fetchFiles();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update privacy");
    } finally {
      dispatch({ type: "SET_MODAL", modal: "privacy", value: false });
      dispatch({ type: "SET_FIELD", field: "loading", value: false });
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (!text) toast.error('No link to copy');
      setTimeout(() => navigator.clipboard.writeText(text), 0);
      toast.success("Link copied to clipboard!",
        // {description: text}
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to copy link');
    }
  };

  const getDownloadUrl = async (id: string) => {
    try {
      const res = await fetch(`/api/files/url?bucket=${selectedBucket}&fileId=${id}&expiresIn=7200`);
      const { url, error } = await res.json();
      if (error) toast.error(error);
      return   url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to get download URL');
      return null;
    }
  };

  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {Array.from({ length: state.limit }).map((_, i) => (
        <Skeleton key={i} className="h-[26px] w-full rounded-lg" />
      ))}
    </div>
  );

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between">
        <Input
          placeholder="Search files..."
          value={state.search}
          onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'search', value: e.target.value })}
          className="w-full md:max-w-[400px]"
        />

        <div className="flex gap-2 flex-wrap">
          <Select
            value={state.sort}
            onValueChange={(val) => dispatch({ type: 'SET_FIELD', field: 'sort', value: val })}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">
                <div className="flex items-center gap-2">
                  <ArrowDownAZ className="h-4 w-4" />
                  <span>Name (A-Z)</span>
                </div>
              </SelectItem>
              <SelectItem value="name_desc">
                <div className="flex items-center gap-2">
                  <ArrowDownZA className="h-4 w-4" />
                  <span>Name (Z-A)</span>
                </div>
              </SelectItem>
              <SelectItem value="size_asc">
                <div className="flex items-center gap-2">
                  <ArrowDownNarrowWide className="h-4 w-4" />
                  <span>Size (Small to Large)</span>
                </div>
              </SelectItem>
              <SelectItem value="size_desc">
                <div className="flex items-center gap-2">
                  <ArrowDownWideNarrow className="h-4 w-4" />
                  <span>Size (Large to Small)</span>
                </div>
              </SelectItem>
              <SelectItem value="uploaded_at_desc">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  <span>Newest First</span>
                </div>
              </SelectItem>
              <SelectItem value="uploaded_at_asc">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  <span>Oldest First</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={String(state.limit)}
            onValueChange={(val) => dispatch({ type: 'SET_FIELD', field: 'limit', value: Number(val) })}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Items per page" />
            </SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100].map((num) => (
                <SelectItem key={num} value={String(num)}>
                  {num} per page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2">
        {(["list", "grid", "compact"] as const).map((mode) => (
          <Button
            key={mode}
            size="icon"
            variant={state.view === mode ? "default" : "outline"}
            onClick={() => dispatch({ type: 'SET_FIELD', field: 'view', value: mode })}
          >
            {mode === "list" ? <List className="w-5 h-5" /> :
             mode === "grid" ? <Grid className="w-5 h-5" /> :
             <FileText className="w-5 h-5" />}
          </Button>
        ))}
        <Button size="icon" variant="outline" onClick={fetchFiles}>
          <RefreshCw className={`w-5 h-5 ${state.loading ? 'animate-spin' : ''}`} />
        </Button>
        {selectedFiles.size > 0 && (
          <div className="flex flex-row items-center justify-between gap-2">
            <Button onClick={() => {
              dispatch({ type: "SET_MODAL", modal: "multiprivate", value: true })}}
              variant="outline">
               <EyeOff /> <span className="sr-only lg:not-sr-only"> Make private ({selectedFiles.size} files)</span>
            </Button>
            <Button onClick={() => {
              dispatch({ type: "SET_MODAL", modal: "multipublic", value: true })}}
              variant="outline">
               <Eye /> <span className="sr-only lg:not-sr-only"> Make public ({selectedFiles.size} files)</span>
            </Button>
            <Button onClick={() => {
              dispatch({ type: "SET_MODAL", modal: "multidelete", value: true })}} variant="destructive">
              <Trash2 />  <span className="sr-only lg:not-sr-only">Delete ({selectedFiles.size} files)</span>
            </Button>
          </div>
        )}
      </div>

      {state.loading ? (
        <LoadingSkeleton />
      ) : state.error ? (
        <div className="text-center py-8 text-destructive">
          {state.error}
          <Button variant="ghost" onClick={fetchFiles} className="ml-2">
            Retry
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Showing {state.files.length} of {state.totalFiles} files in {selectedBucket}
          </p>

          {state.view === "grid" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {state.files.map((file) => (
                    <div
                      key={file.id}
                      className={`relative group border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-card ${selectedFiles.has(file.id) ? "border-blue-500" : "border-gray-300"}`}
                    >
                      <div className="h-40 bg-muted/50 flex items-center justify-center">
                        {file.is_public && file.type.startsWith("image/") ? (
                          <img
                            src={file.url}
                            alt={file.filename}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : file.is_public && (file.type.startsWith("video/") || file.filename?.match(/\.(mp4|webm|ogg|mov)$/)) ? (
                          <VideoPlayer url={file.url} id={file.id}  />
                        ) : (
                          <a
                            role="link"
                            className="hover:underliner hover:cursor-pointer flex items-center justify-center"
                            onClick={async () => {
                              const url = await getDownloadUrl(file.id);
                              dispatch({ type: "SET_FIELD", field: "selectedFile", value: file });
                              dispatch({
                                type: "SET_FIELD",
                                field: "previewFile",
                                value: {
                                  url,
                                  id: file.id,
                                  name: file.filename,
                                  is_public: file.is_public,
                                  type: file.type,
                                  uploaded_at: formatDate(file.uploaded_at),
                                  size: formatBytes(file.size),
                                },
                              });
                            }}
                          >
                            <div className="flex flex-col items-center p-4">
                              <FileIcon fileType={file.filename} />
                              <span className="text-sm mt-2 text-center">{file.filename}</span>
                            </div>
                          </a>
                        )}
                      </div>

                      <div className="p-2 bg-background border-t">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium truncate">{file.filename}</span>
                          <div className="flex gap-1 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={async () => {
                                const url = await getDownloadUrl(file.id);
                                if (url) copyToClipboard(url);
                              }}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                dispatch({ type: "SET_FIELD", field: "selectedFile", value: file });
                                dispatch({ type: "SET_MODAL", modal: "privacy", value: true });
                              }}
                            >
                              {file.is_public ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive/80"
                              onClick={() => {
                                dispatch({ type: "SET_FIELD", field: "selectedFile", value: file });
                                dispatch({ type: "SET_MODAL", modal: "delete", value: true });
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(file.size)} • {formatDate(file.uploaded_at)}
                        </p>
                      </div>
                      <div className="absolute top-2 right-2 text-blue-500"
                        onClick={() => toggleFileSelection(file.id)}
                      >
                        {selectedFiles.has(file.id) ? <CheckSquare /> : <Square />}
                      </div>
                    </div>
                  ))}
                </div>
          )}

          {state.view === "compact" && (
                 <div className="flex flex-col gap-2">
                   {state.files.map((file) => (
                     <div
                       key={file.id}
                       className={`flex group justify-between items-center p-3 rounded-lg hover:bg-muted/50 transition-colors ${selectedFiles.has(file.id) ? "border-1 border-blue-500" : "border border-muted"}`}
                     >
                       <div className="flex items-center gap-3 truncate">
                         <div className="w-8 h-8 bg-muted rounded-md flex items-center justify-center mr-2">
                           <button onClick={()=>toggleFileSelection(file.id)}>
                           {selectedFiles.has(file.id) ? <CheckSquare className="text-blue-500" /> : <FileIcon fileType={file.filename}  />}
                           </button>
                         </div>
                         <div className="truncate hover:cursor-pointer"
                             onClick={async () => {
                               const url = await getDownloadUrl(file.id);
                               dispatch({ type: "SET_FIELD", field: "selectedFile", value: file });
                               dispatch({
                                 type: "SET_FIELD",
                                 field: "previewFile",
                                 value: {
                                   url,
                                   id: file.id,
                                   name: file.filename,
                                   is_public: file.is_public,
                                   type: file.type,
                                   uploaded_at: formatDate(file.uploaded_at),
                                   size: formatBytes(file.size),
                                 },
                               });
                             }}
                           >
                           <p className="text-sm font-medium truncate max-w-[200px] sm:max-w-none">
                             {file.filename}
                           </p>
                           <p className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-none">
                             {formatBytes(file.size)} • {formatDate(file.uploaded_at)}
                           </p>
                         </div>
                       </div>
                       <div className="flex gap-1 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                         <Button
                           variant="ghost"
                           size="icon"
                           className="h-8 hover:cursor-pointer w-8"
                           onClick={async () => {
                             const url = await getDownloadUrl(file.id);
                             if (url) copyToClipboard(url);
                           }}
                         >
                           <Copy className="w-4 h-4" />
                         </Button>
                         <Button
                           variant="ghost"
                           size="icon"
                           className="h-8 w-8"
                           onClick={() => {
                             dispatch({ type: "SET_FIELD", field: "selectedFile", value: file });
                             dispatch({ type: "SET_MODAL", modal: "privacy", value: true });
                           }}
                         >
                           {file.is_public ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                         </Button>
                         <Button
                           variant="ghost"
                           size="icon"
                           className="h-8 w-8 text-destructive hover:text-destructive/80"
                           onClick={() => {
                             dispatch({ type: "SET_FIELD", field: "selectedFile", value: file });
                             dispatch({ type: "SET_MODAL", modal: "delete", value: true });
                           }}
                         >
                           <Trash2 className="w-4 h-4" />
                         </Button>
                       </div>
                     </div>
                   ))}
                 </div>
               )}

          {/* List view */}
          {state.view === "list" && (
                      <div className="rounded-md border overflow-x-auto">
                        <Table className="w-full table">
                          <TableHeader>
                            <TableRow>
                              <TableHead>
                                <input
                                  type="checkbox"
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedFiles(new Set(state.files.map((file) => file.id)));
                                    } else {
                                      setSelectedFiles(new Set());
                                    }
                                  }}
                                  checked={selectedFiles.size === state.files.length && state.files.length > 0}
                                />
                              </TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Size</TableHead>
                              <TableHead className="sr-only lg:not-sr-only">Uploaded</TableHead>
                              <TableHead className="sr-only lg:not-sr-only">Visibility</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {state.files.map((file) => (
                              <TableRow key={file.id} className={`${selectedFiles.has(file.id) ? 'border border-x-2 border-y-2 rounded-lg border-blue-500': ''}`}>
                                <TableCell>
                                  <input
                                    type="checkbox"
                                    checked={selectedFiles.has(file.id)}
                                    onChange={() => toggleFileSelection(file.id)}
                                  />
                                </TableCell>
                                <TableCell className="font-medium truncate max-w-[200px] md:max-w-[250px] lg:max-w-[450px]">
                                  {file.filename}
                                </TableCell>
                                <TableCell>{formatBytes(file.size)}</TableCell>
                                <TableCell className="sr-only lg:not-sr-only">{formatDate(file.uploaded_at)}</TableCell>
                                <TableCell className="sr-only lg:not-sr-only text-right">
                                  {file.is_public ? "Public" : "Private"}
                                </TableCell>
                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                        <span className="sr-only">Open menu</span>
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          className="h-4 w-4"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        >
                                          <circle cx="12" cy="12" r="1" />
                                          <circle cx="12" cy="5" r="1" />
                                          <circle cx="12" cy="19" r="1" />
                                        </svg>
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={async () => {
                                          dispatch({ type: "SET_FIELD", field: "selectedFile", value: file });
                                          const url = await getDownloadUrl(file.id);
                                          dispatch({
                                            type: "SET_FIELD",
                                            field: "previewFile",
                                            value: { url, name: file.filename, type: file.type, uploaded_at: formatDate(file.uploaded_at), size: formatBytes(file.size) },
                                          });
                                        }}
                                      >
                                        <Fullscreen className="mr-2 h-4 w-4" />
                                        Preview File
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={async () => {
                                          dispatch({ type: "SET_FIELD", field: "selectedFile", value: file });
                                          const url = await getDownloadUrl(file.id);
                                          if (url) copyToClipboard(url);
                                        }}
                                      >
                                        <Copy className="mr-2 h-4 w-4" />
                                        Copy Link
                                      </DropdownMenuItem>
                                      <DropdownMenuSub>
                                        <DropdownMenuSubTrigger><Share className="mr-2 h-4 w-4" /> Share file</DropdownMenuSubTrigger>
                                        <DropdownMenuPortal>
                                          <DropdownMenuSubContent>
                                            <DropdownMenuItem onClick={async()=> {
                                              dispatch({ type: "SET_FIELD", field: "selectedFile", value: file });
                                              shareFile(1)
                                            }}>1 day</DropdownMenuItem>
                                            <DropdownMenuItem>7 days</DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem>1 month</DropdownMenuItem>
                                            <DropdownMenuItem>6 months</DropdownMenuItem>
                                            <DropdownMenuItem>1 year</DropdownMenuItem>
                                          </DropdownMenuSubContent>
                                        </DropdownMenuPortal>
                                      </DropdownMenuSub>
                                      <DropdownMenuItem
                                        onClick={() => {
                                          dispatch({ type: "SET_FIELD", field: "selectedFile", value: file });
                                          dispatch({ type: "SET_MODAL", modal: "privacy", value: true });
                                        }}
                                      >
                                        {file.is_public ? (
                                          <EyeOff className="mr-2 h-4 w-4" />
                                        ) : (
                                          <Eye className="mr-2 h-4 w-4" />
                                        )}
                                        {file.is_public ? "Make Private" : "Make Public"}
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => {
                                          dispatch({ type: "SET_FIELD", field: "selectedFile", value: file });
                                          dispatch({ type: "SET_MODAL", modal: "delete", value: true });
                                        }}
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))}
                            {state.files.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                  No files found
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
        </>
      )}

      {/* Preview Dialog */}
      {state.previewFile && (
      <FileViewer previewFile={state.previewFile} onClose={() => {
          dispatch({ type: 'SET_FIELD', field: 'selectedFile', value: null });
          dispatch({ type: 'SET_FIELD', field: 'previewFile', value: null });
          }}
      />
      )}

      {/* Modals */}
      <ConfirmModal
        open={state.modals.multidelete}
        onClose={() => dispatch({ type: 'SET_MODAL', modal: 'multidelete', value: false })}
        onConfirm={deleteFiles}
        title="Delete Files"
        description={`Are you sure you want to delete "${selectedFiles.size}" files? This action cannot be undone.`}
        confirmText={state.loading ? "Deleting..." : "Delete"}
        danger
      />

      <ConfirmModal
        open={state.modals.delete}
        onClose={() => dispatch({ type: 'SET_MODAL', modal: 'delete', value: false })}
        onConfirm={deleteFile}
        title="Delete File"
        description={`Are you sure you want to delete "${state.selectedFile?.filename}"? This action cannot be undone.`}
        confirmText={state.loading ? "Deleting..." : "Delete"}
        danger
      />

      <ConfirmModal
        open={state.modals.multipublic}
        onClose={() => dispatch({ type: 'SET_MODAL', modal: 'multipublic', value: false })}
        onConfirm={()=>togglePrivacyForSelected(true)}
        title="Make Files Public"
        description={`Do you want to make ${selectedFiles.size} files public?`}
        confirmText={state.loading ? "Making public..." : "Make public"}
      />

      <ConfirmModal
        open={state.modals.multiprivate}
        onClose={() => dispatch({ type: 'SET_MODAL', modal: 'multiprivate', value: false })}
        onConfirm={()=>togglePrivacyForSelected(false)}
        title="Make private"
        description={`Do you want to make ${selectedFiles.size} files private?`}
        confirmText={state.loading ? "Making..." : "Make private"}
      />

      <ConfirmModal
        open={state.modals.privacy}
        onClose={() => dispatch({ type: 'SET_MODAL', modal: 'privacy', value: false })}
        onConfirm={togglePrivacy}
        title="Change Visibility"
        description={`Make this file ${state.selectedFile?.is_public ? 'private' : 'public'}?`}
        confirmText={state.loading ? "Updating..." : "Confirm"}
      />

      {state.totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <Button
            onClick={() => dispatch({ type: 'SET_FIELD', field: 'page', value: state.page - 1 })}
            disabled={state.page === 1 || state.loading}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {state.page} of {state.totalPages}
          </span>
          <Button
            onClick={() => dispatch({ type: 'SET_FIELD', field: 'page', value: state.page + 1 })}
            disabled={state.page === state.totalPages || state.loading}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
