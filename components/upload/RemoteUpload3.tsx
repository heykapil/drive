'use client';

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getBucketInfo, useBucketStore } from "@/hooks/use-bucket-store";
import { runPromisePool } from "@/lib/helpers/promise-pool";
import { cn, getFileTypeFromFilename } from "@/lib/utils";
import { AlertTriangle, CloudUpload, LinkIcon, Loader2, Plus, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BucketSelector } from "../bucket-selector";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { FileRow2 } from "./FileRow2";
import { uploadMultipart } from "./RemoteUploadMultipart3";

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

interface RemoteFileWrapper {
    id: string;
    url: string;
    file: File; // Dummy file for FileRow2 compatibility
}

interface RemoteFileState {
    files: RemoteFileWrapper[];
    uploadingFiles: Record<string, boolean>;
    uploadProgress: Record<string, number>;
    uploadStatus: Record<string, string>;
    errors: Record<string, string | null>;
    completed: Record<string, boolean>;
}

interface RemoteUploadProps {
    encryptBucketConfig: (bucketId: number) => Promise<string>;
    testS3ConnectionAction: (bucketIds: number | number[]) => Promise<any>;
}

export default function RemoteUpload3({ encryptBucketConfig, testS3ConnectionAction }: RemoteUploadProps) {
    const { selectedBucketId, isLoading } = useBucketStore();

    const [state, setState] = useState<RemoteFileState>({
        files: [],
        uploadingFiles: {},
        uploadProgress: {},
        uploadStatus: {},
        errors: {},
        completed: {},
    });

    const [inputUrls, setInputUrls] = useState("");
    const [maxConcurrentFiles, setMaxConcurrentFiles] = useState<number>(3);
    const [proxy, setProxy] = useState<boolean>(false);
    const [endpoint, setEndpoint] = useState<string>("default");
    const [isSynologyBucket, setIsSynologyBucket] = useState(false);
    const [showInput, setShowInput] = useState(true);

    // Keyed by ID
    const abortControllers = useRef<Record<string, AbortController[]>>({});

    useEffect(() => {
        if (selectedBucketId) {
            const bucketInfo = getBucketInfo(selectedBucketId);
            setIsSynologyBucket(bucketInfo?.provider?.toLowerCase() === 'synology');
        }
    }, [selectedBucketId]);

    // --- Handlers ---

    const handleAddUrls = () => {
        const urls = inputUrls.split('\n').map(u => u.trim()).filter(u => u);
        if (urls.length === 0) return;

        const newFiles = urls.map(url => {
            const name = url.split('/').pop() || 'unknown-file';
            // Create a dummy file object for FileRow2
            const file = new File([], name, { type: getFileTypeFromFilename(name) || 'application/octet-stream' });
            // Override size to 0 initially (unknown)
            Object.defineProperty(file, 'size', { value: 0, writable: true });

            return {
                id: generateId(),
                url,
                file
            };
        });

        setState(prev => ({
            ...prev,
            files: [...prev.files, ...newFiles]
        }));
        setInputUrls("");
        setShowInput(false);
    };

    const removeFile = (id: string) => {
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
        if (state.files.length <= 1) setShowInput(true);
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
        const tasks = state.files.map((wrapper) => async () => {
            if (state.uploadingFiles[wrapper.id] || state.completed[wrapper.id]) return;

            const { id, url, file } = wrapper;

            setState(prev => ({
                ...prev,
                uploadingFiles: { ...prev.uploadingFiles, [id]: true },
                errors: { ...prev.errors, [id]: null },
                completed: { ...prev.completed, [id]: false }
            }));

            updateStatus(id, "Starting...");

            try {
                // Adapter for setProgress
                const progressAdapter = (updater: any) => {
                    // updater is a function (prev) => newState
                    // We pass an empty object to get the new state
                    const newState = typeof updater === 'function' ? updater({}) : updater;
                    const percent = newState[url];
                    if (typeof percent === 'number') {
                        setState(prev => ({
                            ...prev,
                            uploadProgress: { ...prev.uploadProgress, [id]: percent }
                        }));
                    }
                };

                await uploadMultipart(
                    url,
                    selectedBucketId as number,
                    progressAdapter as any,
                    encryptBucketConfig,
                    proxy ? undefined : "",
                    isSynologyBucket,
                    endpoint
                );

                toast.success(`${file.name} uploaded!`);
                setState(prev => ({
                    ...prev,
                    completed: { ...prev.completed, [id]: true },
                    uploadStatus: { ...prev.uploadStatus, [id]: "Completed" },
                    uploadProgress: { ...prev.uploadProgress, [id]: 100 }
                }));
            } catch (error: any) {
                const msg = error.message || "Upload failed";
                console.error(`Error uploading ${file.name}:`, error);
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

    return (
        <div className="space-y-6">
            {/* Input Area */}
            <div className={cn(
                "relative group border-2 border-dashed rounded-3xl transition-all duration-300 ease-in-out overflow-hidden",
                "bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm",
                state.files.length === 0 ? "p-8 border-border/60" : "p-4 border-border/40"
            )}>
                <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]" />

                <div className="relative z-10 space-y-4">
                    {state.files.length === 0 || showInput ? (
                        <div className="space-y-4">
                            <div className="flex flex-col items-center justify-center gap-2 text-center mb-4">
                            </div>
                            <Textarea
                                placeholder="https://example.com/video.mp4&#10;https://example.com/archive.zip"
                                className="min-h-[100px] bg-background/50 border-border/50 font-mono text-xs resize-none"
                                value={inputUrls}
                                onChange={(e) => setInputUrls(e.target.value)}
                            />
                            <div className="flex justify-end">
                                <Button size="sm" onClick={handleAddUrls} disabled={!inputUrls.trim()}>
                                    <Plus className="w-4 h-4 mr-2" /> Add to Queue
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-center">
                            <Button variant="outline" size="sm" onClick={() => setShowInput(true)}>
                                <Plus className="w-4 h-4 mr-2" /> Add More URLs
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* File List */}
            {state.files.length > 0 && (
                <div className="grid gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {state.files.map((wrapper) => {
                        // Construct progress data for FileRow2
                        const percent = state.uploadProgress[wrapper.id] || 0;
                        const progressData = {
                            progress: percent,
                            uploadedParts: percent === 100 ? "Done" : "Uploading...",
                            totalUploaded: 0, // We don't track bytes in this wrapper yet
                        };

                        return (
                            <div key={wrapper.id} className="relative group/item">
                                <FileRow2
                                    file={wrapper.file}
                                    displayName={wrapper.file.name}
                                    progressData={progressData}
                                    fileType={wrapper.file.type}
                                    uploadStatus={state.uploadStatus[wrapper.id] || "Pending"}
                                    isUploading={state.uploadingFiles[wrapper.id] || false}
                                    onFileNameChange={() => { }} // Rename not supported for remote yet
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

            {/* Settings Panel */}
            <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-md p-6 space-y-6 shadow-sm">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Upload Settings</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {/* Concurrency */}
                    <div className="space-y-3">
                        <label className="text-xs font-medium text-foreground/70 uppercase tracking-wider">Concurrency</label>
                        <div className="space-y-1.5">
                            <span className="text-[10px] text-muted-foreground">Simultaneous Downloads</span>
                            <Select value={maxConcurrentFiles.toString()} onValueChange={(v) => setMaxConcurrentFiles(Number(v))}>
                                <SelectTrigger className="bg-background/50 border-border/50 focus:ring-primary/20"><SelectValue /></SelectTrigger>
                                <SelectContent>{[1, 2, 3, 5].map(i => <SelectItem key={i} value={i.toString()}>{i} Files</SelectItem>)}</SelectContent>
                            </Select>
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
                            {endpoint !== 'default' && (
                                <div className="flex items-center gap-1.5 text-[10px] text-orange-500 bg-orange-500/10 px-2 py-1 rounded-md w-fit">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span>May have 50s cold start delay</span>
                                </div>
                            )}
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
                            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing Queue...</>
                        ) : (
                            <><CloudUpload className="mr-2 h-5 w-5" /> Start Remote Upload</>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}