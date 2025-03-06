"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBucketStore } from "@/hooks/use-bucket-store";
import { formatBytes, formatDate } from "@/lib/utils";
import { ArrowDownAZ, ArrowDownNarrowWide, ArrowDownWideNarrow, ArrowDownZA, CalendarDays, Copy, Eye, EyeOff, FileText, Fullscreen, Grid, List, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useReducer } from "react";
import { toast } from "sonner";
import { ConfirmModal } from "./ConfirmModal";
import FileIcon from "./FileIcon";
import FileViewer from "./FileViewer3";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Skeleton } from "./ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

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
  sort: 'name_asc',
  search: '',
  page: 1,
  limit: 10,
  totalPages: 1,
  totalFiles: 0,
  view: 'list',
  selectedFile: null,
  previewFile: null,
  modals: { delete: false, privacy: false },
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
          cache: 'no-store',
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
      dispatch({ type: 'SET_FIELD', field: 'loading', value: true });

      const response = await fetch(`/api/files?bucket=${selectedBucket}`, {
        method: "DELETE",
        body: JSON.stringify({ fileId: state.selectedFile.id })
      });

      const { message, error } = await response.json();
      if (error) toast.error(error);

      toast.success(message);
      fetchFiles();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete file');
    } finally {
      dispatch({ type: 'SET_MODAL', modal: 'delete', value: false });
      dispatch({ type: 'SET_FIELD', field: 'loading', value: false });
    }
  };

  const togglePrivacy = async () => {
    if (!state.selectedFile) return;
    try {
      dispatch({ type: 'SET_FIELD', field: 'loading', value: true });

      const response = await fetch(`/api/files/privacy?bucket=${selectedBucket}`, {
        method: "PATCH",
        body: JSON.stringify({
          fileId: state.selectedFile.id,
          isPublic: !state.selectedFile.is_public
        }),
      });

      const { message, error } = await response.json();
      if (error) toast.error(error);

      toast.success(message);
      fetchFiles();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update privacy');
    } finally {
      dispatch({ type: 'SET_MODAL', modal: 'privacy', value: false });
      dispatch({ type: 'SET_FIELD', field: 'loading', value: false });
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
      return url;
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
                  className="relative group border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-card"
                >
                  <div className="h-40 bg-muted/50 flex items-center justify-center">
                    {file.is_public && file.type.startsWith("image/") ? (
                      <img
                        src={file.url}
                        alt={file.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : file.is_public && file.type.startsWith("video/") ? (
                      <video src={file.url} controls className="w-full h-full object-cover" />
                    ) : (
                      <a role="link" className="hover:underliner hover:cursor-pointer flex items-center justify-center" onClick={async () => {
                        const url = await getDownloadUrl(file.id);
                        dispatch({ type: 'SET_FIELD', field: 'selectedFile', value: file });
                        dispatch({ type: 'SET_FIELD', field: 'previewFile', value: { url, name: file.filename, is_public: file.is_public, type: file.type, uploaded_at: formatDate(file.uploaded_at), size: formatBytes(file.size) } });
                      }}>
                      <div className="flex flex-col items-center p-4">
                        <FileIcon fileType={file.filename} />
                        <span className="text-sm mt-2 text-center">{file.filename}</span>
                      </div>
                      </a>
                    )}
                  </div>

                  <div className="p-2 bg-background border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium truncate">
                        {file.filename}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                            dispatch({ type: 'SET_FIELD', field: 'selectedFile', value: file });
                            dispatch({ type: 'SET_MODAL', modal: 'privacy', value: true });
                          }}
                        >
                          {file.is_public ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive/80"
                          onClick={() => {
                            dispatch({ type: 'SET_FIELD', field: 'selectedFile', value: file });
                            dispatch({ type: 'SET_MODAL', modal: 'delete', value: true });
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
                </div>
              ))}
            </div>
          )}

          {state.view === "compact" && (
            <div className="flex flex-col gap-2">
              {state.files.map((file) => (
                <div
                  key={file.id}
                  className="flex group justify-between items-center p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 truncate">
                    <a role="link" className="hover:underliner hover:cursor-pointer flex items-center justify-center" onClick={async () => {
                      const url = await getDownloadUrl(file.id);
                      dispatch({ type: 'SET_FIELD', field: 'selectedFile', value: file });
                      dispatch({ type: 'SET_FIELD', field: 'previewFile', value: { url, name: file.filename, type: file.type, uploaded_at: formatDate(file.uploaded_at), size: formatBytes(file.size) } });
                    }}>
                    <div className="w-8 h-8 bg-muted rounded-md flex items-center justify-center mr-2">
                      <FileIcon fileType={file.filename} />
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-medium truncate max-w-[150px] sm:max-w-none">
                        {file.filename}
                      </p>
                      <p className="text-xs text-muted-foreground truncate max-w-[180px] sm:max-w-none">
                        {formatBytes(file.size)} • {formatDate(file.uploaded_at)}
                      </p>
                    </div>
                    </a>
                  </div>

                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                        dispatch({ type: 'SET_FIELD', field: 'selectedFile', value: file });
                        dispatch({ type: 'SET_MODAL', modal: 'privacy', value: true });
                      }}
                    >
                      {file.is_public ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive/80"
                      onClick={() => {
                        dispatch({ type: 'SET_FIELD', field: 'selectedFile', value: file });
                        dispatch({ type: 'SET_MODAL', modal: 'delete', value: true });
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {state.view === "list" && (
            <div className="rounded-md border overflow-x-auto">
              <Table className="w-full table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead className="sr-only lg:not-sr-only">Uploaded</TableHead>
                    <TableHead className="sr-only lg:not-sr-only">Visibility</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.files.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell className="font-medium truncate max-w-[180px] md:max-w-[250px] lg:max-w-[450px]">
                        {file.filename}
                      </TableCell>
                      <TableCell>{formatBytes(file.size)}</TableCell>
                      <TableCell className="sr-only lg:not-sr-only">{formatDate(file.uploaded_at)}</TableCell>
                      <TableCell className="sr-only lg:not-sr-only">
                        {file.is_public ? 'Public' : 'Private'}
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
                                const url = await getDownloadUrl(file.id);
                                dispatch({ type: 'SET_FIELD', field: 'selectedFile', value: file });
                                dispatch({ type: 'SET_FIELD', field: 'previewFile', value: { url, name: file.filename, type: file.type, uploaded_at: formatDate(file.uploaded_at), size: formatBytes(file.size) } });
                              }}
                            >
                              <Fullscreen className="mr-2 h-4 w-4" />
                              Preview File
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                const url = await getDownloadUrl(file.id);
                                if (url) copyToClipboard(url);
                              }}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              Copy Link
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                dispatch({ type: 'SET_FIELD', field: 'selectedFile', value: file });
                                dispatch({ type: 'SET_MODAL', modal: 'privacy', value: true });
                              }}
                            >
                              {file.is_public ? (
                                <EyeOff className="mr-2 h-4 w-4" />
                              ) : (
                                <Eye className="mr-2 h-4 w-4" />
                              )}
                              {file.is_public ? 'Make Private' : 'Make Public'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                dispatch({ type: 'SET_FIELD', field: 'selectedFile', value: file });
                                dispatch({ type: 'SET_MODAL', modal: 'delete', value: true });
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
                      <TableCell colSpan={5} className="h-24 text-center">
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
        open={state.modals.delete}
        onClose={() => dispatch({ type: 'SET_MODAL', modal: 'delete', value: false })}
        onConfirm={deleteFile}
        title="Delete File"
        description={`Are you sure you want to delete "${state.selectedFile?.filename}"? This action cannot be undone.`}
        confirmText={state.loading ? "Deleting..." : "Delete"}
        danger
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
