"use client";

import { Button } from "@/components/ui/button";
import { getBucketInfo, useBucketStore } from "@/hooks/use-bucket-store";
import { calculateChunkSize } from "@/lib/helpers/chunk-size";
import { signPasetoToken } from "@/lib/helpers/paseto-ts";
import { runPromisePool } from "@/lib/helpers/promise-pool";
import { cn, getFileType, getFileTypeFromFilename } from "@/lib/utils";
import axios from "axios";
import { Loader2, Trash2, UploadCloudIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { BucketSelector } from "../bucket-selector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { FileRow2 } from "./FileRow2";

const FILE_SIZE_THRESHOLD = 5 * 1024 * 1024; // 5MB
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY = 2000;
const DEFAULT_CONTENT_TYPE = "application/octet-stream";

// Unique ID Generator
const generateId = () => Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

// Wake up worker helper
const wakeUpWorker = async (endpoint: string) => {
    if (endpoint === 'default' || !endpoint.startsWith('http')) return true;
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 60000);
    try {
        await fetch(`${endpoint}/`, { signal: controller.signal, mode: 'no-cors' });
    } catch (e) { /* ignore */ }
};

// Wrapper for robust handling
interface FileWrapper {
    id: string;
    file: File;
}

interface FileState {
    files: FileWrapper[];
    // All state is now keyed by ID (string), not filename
    uploadingFiles: Record<string, boolean>;
    uploadProgress: Record<string, Record<number, number>>;
    totalParts: Record<string, number>;
    chunkSizes: Record<string, number>;
    uploadStatus: Record<string, string>;
    uploadIds: Record<string, string>;
    errors: Record<string, string | null>;
    completed: Record<string, boolean>;
}

interface UploadPart {
    PartNumber: number;
    ETag: string;
}

export function FileUpload4({
    testS3ConnectionAction,
    encryptBucketConfigAction
}: {
    testS3ConnectionAction: (bucketIds: number | number[]) => Promise<any>,
    encryptBucketConfigAction?: (bucketId: number) => Promise<string>
}) {
    const { selectedUniqueId: selectedBucketId, isLoading } = useBucketStore();

    const [state, setState] = useState<FileState>({
        files: [],
        uploadingFiles: {},
        uploadProgress: {},
        totalParts: {},
        chunkSizes: {},
        uploadStatus: {},
        uploadIds: {},
        errors: {},
        completed: {},
    });

    const [maxConcurrentFiles, setMaxConcurrentFiles] = useState<number>(3);
    const [maxConcurrentChunks, setMaxConcurrentChunks] = useState<number>(3);
    const [proxy, setProxy] = useState<boolean>(false);
    const [endpoint, setEndpoint] = useState<string>("default");
    const [isSynologyBucket, setIsSynologyBucket] = useState(false);

    // Keyed by ID
    const abortControllers = useRef<Record<string, AbortController[]>>({});

    useEffect(() => {
        if (selectedBucketId) {
            const bucketInfo = getBucketInfo(selectedBucketId);
            setIsSynologyBucket(bucketInfo?.provider?.toLowerCase() === 'synology');
        }
    }, [selectedBucketId]);

    // --- Handlers ---

    const removeFile = (id: string) => {
        handleCancel(id);
        setState((prev) => {
            // Remove from array
            const newFiles = prev.files.filter(f => f.id !== id);

            // Create clean copies of maps
            const cleanMap = <T,>(map: Record<string, T>) => {
                const newMap = { ...map };
                delete newMap[id];
                return newMap;
            };

            return {
                ...prev,
                files: newFiles,
                uploadProgress: cleanMap(prev.uploadProgress),
                totalParts: cleanMap(prev.totalParts),
                chunkSizes: cleanMap(prev.chunkSizes),
                uploadStatus: cleanMap(prev.uploadStatus),
                uploadingFiles: cleanMap(prev.uploadingFiles),
                uploadIds: cleanMap(prev.uploadIds),
                errors: cleanMap(prev.errors),
                completed: cleanMap(prev.completed),
            };
        });
    };

    const onDrop = (acceptedFiles: File[]) => {
        setState((prev) => {
            // Filter duplicates based on content/name collision if needed, 
            // but here we allow same names because IDs are unique.
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

    const handleFileNameChange = (id: string, newName: string) => {
        if (!newName) return;

        setState((prev) => {
            const targetWrapper = prev.files.find(f => f.id === id);
            if (!targetWrapper) return prev;

            const oldName = targetWrapper.file.name;
            if (oldName === newName) return prev;

            // Preserve extension if user didn't type it
            const ext = oldName.includes('.') ? oldName.split(".").pop() : "";
            const finalName = (ext && !newName.endsWith(`.${ext}`)) ? `${newName}.${ext}` : newName;

            // Create new File object with new name
            // Note: This preserves the blob content
            const newFile = new File([targetWrapper.file], finalName, {
                type: targetWrapper.file.type,
                lastModified: targetWrapper.file.lastModified
            });

            // Update only the file object in the array
            const updatedFiles = prev.files.map(f =>
                f.id === id ? { ...f, file: newFile } : f
            );

            return {
                ...prev,
                files: updatedFiles,
            };
        });
    };

    const handleCancel = (id: string) => {
        if (abortControllers.current[id]) {
            abortControllers.current[id].forEach((c) => c.abort());
            delete abortControllers.current[id];
        }
        const uploadId = state.uploadIds[id];
        if (uploadId) {
            fetch('/api/upload/clean-up', {
                method: 'POST',
                body: JSON.stringify({ uploadId }),
            }).catch(console.error);
        }
        updateStatus(id, "Cancelled");
        setState(prev => ({
            ...prev,
            uploadingFiles: { ...prev.uploadingFiles, [id]: false }
        }));
    };

    const updateStatus = (id: string, status: string) => {
        setState((prev) => ({
            ...prev,
            uploadStatus: { ...prev.uploadStatus, [id]: status },
        }));
    };

    // --- Upload Logic ---

    const startUploadProcess = async () => {
        if (endpoint !== 'default') {
            const hasPending = state.files.some(f => !state.completed[f.id] && !state.uploadingFiles[f.id]);
            if (hasPending) toast.info("Waking up worker... (up to 60s)");
            await wakeUpWorker(endpoint);
        }
        uploadFiles();
    };

    const uploadFiles = async () => {
        // Filter for files that are not uploading and not complete
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

            try {
                if (file.size <= FILE_SIZE_THRESHOLD) {
                    await uploadSimple(wrapper);
                } else {
                    await uploadMultipart(wrapper);
                }

                toast.success(`${file.name} uploaded!`);
                setState(prev => ({
                    ...prev,
                    completed: { ...prev.completed, [id]: true },
                    uploadStatus: { ...prev.uploadStatus, [id]: "Completed" }
                }));
            } catch (error: any) {
                if (error.name === "AbortError") return;
                const msg = error.message || "Upload failed";
                console.error(`Error uploading ${file.name}:`, error);
                toast.error(`${file.name}: ${msg}`);
                setState(prev => ({
                    ...prev,
                    errors: { ...prev.errors, [id]: msg },
                    uploadStatus: { ...prev.uploadStatus, [id]: "Failed" }
                }));
            } finally {
                setState(prev => ({
                    ...prev,
                    uploadingFiles: { ...prev.uploadingFiles, [id]: false },
                }));
            }
        });

        await runPromisePool(tasks, maxConcurrentFiles);
    };

    const uploadSimple = async ({ id, file }: FileWrapper) => {
        updateStatus(id, "Uploading...");
        const controller = new AbortController();
        abortControllers.current[id] = [controller];

        const formData = new FormData();
        // IMPORTANT: The backend expects 'file' for simple uploads
        formData.append("file", file);

        const response = await fetch(`/api/upload/simple?bucket=${selectedBucketId}`, {
            method: "POST",
            body: formData,
            signal: controller.signal,
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error);

        setState(prev => ({
            ...prev,
            uploadProgress: { ...prev.uploadProgress, [id]: { 1: file.size } },
            totalParts: { ...prev.totalParts, [id]: 1 },
            chunkSizes: { ...prev.chunkSizes, [id]: file.size }
        }));
    };

    const uploadMultipart = async ({ id, file }: FileWrapper) => {
        const fileName = file.name; // Always use current name
        const contentType = getFileType(file) || file.type || DEFAULT_CONTENT_TYPE;

        updateStatus(id, "Initiating...");
        const initRes = await fetch(`/api/upload/multipart/initiate?bucket=${selectedBucketId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: fileName, contentType }),
        });

        if (!initRes.ok) throw new Error("Failed to initiate");
        const { uploadId, key } = await initRes.json();

        setState(prev => ({
            ...prev,
            uploadIds: { ...prev.uploadIds, [id]: uploadId }
        }));

        const chunkSize = calculateChunkSize(file.size);
        const totalParts = Math.ceil(file.size / chunkSize);

        setState((prev) => ({
            ...prev,
            totalParts: { ...prev.totalParts, [id]: totalParts },
            chunkSizes: { ...prev.chunkSizes, [id]: chunkSize },
            uploadProgress: { ...prev.uploadProgress, [id]: {} },
        }));

        const chunkTasks = [];
        for (let i = 1; i <= totalParts; i++) {
            chunkTasks.push(() => uploadChunk(file, i, totalParts, chunkSize, uploadId, key, id));
        }

        updateStatus(id, "Uploading parts...");

        const parts = await runPromisePool(chunkTasks, maxConcurrentChunks);

        // Integrity check
        const validParts = parts.filter((p: any) => p && p.ETag);
        if (validParts.length !== totalParts) {
            throw new Error(`Integrity check failed: ${validParts.length}/${totalParts} parts.`);
        }

        updateStatus(id, "Finishing...");
        await completeMultipartUpload(file, uploadId, key, contentType, validParts, id);
    };

    const uploadChunk = async (
        file: File, partNumber: number, totalParts: number, chunkSize: number,
        uploadId: string, key: string, id: string
    ): Promise<UploadPart> => {
        const controller = new AbortController();
        if (!abortControllers.current[id]) abortControllers.current[id] = [];
        abortControllers.current[id].push(controller);

        let attempt = 0;
        while (attempt < MAX_RETRY_ATTEMPTS) {
            try {
                const start = (partNumber - 1) * chunkSize;
                const end = Math.min(start + chunkSize, file.size);
                const chunkBlob = file.slice(start, end);

                let eTag = "";

                if (isSynologyBucket) {
                    const formData = new FormData();
                    formData.append("uploadId", uploadId);
                    formData.append("key", key);
                    formData.append("partNumber", partNumber.toString());
                    formData.append("chunk", new Blob([chunkBlob]));

                    if (encryptBucketConfigAction) {
                        // formData.append("s3config", await encryptBucketConfigAction(selectedBucketId as number));
                    }

                    let url = `/api/upload/multipart/chunk?bucket=${selectedBucketId}`;
                    if (endpoint && endpoint !== 'default') {
                        url = `${endpoint}/upload?bucket=${selectedBucketId}`;
                    } else if (process.env.NODE_ENV === "production") {
                        url = `${process.env.NEXT_PUBLIC_GCLOUD_URL_CHUNK}/upload?bucket=${selectedBucketId}`;
                    }

                    const payload = { uploadId, key, partNumber };
                    const token = await signPasetoToken(payload);

                    const { data } = await axios.post(url, formData, {
                        signal: controller.signal,
                        headers: { "x-access-token": token },
                        onUploadProgress: (evt) => {
                            if (evt.loaded) updateProgress(id, partNumber, evt.loaded);
                        }
                    });

                    if (!data.success) throw new Error(data.error || "Worker fail");
                    eTag = data.ETag || data.etag || data.eTag;

                } else {
                    // Direct S3
                    const presignRes = await fetch(`/api/upload/multipart/presign?bucket=${selectedBucketId}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ uploadId, key, partNumber }),
                    });
                    const { url } = await presignRes.json();
                    const uploadUrl = proxy ? `https://stream.kapil.app?url=${encodeURIComponent(url)}` : url;

                    const res = await axios.put(uploadUrl, chunkBlob, {
                        signal: controller.signal,
                        onUploadProgress: (evt) => {
                            if (evt.loaded) updateProgress(id, partNumber, evt.loaded);
                        }
                    });
                    eTag = res.headers.etag?.replace(/"/g, "");
                }

                if (!eTag) throw new Error("No ETag");

                updateProgress(id, partNumber, chunkBlob.size);
                return { PartNumber: partNumber, ETag: eTag };

            } catch (err: any) {
                if (err.name === "AbortError") throw err;
                attempt++;
                updateProgress(id, partNumber, 0);
                if (attempt >= MAX_RETRY_ATTEMPTS) throw new Error("Part failed permanently.");
                await new Promise(r => setTimeout(r, RETRY_DELAY * attempt));
            }
        }
        throw new Error("Retry exceeded");
    };

    const updateProgress = (id: string, part: number, loaded: number) => {
        setState(prev => ({
            ...prev,
            uploadProgress: {
                ...prev.uploadProgress,
                [id]: { ...(prev.uploadProgress[id] || {}), [part]: loaded }
            }
        }));
    };

    const completeMultipartUpload = async (file: File, uploadId: string, key: string, type: string, parts: UploadPart[], id: string) => {
        const res = await fetch(`/api/upload/multipart/complete?bucket=${selectedBucketId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                uploadId,
                key,
                parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
                filename: file.name, // Use current name
                size: file.size,
                type
            }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error);
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
                            Support for multipart uploads, resume, and high-speed transfer
                        </p>
                    </div>
                </div>
            </div>

            {/* File List */}
            {state.files.length > 0 && (
                <div className="grid gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {state.files.map((wrapper) => {
                        const progressData = getComputedProgress(state, wrapper);
                        return (
                            <div key={wrapper.id} className="relative group/item">
                                <FileRow2
                                    file={wrapper.file}
                                    displayName={wrapper.file.name}
                                    progressData={progressData}
                                    fileType={getFileType(wrapper.file) || DEFAULT_CONTENT_TYPE}
                                    uploadStatus={state.uploadStatus[wrapper.id] || "Pending"}
                                    isUploading={state.uploadingFiles[wrapper.id] || false}
                                    onFileNameChange={(newName) => handleFileNameChange(wrapper.id, newName)}
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {/* Concurrency */}
                    <div className="space-y-3">
                        <label className="text-xs font-medium text-foreground/70 uppercase tracking-wider">Concurrency</label>
                        <div className="flex gap-3">
                            <div className="flex-1 space-y-1.5">
                                <span className="text-[10px] text-muted-foreground">Simultaneous Files</span>
                                <Select value={maxConcurrentFiles.toString()} onValueChange={(v) => setMaxConcurrentFiles(Number(v))}>
                                    <SelectTrigger className="bg-background/50 border-border/50 focus:ring-primary/20"><SelectValue /></SelectTrigger>
                                    <SelectContent>{[1, 2, 3, 5].map(i => <SelectItem key={i} value={i.toString()}>{i} Files</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1 space-y-1.5">
                                <span className="text-[10px] text-muted-foreground">Chunks per File</span>
                                <Select value={maxConcurrentChunks.toString()} onValueChange={(v) => setMaxConcurrentChunks(Number(v))}>
                                    <SelectTrigger className="bg-background/50 border-border/50 focus:ring-primary/20"><SelectValue /></SelectTrigger>
                                    <SelectContent>{[3, 5, 8, 10].map(i => <SelectItem key={i} value={i.toString()}>{i} Chunks</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Worker Node */}
                    <div className="space-y-3">
                        <label className="text-xs font-medium text-foreground/70 uppercase tracking-wider">Worker Node</label>
                        <div className="space-y-1.5">
                            <span className="text-[10px] text-muted-foreground">Processing Endpoint</span>
                            <Select value={endpoint} onValueChange={setEndpoint}>
                                <SelectTrigger className="bg-background/50 border-border/50 focus:ring-primary/20"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="default">Default (Local API)</SelectItem>
                                    <SelectItem value="https://us-chunk.kapil.app">Render (EU)</SelectItem>
                                    <SelectItem value="https://s3chunk-xi59.onrender.com">Render (AP)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Advanced */}
                    <div className="space-y-3">
                        <label className="text-xs font-medium text-foreground/70 uppercase tracking-wider">Advanced</label>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-background/40 border border-border/50">
                            <div className="space-y-0.5">
                                <span className="text-sm font-medium">Proxy Mode</span>
                                <p className="text-[10px] text-muted-foreground">Use high-performance proxy</p>
                            </div>
                            <Switch checked={proxy} onCheckedChange={setProxy} />
                        </div>
                    </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between pt-4 border-t border-border/50">
                    <div className="w-full md:w-auto min-w-[200px]">
                        <BucketSelector testS3ConnectionAction={testS3ConnectionAction} testConnection={true} />
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
                            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Uploading Files...</>
                        ) : (
                            <><UploadCloudIcon className="mr-2 h-5 w-5" /> Start Upload Process</>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function getComputedProgress(state: FileState, wrapper: FileWrapper) {
    const { id, file } = wrapper;
    const totalParts = state.totalParts[id] || 1;
    const chunkSize = state.chunkSizes[id] || 0;
    const progressData = state.uploadProgress[id] || {};

    const totalUploaded = Object.values(progressData).reduce((acc, bytes) => acc + bytes, 0);
    const percent = file.size > 0 ? Math.min(100, (totalUploaded / file.size) * 100) : 0;
    const completedPartsCount = Object.values(progressData).filter(b => b > 0).length;

    return {
        progress: percent,
        uploadedParts: `${completedPartsCount}/${totalParts}`,
        totalUploaded,
        partProgress: progressData,
        totalParts,
        chunkSizes: chunkSize
    };
}