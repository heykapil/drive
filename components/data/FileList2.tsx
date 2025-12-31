"use client";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FileViewer from "@/components/viewer/FileViewer3";
import { isValidBucketId, useBucketStore } from "@/hooks/use-bucket-store";
import { formatBytes } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { CheckSquare, ChevronLeft, ChevronRight, Eye, EyeOff, FileText, Grid, List, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useReducer, useState } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Skeleton } from "../ui/skeleton";
import { fileReducer, initialState } from "./helpers/file-reducer";
import { useFileUrlCache } from "./helpers/use-url-cache";
import { ConfirmModal } from "./ConfirmModal";
import { FileCompactView } from "./views/FileCompactView";
import { FileGridView } from "./views/FileGridView";
import { FileListView } from "./views/FileListView";
import { FileActions } from "./views/types";

export default function FileList({ bucketId }: { bucketId?: string }) {
  const { selectedFolderName, selectedFolderId, selectedUniqueId: selectedBucketId } = useBucketStore();
  const { getPreviewUrl, getDownloadUrl } = useFileUrlCache(selectedBucketId);
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
        url: file.bucketType === 'TB'
          ? null // Terabox files don't have a direct static public URL like S3
          : `https://s3.tebi.io/${file.bucket}/${file.key}`,
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
      if (!text) {
        toast.error('No link to copy');
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.success("Link copied to clipboard!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to copy link');
    }
  };

  const handlePreview = async (file: any) => {
    dispatch({ type: "SET_FIELD", field: "selectedFile", value: file });
    const url = await getPreviewUrl(file)
    dispatch({
      type: "SET_FIELD",
      field: "previewFile",
      value: {
        url: url,
        id: file.id,
        name: file.filename,
        is_public: file.is_public,
        type: file.type,
        uploaded_at: formatDistanceToNow(new Date(file?.uploaded_at), { addSuffix: true }),
        size: formatBytes(file.size),
        thumbnail: file.thumbnail,
      },
    });
  };

  const handleDownload = async (file: any) => {
    dispatch({ type: "SET_FIELD", field: "selectedFile", value: file });
    const url = await getDownloadUrl(file.id)
    dispatch({
      type: "SET_FIELD",
      field: "previewFile",
      value: {
        url: url,
        id: file.id,
        name: file.filename,
        is_public: file.is_public,
        type: file.type,
        uploaded_at: formatDistanceToNow(new Date(file?.uploaded_at), { addSuffix: true }),
        size: formatBytes(file.size),
        thumbnail: file.thumbnail,
      },
    });
  };

  const handleCopyLink = async (file: any) => {
    const url = await getDownloadUrl(file.id);
    if (url) copyToClipboard(url);
  };

  const actions: FileActions = {
    onPreview: handlePreview,
    onDownload: handleDownload,
    onRename: (file) => {
      dispatch({ type: "SET_FIELD", field: "selectedFile", value: file });
      dispatch({ type: "SET_MODAL", modal: "rename", value: true });
    },
    onDelete: (file) => {
      dispatch({ type: "SET_FIELD", field: "selectedFile", value: file });
      dispatch({ type: "SET_MODAL", modal: "delete", value: true });
    },
    onShare: handleShare,
    onTogglePrivacy: (file) => {
      dispatch({ type: "SET_FIELD", field: "selectedFile", value: file });
      dispatch({ type: "SET_MODAL", modal: "privacy", value: true });
    },
    onCopyLink: handleCopyLink,
    onToggleSelection: toggleFileSelection,
    onSelectAll: () => setSelectedFiles(new Set(state.files.map((file) => file.id))),
    onClearSelection: () => setSelectedFiles(new Set()),
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
            <FileGridView
              files={state.files}
              selectedFiles={selectedFiles}
              actions={actions}
            />
          )}

          {state.view === "compact" && (
            <FileCompactView
              files={state.files}
              selectedFiles={selectedFiles}
              actions={actions}
            />
          )}

          {/* List view */}
          {state.view === "list" && (
            <FileListView
              files={state.files}
              selectedFiles={selectedFiles}
              actions={actions}
            />
          )}
        </>
      )}

      {/* Pagination & Limit */}
      {
        state.files.length > 0 && (
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
        )
      }

      {/* Floating Selection Bar */}
      {
        selectedFiles.size > 0 && typeof document !== 'undefined' && createPortal(
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-background px-4 py-3 rounded-full shadow-2xl flex items-center gap-4 z-[100] animate-in slide-in-from-bottom-10 fade-in duration-300 border border-border/20 max-w-[95vw] overflow-x-auto no-scrollbar">
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
                className="h-8 hover:bg-background/20 hover:text-background text-background/80 px-2 sm:px-4"
                onClick={() => dispatch({ type: "SET_MODAL", modal: "multiprivate", value: true })}
              >
                <EyeOff className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Private</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 hover:bg-background/20 hover:text-background text-background/80 px-2 sm:px-4"
                onClick={() => dispatch({ type: "SET_MODAL", modal: "multipublic", value: true })}
              >
                <Eye className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Public</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 hover:bg-red-500/20 hover:text-red-400 text-red-400 px-2 sm:px-4"
                onClick={() => dispatch({ type: "SET_MODAL", modal: "multidelete", value: true })}
              >
                <Trash2 className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Delete</span>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 hover:bg-background/20 hover:text-background text-background/80 rounded-full ml-auto"
                onClick={() => setSelectedFiles(new Set())}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>,
          document.body
        )
      }

      {/* Preview Dialog */}
      {
        state.previewFile && (
          <FileViewer previewFile={state.previewFile} onClose={() => {
            dispatch({ type: 'SET_FIELD', field: 'selectedFile', value: null });
            dispatch({ type: 'SET_FIELD', field: 'previewFile', value: null });
          }}
          />
        )
      }

      {/* Modals */}
      {
        state.modals.multidelete && (
          <ConfirmModal
            open={state.modals.multidelete}
            onClose={() => dispatch({ type: "SET_MODAL", modal: "multidelete", value: false })}
            onConfirm={deleteFiles}
            title="Delete Files"
            description={`Are you sure you want to delete ${selectedFiles.size} files? This action cannot be undone.`}
            confirmText={`Delete ${selectedFiles.size} Files`}
            danger
          />
        )
      }

      {
        state.modals.delete && (
          <ConfirmModal
            open={state.modals.delete}
            onClose={() => dispatch({ type: "SET_MODAL", modal: "delete", value: false })}
            onConfirm={deleteFile}
            title="Delete File"
            description={`Are you sure you want to delete "${state.selectedFile?.filename}"? This action cannot be undone.`}
            confirmText="Delete"
            danger
          />
        )
      }

      {
        state.modals.multipublic && (
          <ConfirmModal
            open={state.modals.multipublic}
            onClose={() => dispatch({ type: "SET_MODAL", modal: "multipublic", value: false })}
            onConfirm={() => togglePrivacyForSelected(true)}
            title="Make Public"
            description={`Are you sure you want to make ${selectedFiles.size} files public? Anyone with the link will be able to view them.`}
            confirmText="Make Public"
          />
        )
      }

      {
        state.modals.multiprivate && (
          <ConfirmModal
            open={state.modals.multiprivate}
            onClose={() => dispatch({ type: "SET_MODAL", modal: "multiprivate", value: false })}
            onConfirm={() => togglePrivacyForSelected(false)}
            title="Make Private"
            description={`Are you sure you want to make ${selectedFiles.size} files private? Only you will be able to view them.`}
            confirmText="Make Private"
          />
        )
      }

      {
        state.modals.privacy && (
          <ConfirmModal
            open={state.modals.privacy}
            onClose={() => dispatch({ type: "SET_MODAL", modal: "privacy", value: false })}
            onConfirm={togglePrivacy}
            title={state.selectedFile?.is_public ? "Make Private" : "Make Public"}
            description={`Are you sure you want to make "${state.selectedFile?.filename}" ${state.selectedFile?.is_public ? "private" : "public"}?`}
            confirmText={state.selectedFile?.is_public ? "Make Private" : "Make Public"}
          />
        )
      }

      {
        state.modals.rename && (
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
        )
      }


    </div >
  );
}
