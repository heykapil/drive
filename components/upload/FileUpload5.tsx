import { getUploadToken } from "@/lib/actions/auth-token";
import { useBucketStore } from "@/hooks/use-bucket-store";
import { runPromisePool } from "@/lib/helpers/promise-pool";
import { cn, getFileType, getFileTypeFromFilename } from "@/lib/utils";
import axios from "axios";
import { Loader2, Trash2, UploadCloudIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { BucketSelector } from "../bucket-selector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { FileRow2 } from "./FileRow2";
import { Button } from "../ui/button";

// Unique ID Generator
const generateId = () => Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

interface FileWrapper {
    id: string;
    file: File;
}

interface FileState {
    files: FileWrapper[];
    uploadingFiles: Record<string, boolean>;
    uploadProgress: Record<string, number>;
    uploadStatus: Record<string, string>;
    errors: Record<string, string | null>;
    completed: Record<string, boolean>;
}

export function FileUpload5({
    testS3ConnectionAction,
}: {
    testS3ConnectionAction: (bucketIds: number | number[]) => Promise<any>,
}) {
    const { selectedUniqueId: selectedBucketId, isLoading } = useBucketStore();

    const [state, setState] = useState<FileState>({
        files: [],
        uploadingFiles: {},
        uploadProgress: {},
        uploadStatus: {},
        errors: {},
        completed: {},
    });

    const [maxConcurrentFiles, setMaxConcurrentFiles] = useState<number>(1);
    const abortControllers = useRef<Record<string, AbortController>>({});

    // --- Handlers ---

    const removeFile = (id: string) => {
        if (abortControllers.current[id]) {
            abortControllers.current[id].abort();
            delete abortControllers.current[id];
        }

        setState((prev) => {
            const newFiles = prev.files.filter(f => f.id !== id);
            const cleanMap = <T,>(map: Record<string, T>) => {
                const newMap = { ...map };
                delete newMap[id];
                return newMap;
            };

            return {
                ...prev,
                files: newFiles,
                uploadProgress: cleanMap(prev.uploadProgress),
                uploadStatus: cleanMap(prev.uploadStatus),
                uploadingFiles: cleanMap(prev.uploadingFiles),
                errors: cleanMap(prev.errors),
                completed: cleanMap(prev.completed),
            };
        });
    };

    const onDrop = (acceptedFiles: File[]) => {
        setState((prev) => {
            const newWrappers = acceptedFiles.map(f => ({
                id: generateId(),
                file: f
            }));
            return {
                ...prev,
                files: [...prev.files, ...newWrappers],
            };
        });
    };

    const { getRootProps, getInputProps } = useDropzone({ onDrop, multiple: true });

    // Handle Paste
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (!e.clipboardData) return;
            const files: File[] = [];
            for (const item of e.clipboardData.items) {
                if (item.kind === "file") {
                    const f = item.getAsFile();
                    if (f) files.push(f);
                }
            }
            if (files.length > 0) {
                e.preventDefault();
                onDrop(files);
            }
        };
        window.addEventListener("paste", handlePaste);
        return () => window.removeEventListener("paste", handlePaste);
    }, []);


    // --- Upload Logic ---

    const startUploadProcess = async () => {
        if (!selectedBucketId) {
            toast.error("Please select a bucket first.");
            return;
        }
        uploadFiles();
    };

    const uploadFiles = async () => {
        const tasks = state.files.map((wrapper) => async () => {
            if (state.uploadingFiles[wrapper.id] || state.completed[wrapper.id]) return;

            const { id, file } = wrapper;

            setState(prev => ({
                ...prev,
                uploadingFiles: { ...prev.uploadingFiles, [id]: true },
                errors: { ...prev.errors, [id]: null },
                completed: { ...prev.completed, [id]: false }
            }));

            updateStatus(id, "Starting...");

            const controller = new AbortController();
            abortControllers.current[id] = controller;

            try {
                // Determine provider and call appropriate client
                let promise;
                const onProgress = (percent: number) => {
                    setState(prev => ({
                        ...prev,
                        uploadProgress: { ...prev.uploadProgress, [id]: percent }
                    }));
                    updateStatus(id, `Uploading ${percent}%`);
                };

                if (selectedBucketId?.startsWith('tb_')) {
                    const bucketId = parseInt(selectedBucketId.replace('tb_', ''), 10);
                    const { localUpload } = await import('@/lib/terabox-client');
                    promise = localUpload({
                        file,
                        bucket_id: bucketId,
                        remote_dir: '/uploads',
                        onProgress,
                        signal: controller.signal
                    });
                } else {
                    // Default to S3
                    let bucketId = parseInt(selectedBucketId?.replace('s3_', '') || selectedBucketId || '0', 10);
                    if (isNaN(bucketId)) throw new Error("Invalid Bucket ID");

                    const { localUpload } = await import('@/lib/s3-client');
                    promise = localUpload({
                        file,
                        bucket_id: bucketId,
                        prefix: '/uploads',
                        onProgress,
                        signal: controller.signal
                    });
                }

                const result = await promise;

                if (result && (result as any).success === false) {
                    throw new Error((result as any).error || "Upload failed");
                }

                toast.success(`${file.name} uploaded!`);
                setState(prev => ({
                    ...prev,
                    completed: { ...prev.completed, [id]: true },
                    uploadStatus: { ...prev.uploadStatus, [id]: "Completed" },
                    uploadProgress: { ...prev.uploadProgress, [id]: 100 }
                }));
            } catch (error: any) {
                if (axios.isCancel(error) || error.name === 'CanceledError') {
                    updateStatus(id, "Cancelled");
                } else {
                    const msg = error.message || "Upload failed";
                    console.error(`Error uploading ${file.name}:`, error);
                    toast.error(`${file.name}: ${msg}`);
                    setState(prev => ({
                        ...prev,
                        errors: { ...prev.errors, [id]: msg },
                        uploadStatus: { ...prev.uploadStatus, [id]: "Failed" }
                    }));
                }
            } finally {
                delete abortControllers.current[id];
                setState(prev => ({
                    ...prev,
                    uploadingFiles: { ...prev.uploadingFiles, [id]: false },
                }));
            }
        });

        await runPromisePool(tasks, maxConcurrentFiles);
    };

    const updateStatus = (id: string, status: string) => {
        setState((prev) => ({
            ...prev,
            uploadStatus: { ...prev.uploadStatus, [id]: status },
        }));
    };

    return (
        <div className="space-y-6">
            {/* Dropzone Area */}
            <div
                {...getRootProps()}
                className={cn(
                    "relative group border-2 border-dashed rounded-3xl p-12 transition-all duration-300 ease-in-out cursor-pointer overflow-hidden",
                    "hover:border-primary/50 hover:bg-primary/5",
                    "bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm",
                    state.files.length === 0 ? "border-border/60" : "border-border/40"
                )}
            >
                <input {...getInputProps()} />
                <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]" />

                <div className="relative flex flex-col items-center justify-center gap-4 text-center">
                    <div className="p-4 rounded-full bg-background shadow-xl shadow-primary/5 ring-1 ring-border transition-transform group-hover:scale-110 duration-500">
                        {Object.values(state.uploadingFiles).some(Boolean) ? (
                            <Loader2 className="h-10 w-10 text-primary animate-spin" />
                        ) : (
                            <UploadCloudIcon className="h-10 w-10 text-primary/80 group-hover:text-primary transition-colors" />
                        )}
                    </div>
                    <div className="space-y-1">
                        <p className="text-lg font-semibold text-foreground/80 group-hover:text-foreground transition-colors">
                            Drop files here or click to upload
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Single request upload for maximum reliability
                        </p>
                    </div>
                </div>
            </div>

            {/* File List */}
            {state.files.length > 0 && (
                <div className="grid gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {state.files.map((wrapper) => {
                        const percent = state.uploadProgress[wrapper.id] || 0;
                        const progressData = {
                            progress: percent,
                            uploadedParts: state.uploadStatus[wrapper.id] || "Pending",
                            totalUploaded: 0 // Not tracking bytes precisely for this simple view
                        };

                        return (
                            <div key={wrapper.id} className="relative group/item">
                                <FileRow2
                                    file={wrapper.file}
                                    displayName={wrapper.file.name}
                                    progressData={progressData}
                                    fileType={getFileType(wrapper.file) || "application/octet-stream"}
                                    uploadStatus={state.uploadStatus[wrapper.id] || "Pending"}
                                    isUploading={state.uploadingFiles[wrapper.id] || false}
                                    onFileNameChange={() => { }} // Not supporting rename here yet
                                    onCancel={() => removeFile(wrapper.id)}
                                    onRetry={() => {
                                        setState(prev => ({
                                            ...prev,
                                            errors: { ...prev.errors, [wrapper.id]: null },
                                            completed: { ...prev.completed, [wrapper.id]: false }
                                        }));
                                        startUploadProcess();
                                    }}
                                    error={state.errors[wrapper.id]}
                                />
                                <button
                                    onClick={() => removeFile(wrapper.id)}
                                    className="absolute -right-2 -top-2 p-2 rounded-full bg-destructive text-destructive-foreground shadow-lg opacity-0 group-hover/item:opacity-100 transition-all duration-200 hover:scale-110 z-10"
                                    title="Remove file"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Controls & Settings */}
            <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-md p-6 space-y-6 shadow-sm">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Upload Settings</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Concurrency */}
                    <div className="space-y-3">
                        <label className="text-xs font-medium text-foreground/70 uppercase tracking-wider">Concurrency</label>
                        <div className="space-y-1.5">
                            <span className="text-[10px] text-muted-foreground">Simultaneous Files</span>
                            <Select value={maxConcurrentFiles.toString()} onValueChange={(v) => setMaxConcurrentFiles(Number(v))}>
                                <SelectTrigger className="bg-background/50 border-border/50 focus:ring-primary/20"><SelectValue /></SelectTrigger>
                                <SelectContent>{[1, 2, 3, 5].map(i => <SelectItem key={i} value={i.toString()}>{i} Files</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between pt-4 border-t border-border/50">
                    <div className="w-full md:w-auto min-w-[200px]">
                        <BucketSelector testS3ConnectionAction={testS3ConnectionAction} testConnection={false} />
                    </div>

                    <Button
                        onClick={startUploadProcess}
                        size="lg"
                        className={cn(
                            "min-w-[200px] shadow-lg shadow-primary/20 transition-all duration-300",
                            Object.values(state.uploadingFiles).some(Boolean) ? "opacity-90" : "hover:scale-105"
                        )}
                        disabled={state.files.length === 0 || isLoading || Object.values(state.uploadingFiles).some(Boolean)}
                    >
                        {Object.values(state.uploadingFiles).some(Boolean) ? (
                            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Uploading...</>
                        ) : (
                            <><UploadCloudIcon className="mr-2 h-5 w-5" /> Start Upload</>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
