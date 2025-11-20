"use client";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FileViewer from "@/components/viewer/FileViewer3";
import { isValidBucketId, useBucketStore } from "@/hooks/use-bucket-store";
import { formatBytes } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ArrowDownAZ, ArrowDownNarrowWide, ArrowDownWideNarrow, ArrowDownZA, CalendarDays, CheckSquare, ChevronLeft, ChevronRight, Copy, Edit3, Eye, EyeOff, FileText, FileWarning, Fullscreen, Grid, List, RefreshCw, Share2, Square, Trash2, X } from "lucide-react";
import { useEffect, useReducer, useState } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Skeleton } from "../ui/skeleton";
import { Switch } from "../ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { VideoPlayer } from "../viewer/VideoPlayer";
import { ConfirmModal } from "./ConfirmModal";
import FileIcon from "./FileIcon";
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
    rename: boolean;
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
  | { type: 'RESET' } | { type: 'SET_SELECTED_FILE', payload: any };

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
  modals: { delete: false, rename: false, privacy: false, multidelete: false, multipublic: false, multiprivate: false },
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
    case "SET_SELECTED_FILE":
      return {
        ...state,
        selectedFile: {
          ...state.selectedFile,
          ...action.payload, // Merge the new values into the selected file
        },
      };
    default:
      return state;
  }
}
export default function FileList({ bucketId }: { bucketId?: number }) {
  const { selectedFolderName, selectedFolderId, selectedBucketId } = useBucketStore();
  const [state, dispatch] = useReducer(fileReducer, initialState);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  // const production = process.env.NODE_ENV === 'production';
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

      const response = await fetch(`/api/files/privacy?bucket=${selectedBucketId}`, {
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

      const response = await fetch(`/api/files?bucket=${selectedBucketId}`, {
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
    if (!!selectedFolderId) {
      fetchFiles();
    } else {
      dispatch({ type: 'RESET' });
    }
  }, [selectedFolderId, bucketId, state.sort, state.search, state.page, state.limit]);

  const fetchFiles = async () => {
    try {
      dispatch({ type: 'SET_FIELD', field: 'loading', value: true });
      dispatch({ type: 'SET_FIELD', field: 'error', value: null });

      const res = await fetch(
        `/api/files?folderId=${selectedFolderId}&sort=${state.sort}&search=${state.search}&page=${state.page}&limit=${state.limit}${bucketId !== undefined && isValidBucketId(bucketId) ? `&bucketId=${bucketId}` : ''}`, {
        // cache: 'no-store',
      }
      );

      if (!res.ok) toast.error('Failed to fetch files... Kindly refresh!');

      const data = await res.json();
      const publicFilesWithUrls = data.files.map((file: any) => ({
        ...file,
        url: `https://s3.tebi.io/${file.bucket}/${file.key}`,
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

      const response = await fetch(`/api/files?bucket=${selectedBucketId}`, {
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


  const handleShare = async (file: any, duration: number) => {
    try {
      const response = await fetch(`/api/files/share?bucket=${selectedBucketId}`, {
        method: "POST",
        body: JSON.stringify({ fileId: file.id, duration })
      });

      const { url, error } = await response.json();
      if (error || !url) {
        toast.error(error || 'Failed to generate shared URL');
        return;
      }

      toast.success(`${file.filename} has been shared`, { description: url });
      navigator.clipboard.writeText(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to share file');
    }
  };

  const updateFile = async ({ id, rename, liked }: { id: number, rename?: string, liked?: boolean }) => {
    const url = `/api/files/edit?bucket=${selectedBucketId}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: id,
          ...(rename && { rename }),
          ...(typeof liked === 'boolean' && { liked })
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to update file');
      }
      if (!!rename) {
        toast.success('File has been renamed!')
      } else {
        toast.success(liked ? 'Liked!' : 'Unliked!');
      }
    } catch (error) {
      console.error('Update failed:', error);
      toast.error('Failed to update file');
    } finally {
      fetchFiles();
    }
  }

  const togglePrivacy = async () => {
    if (!state.selectedFile) return;

    try {
      dispatch({ type: "SET_FIELD", field: "loading", value: true });

      const response = await fetch(`/api/files/privacy?bucket=${selectedBucketId}`, {
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
      const res = await fetch(`/api/files/url?bucket=${selectedBucketId}&fileId=${id}&expiresIn=7200`);
      const { url, error } = await res.json();
      if (error) toast.error(error);
      return url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to get download URL');
      return null;
    }
  };

  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {Array.from({ length: state.limit }).map((_, i) => (
        <Skeleton key={i} className="h-[26px] min-w-[93vw] md:min-w-xl lg:min-w-2xl w-full rounded-lg" />
      ))}
    </div>
  );

  const form = useForm();
  return (
    <div className="space-y-4 p-1 w-full">
      {/* Header Controls */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-xl border-b p-1">
        <div className="relative w-full md:max-w-[400px]">
          <Input
            placeholder="Search files..."
            value={state.search}
            onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'search', value: e.target.value })}
            className="pl-10 bg-muted/50 border-transparent focus:bg-background transition-all"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
          <Select
            value={state.sort}
            onValueChange={(val) => dispatch({ type: 'SET_FIELD', field: 'sort', value: val })}
          >
            <SelectTrigger className="w-[160px] bg-muted/50 border-transparent focus:bg-background">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="uploaded_at_desc">Newest First</SelectItem>
              <SelectItem value="uploaded_at_asc">Oldest First</SelectItem>
              <SelectItem value="name_asc">Name (A-Z)</SelectItem>
              <SelectItem value="name_desc">Name (Z-A)</SelectItem>
              <SelectItem value="size_asc">Size (Smallest)</SelectItem>
              <SelectItem value="size_desc">Size (Largest)</SelectItem>
            </SelectContent>
          </Select>

          <div className="h-8 w-px bg-border mx-1" />

          <div className="flex bg-muted/50 p-1 rounded-lg border border-transparent">
            {(["list", "grid", "compact"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => dispatch({ type: 'SET_FIELD', field: 'view', value: mode })}
                className={`p-2 rounded-md transition-all ${state.view === mode
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                {mode === "list" ? <List className="w-4 h-4" /> :
                  mode === "grid" ? <Grid className="w-4 h-4" /> :
                    <FileText className="w-4 h-4" />}
              </button>
            ))}
          </div>

          <Button
            size="icon"
            variant="ghost"
            onClick={fetchFiles}
            className="hover:bg-muted/50"
          >
            <RefreshCw className={`w-4 h-4 ${state.loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {state.loading ? (
        <>
          <p className="text-sm h-6 rounded-lg w-1/2 text-muted-foreground">
            Loading files...
          </p>

          <LoadingSkeleton />
        </>
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
            Showing {state.files.length} of {state.totalFiles} files in {selectedFolderName}
          </p>

          {state.view === "grid" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {state.files.map((file) => (
                <div
                  key={file.id}
                  className={`group relative flex flex-col bg-card border rounded-xl overflow-hidden transition-all duration-300 ${selectedFiles.has(file.id)
                    ? "ring-2 ring-primary border-transparent shadow-md"
                    : "border-border/50 hover:border-border hover:shadow-lg hover:-translate-y-1"
                    }`}
                >
                  {/* Selection Checkbox */}
                  <div
                    className={`absolute top-2 left-2 z-20 transition-opacity duration-200 ${selectedFiles.has(file.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFileSelection(file.id);
                    }}
                  >
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer ${selectedFiles.has(file.id) ? "bg-primary border-primary text-primary-foreground" : "bg-background/80 backdrop-blur border-muted-foreground/30 hover:border-primary"
                      }`}>
                      {selectedFiles.has(file.id) && <CheckSquare className="w-3.5 h-3.5" />}
                    </div>
                  </div>

                  {/* Preview Area */}
                  <div className="aspect-[4/3] bg-muted/30 relative overflow-hidden group-hover:bg-muted/50 transition-colors">
                    {file.is_public && file.type.startsWith("image/") ? (
                      <img
                        src={file.url}
                        alt={file.filename}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : file.is_public && (file.type.startsWith("video/") || file.filename?.match(/\.(mp4|webm|ogg|mov)$/)) ? (
                      <div className="w-full h-full">
                        <VideoPlayer url={file.url} id={file.id} />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-6">
                        <FileIcon fileType={file.filename} />
                      </div>
                    )}

                    {/* Overlay Actions */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[1px]">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 rounded-full bg-white/90 hover:bg-white text-black shadow-sm"
                        onClick={() => {
                          dispatch({ type: "SET_FIELD", field: "selectedFile", value: file });
                          dispatch({
                            type: "SET_FIELD",
                            field: "previewFile",
                            value: {
                              url: file.url,
                              id: file.id,
                              name: file.filename,
                              is_public: file.is_public,
                              type: file.type,
                              uploaded_at: formatDistanceToNow(new Date(file?.uploaded_at), { addSuffix: true }),
                              size: formatBytes(file.size),
                            },
                          });
                        }}
                      >
                        <Fullscreen className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 rounded-full bg-white/90 hover:bg-white text-black shadow-sm"
                        onClick={async () => {
                          const url = await getDownloadUrl(file.id);
                          if (url) copyToClipboard(url);
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Footer Info */}
                  <div className="p-3 flex flex-col gap-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium truncate leading-tight" title={file.filename}>
                        {file.filename}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 text-muted-foreground hover:text-foreground">
                            <span className="sr-only">Menu</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            dispatch({ type: "SET_FIELD", field: "selectedFile", value: file });
                            dispatch({ type: "SET_MODAL", modal: "rename", value: true });
                          }}>
                            <Edit3 className="mr-2 h-4 w-4" /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => {
                            dispatch({ type: "SET_FIELD", field: "selectedFile", value: file });
                            dispatch({ type: "SET_MODAL", modal: "delete", value: true });
                          }}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatBytes(file.size)}</span>
                      <span>{formatDistanceToNow(new Date(file?.uploaded_at))}</span>
                    </div>
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
                      <button onClick={() => toggleFileSelection(file.id)}>
                        {selectedFiles.has(file.id) ? <CheckSquare className="text-blue-500" /> : <FileIcon fileType={file.filename} />}
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
                            uploaded_at: formatDistanceToNow(new Date(file?.uploaded_at), { addSuffix: true }),
                            size: formatBytes(file.size),
                          },
                        });
                      }}
                    >
                      <p className="text-sm font-medium truncate max-w-[200px] sm:max-w-none">
                        {file.filename}
                      </p>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-none">
                        {formatBytes(file.size)} • {formatDistanceToNow(new Date(file?.uploaded_at), { addSuffix: true })}
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
            <div className="rounded-xl border shadow-sm bg-card overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent border-b border-border/50">
                    <TableHead className="w-[50px]">
                      <div className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedFiles(new Set(state.files.map((file) => file.id)));
                            } else {
                              setSelectedFiles(new Set());
                            }
                          }}
                          checked={selectedFiles.size === state.files.length && state.files.length > 0}
                        />
                      </div>
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-[100px]">Size</TableHead>
                    <TableHead className="hidden md:table-cell w-[150px]">Uploaded</TableHead>
                    <TableHead className="hidden md:table-cell w-[100px]">Visibility</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.files.map((file) => (
                    <TableRow
                      key={file.id}
                      className={`group transition-colors ${selectedFiles.has(file.id)
                        ? 'bg-primary/5 hover:bg-primary/10'
                        : 'hover:bg-muted/50'
                        }`}
                    >
                      <TableCell>
                        <div className="flex items-center justify-center">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                            checked={selectedFiles.has(file.id)}
                            onChange={() => toggleFileSelection(file.id)}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-muted/50 rounded-lg">
                            <FileIcon fileType={file.filename} />
                          </div>
                          <div className="flex flex-col">
                            <span
                              className="truncate max-w-[200px] md:max-w-[300px] lg:max-w-[400px] cursor-pointer hover:text-primary transition-colors"
                              onClick={() => {
                                dispatch({ type: "SET_FIELD", field: "selectedFile", value: file });
                                dispatch({
                                  type: "SET_FIELD",
                                  field: "previewFile",
                                  value: {
                                    url: file.url,
                                    id: file.id,
                                    name: file.filename,
                                    is_public: file.is_public,
                                    type: file.type,
                                    uploaded_at: formatDistanceToNow(new Date(file?.uploaded_at), { addSuffix: true }),
                                    size: formatBytes(file.size),
                                  },
                                });
                              }}
                            >
                              {file.filename}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{formatBytes(file.size)}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                        {formatDistanceToNow(new Date(file?.uploaded_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${file.is_public ? "bg-green-50 text-green-700 ring-1 ring-green-600/20" : "bg-gray-100 text-gray-700 ring-1 ring-gray-600/20"
                          }`}>
                          {file.is_public ? "Public" : "Private"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
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
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              onClick={async () => {
                                dispatch({ type: "SET_FIELD", field: "selectedFile", value: file });
                                const url = await getDownloadUrl(file.id);
                                dispatch({
                                  type: "SET_FIELD",
                                  field: "previewFile",
                                  value: { url, name: file.filename, type: file.type, uploaded_at: formatDistanceToNow(new Date(file?.uploaded_at), { addSuffix: true }), size: formatBytes(file.size) },
                                });
                              }}
                            >
                              <Fullscreen className="mr-2 h-4 w-4" />
                              Preview File
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                dispatch({ type: "SET_FIELD", field: "selectedFile", value: file });
                                dispatch({ type: "SET_MODAL", modal: "rename", value: true });
                              }}
                            >
                              <Edit3 className="mr-2 h-4 w-4" />  Rename
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
                              <DropdownMenuSubTrigger>
                                <span className="flex flex-row items-center">
                                  <Share2 className="mr-2 h-4 w-4" />
                                  Share File
                                </span>
                              </DropdownMenuSubTrigger>
                              <DropdownMenuPortal>
                                <DropdownMenuSubContent>
                                  {[1, 7, 30, 180, 365].map((days) => (
                                    <DropdownMenuItem
                                      key={days}
                                      onClick={() => toast.promise(handleShare(file, days), {
                                        loading: "Generating share link...",
                                        success: "Link copied to clipboard",
                                        error: "Failed to share link",
                                      })}
                                    >
                                      {days === 1 ? "1 day" : days === 7 ? "7 days" : days === 30 ? "1 month" : days === 180 ? "6 months" : "1 year"}
                                    </DropdownMenuItem>
                                  ))}
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
                              className="text-red-500"
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
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                          <FileWarning className="w-12 h-12 mb-2" />
                          <p className="text-lg font-medium">No files found</p>
                          <p className="text-sm">Upload some files to get started.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Pagination & Limit */}
      {state.files.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 mt-4 border-t">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Rows per page</p>
            <Select
              value={state.limit.toString()}
              onValueChange={(val) => dispatch({ type: 'SET_FIELD', field: 'limit', value: parseInt(val) })}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={state.limit} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex w-[100px] items-center justify-center text-sm font-medium">
              Page {state.page} of {state.totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => dispatch({ type: 'SET_FIELD', field: 'page', value: state.page - 1 })}
                disabled={state.page === 1 || state.loading}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => dispatch({ type: 'SET_FIELD', field: 'page', value: state.page + 1 })}
                disabled={state.page === state.totalPages || state.loading}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Selection Bar */}
      {selectedFiles.size > 0 && typeof document !== 'undefined' && createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-background px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 z-[100] animate-in slide-in-from-bottom-10 fade-in duration-300 border border-border/20">
          <div className="flex items-center gap-3">
            <div className="bg-background/20 p-1 rounded-full">
              <CheckSquare className="w-4 h-4" />
            </div>
            <span className="font-medium text-sm">{selectedFiles.size} selected</span>
          </div>

          <div className="h-4 w-px bg-background/20" />

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 hover:bg-background/20 hover:text-background text-background/80"
              onClick={() => dispatch({ type: "SET_MODAL", modal: "multiprivate", value: true })}
            >
              <EyeOff className="w-4 h-4 mr-2" /> Private
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 hover:bg-background/20 hover:text-background text-background/80"
              onClick={() => dispatch({ type: "SET_MODAL", modal: "multipublic", value: true })}
            >
              <Eye className="w-4 h-4 mr-2" /> Public
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 hover:bg-red-500/20 hover:text-red-400 text-red-400"
              onClick={() => dispatch({ type: "SET_MODAL", modal: "multidelete", value: true })}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 hover:bg-background/20 hover:text-background text-background/80 rounded-full ml-2"
              onClick={() => setSelectedFiles(new Set())}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>,
        document.body
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
      {state.modals.multidelete && (
        <ConfirmModal
          open={state.modals.multidelete}
          onClose={() => dispatch({ type: "SET_MODAL", modal: "multidelete", value: false })}
          onConfirm={deleteFiles}
          title="Delete Files"
          description={`Are you sure you want to delete ${selectedFiles.size} files? This action cannot be undone.`}
          confirmText={`Delete ${selectedFiles.size} Files`}
          danger
        />
      )}

      {state.modals.delete && (
        <ConfirmModal
          open={state.modals.delete}
          onClose={() => dispatch({ type: "SET_MODAL", modal: "delete", value: false })}
          onConfirm={deleteFile}
          title="Delete File"
          description={`Are you sure you want to delete "${state.selectedFile?.filename}"? This action cannot be undone.`}
          confirmText="Delete"
          danger
        />
      )}

      {state.modals.multipublic && (
        <ConfirmModal
          open={state.modals.multipublic}
          onClose={() => dispatch({ type: "SET_MODAL", modal: "multipublic", value: false })}
          onConfirm={() => togglePrivacyForSelected(true)}
          title="Make Public"
          description={`Are you sure you want to make ${selectedFiles.size} files public? Anyone with the link will be able to view them.`}
          confirmText="Make Public"
        />
      )}

      {state.modals.multiprivate && (
        <ConfirmModal
          open={state.modals.multiprivate}
          onClose={() => dispatch({ type: "SET_MODAL", modal: "multiprivate", value: false })}
          onConfirm={() => togglePrivacyForSelected(false)}
          title="Make Private"
          description={`Are you sure you want to make ${selectedFiles.size} files private? Only you will be able to view them.`}
          confirmText="Make Private"
        />
      )}

      {state.modals.privacy && (
        <ConfirmModal
          open={state.modals.privacy}
          onClose={() => dispatch({ type: "SET_MODAL", modal: "privacy", value: false })}
          onConfirm={togglePrivacy}
          title={state.selectedFile?.is_public ? "Make Private" : "Make Public"}
          description={`Are you sure you want to make "${state.selectedFile?.filename}" ${state.selectedFile?.is_public ? "private" : "public"}?`}
          confirmText={state.selectedFile?.is_public ? "Make Private" : "Make Public"}
        />
      )}

      {state.modals.rename && (
        <Dialog open={state.modals.rename} onOpenChange={(val) => dispatch({ type: "SET_MODAL", modal: "rename", value: val })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename File</DialogTitle>
              <DialogDescription>
                Enter a new name for "{state.selectedFile?.filename}"
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const newName = formData.get("name") as string;
                if (newName && newName !== state.selectedFile?.filename) {
                  updateFile({ id: state.selectedFile.id, rename: newName });
                  dispatch({ type: "SET_MODAL", modal: "rename", value: false });
                }
              }}
              className="space-y-4"
            >
              <Input
                name="name"
                defaultValue={state.selectedFile?.filename}
                placeholder="Enter file name"
                autoFocus
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => dispatch({ type: "SET_MODAL", modal: "rename", value: false })}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}


    </div>
  );
}
