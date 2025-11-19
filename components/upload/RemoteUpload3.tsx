'use client';

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getBucketInfo, useBucketStore } from "@/hooks/use-bucket-store";
import { runPromisePool } from "@/lib/helpers/promise-pool";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, LinkIcon, Loader2, UploadCloud } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BucketSelector } from "../bucket-selector";
import { uploadMultipart } from "./RemoteUploadMultipart3";

// ... reused constants ...
const WORKER_ENDPOINTS = [
    { value: 'default', label: 'Default (Local /api/upload)' },
    { value: 'https://us-chunk.kapil.app', label: 'Render (EU)' },
    { value: 'https://s3chunk-xi59.onrender.com', label: 'Render (Singapore)' },
];

interface RemoteUploadProps {
    encryptBucketConfig: (bucketId: number) => Promise<string>;
    testS3ConnectionAction: (bucketIds: number | number[]) => Promise<any>;
}

export default function RemoteUpload3({ encryptBucketConfig, testS3ConnectionAction }: RemoteUploadProps) {
    const { selectedBucketId, isLoading } = useBucketStore();
    const [fileUrls, setFileUrls] = useState<string>("");
    const [progress, setProgress] = useState<{ [key: string]: number }>({});
    const [isUploading, setIsUploading] = useState(false);
    const [statusMessage, setStatusMessage] = useState(""); // For "Waking up..."
    const [proxy, setProxy] = useState(false);
    const [synologyBucket, setIsSynologyBucket] = useState(false);
    const [selectedWorker, setSelectedWorker] = useState<string>('default');

    useEffect(() => {
        if (selectedBucketId) {
            const bucketInfo = getBucketInfo(selectedBucketId);
            setIsSynologyBucket(bucketInfo?.provider?.toLowerCase() === 'synology');
        }
    }, [selectedBucketId]);

    const wakeUpWorker = async () => {
        if (selectedWorker === 'default') return;
        setStatusMessage("Waking up worker node (may take 50s)...");

        const controller = new AbortController();
        const to = setTimeout(() => controller.abort(), 60000);

        try {
            await fetch(`${selectedWorker}/`, { signal: controller.signal, mode: 'no-cors' });
        } catch (e) {
            console.log("Wakeup ping finished or failed, continuing.");
        } finally {
            clearTimeout(to);
            setStatusMessage("");
        }
    };

    const handleUpload = async () => {
        const urls = fileUrls.split("\n").filter((url) => url.trim() !== "");
        if (urls.length === 0) {
            toast.error("Please enter at least one URL.");
            return;
        }

        setIsUploading(true);

        // Step 1: Wake up
        await wakeUpWorker();

        // Step 2: Upload
        const uploadTasks = urls.map((url) => async () => {
            const cleanUrl = url.trim();
            try {
                await uploadMultipart(
                    cleanUrl,
                    selectedBucketId as number,
                    setProgress,
                    encryptBucketConfig,
                    proxy ? undefined : "", // If disabled, force empty string if logic requires
                    synologyBucket,
                    selectedWorker
                );
            } catch (error) {
                console.error(`Failed to upload ${cleanUrl}:`, error);
                toast.error(`Failed: ${cleanUrl}`);
            }
        });

        try {
            await runPromisePool(uploadTasks, 3);
            toast.success("Queue finished processing");
            setFileUrls(""); // Clear on success
        } catch (error) {
            toast.error("Global error during upload pool");
        } finally {
            setIsUploading(false);
            setStatusMessage("");
        }
    };

    return (
        <div className="space-y-6">
            {/* URL Input Area */}
            <div className="relative group">
                <div className={cn(
                    "absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500",
                    isUploading && "animate-pulse"
                )} />
                <div className="relative bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-1 shadow-sm">
                    <textarea
                        className="flex min-h-[150px] w-full rounded-xl bg-background/50 px-4 py-4 text-sm font-mono placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-0 resize-none custom-scrollbar transition-colors"
                        placeholder="https://example.com/video.mp4&#10;https://example.com/archive.zip"
                        value={fileUrls}
                        onChange={(e) => setFileUrls(e.target.value)}
                        disabled={isUploading}
                    />
                    <div className="absolute bottom-3 right-3 flex items-center gap-2 pointer-events-none">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-medium bg-background/80 px-2 py-1 rounded-md backdrop-blur-sm">
                            One URL per line
                        </span>
                    </div>
                </div>
            </div>

            {/* Settings Panel */}
            <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-md p-6 space-y-6 shadow-sm">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Remote Upload Settings</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {/* Worker Node */}
                    <div className="space-y-3">
                        <label className="text-xs font-medium text-foreground/70 uppercase tracking-wider">Worker Node</label>
                        <div className="space-y-1.5">
                            <span className="text-[10px] text-muted-foreground">Processing Endpoint</span>
                            <Select value={selectedWorker} onValueChange={setSelectedWorker} disabled={isUploading}>
                                <SelectTrigger className="bg-background/50 border-border/50 focus:ring-primary/20"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {WORKER_ENDPOINTS.map((w) => (
                                        <SelectItem key={w.value} value={w.value}>{w.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedWorker !== 'default' && (
                                <div className="flex items-center gap-1.5 text-[10px] text-orange-500 bg-orange-500/10 px-2 py-1 rounded-md w-fit">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span>May have 50s cold start delay</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Proxy Settings */}
                    <div className="space-y-3">
                        <label className="text-xs font-medium text-foreground/70 uppercase tracking-wider">Network</label>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-background/40 border border-border/50">
                            <div className="space-y-0.5">
                                <span className="text-sm font-medium">Proxy Mode</span>
                                <p className="text-[10px] text-muted-foreground">Use high-performance proxy</p>
                            </div>
                            <Switch checked={proxy} onCheckedChange={setProxy} disabled={isUploading} />
                        </div>
                    </div>

                    {/* Bucket Selection (Placeholder for layout balance if needed, or keep it full width below) */}
                    <div className="space-y-3 md:col-span-2 lg:col-span-1">
                        <label className="text-xs font-medium text-foreground/70 uppercase tracking-wider">Destination</label>
                        <div className="space-y-1.5">
                            <span className="text-[10px] text-muted-foreground">Target Bucket</span>
                            <BucketSelector testS3ConnectionAction={testS3ConnectionAction} testConnection={true} />
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                <div className="pt-4 border-t border-border/50">
                    <Button
                        onClick={handleUpload}
                        disabled={isUploading || !fileUrls.trim() || isLoading}
                        size="lg"
                        className={cn(
                            "w-full md:w-auto min-w-[200px] shadow-lg shadow-primary/20 transition-all duration-300",
                            isUploading ? "opacity-90" : "hover:scale-105"
                        )}
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                {statusMessage || "Processing Remote Upload..."}
                            </>
                        ) : (
                            <>
                                <UploadCloud className="mr-2 h-5 w-5" />
                                Start Remote Upload
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Progress List */}
            {Object.keys(progress).length > 0 && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-2 pb-2">
                        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Upload Progress</h3>
                        <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded-full text-secondary-foreground">
                            {Object.keys(progress).length} Items
                        </span>
                    </div>

                    <div className="grid gap-3">
                        {Object.entries(progress).map(([url, percent]) => (
                            <div key={url} className="group relative border border-border/50 rounded-xl p-4 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm hover:border-primary/20 transition-all duration-300">
                                {/* Background Progress */}
                                <div
                                    className="absolute bottom-0 left-0 h-1 bg-primary/10 transition-all duration-300 rounded-b-xl overflow-hidden"
                                    style={{ width: '100%' }}
                                >
                                    <div
                                        className="h-full bg-primary/20 transition-all duration-300 ease-out"
                                        style={{ width: `${percent}%` }}
                                    />
                                </div>

                                <div className="flex items-center gap-4 relative z-10">
                                    <div className={cn(
                                        "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                        percent === 100 ? "bg-green-500/10 text-green-500" : "bg-secondary text-muted-foreground"
                                    )}>
                                        {percent === 100 ? (
                                            <CheckCircle2 className="h-5 w-5" />
                                        ) : (
                                            <LinkIcon className="h-5 w-5" />
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-medium truncate font-mono text-foreground/90" title={url}>
                                                {url}
                                            </p>
                                            <span className={cn(
                                                "text-xs font-bold tabular-nums",
                                                percent === 100 ? "text-green-500" : "text-primary"
                                            )}>
                                                {Math.round(percent)}%
                                            </span>
                                        </div>
                                        <Progress value={percent} className="h-1.5 bg-secondary/50" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}