'use client';

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useBucketStore } from "@/hooks/use-bucket-store";
import { cn } from "@/lib/utils";
import { CloudUpload, Loader2, Plus, Terminal } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { BucketSelector } from "../bucket-selector";
import { Switch } from "../ui/switch";
import { signJWT } from "@/lib/helpers/jose";

interface JobStatus {
    job_id: string;
    queued_count: number;
    message: string;
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    processed_count?: number;
    failed_count?: number;
}

export default function RemoteUpload4() {
    const { selectedBucketId, isLoading: isBucketLoading } = useBucketStore();
    const [inputUrls, setInputUrls] = useState("");
    const [proxy, setProxy] = useState<boolean>(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);

    // Filter out empty lines
    const getUrls = () => inputUrls.split('\n').map(u => u.trim()).filter(Boolean);

    const handleSubmit = async () => {
        const urls = getUrls();
        if (urls.length === 0) {
            toast.error("Please enter at least one URL");
            return;
        }
        if (!selectedBucketId) {
            toast.error("Please select a bucket");
            return;
        }

        setIsSubmitting(true);
        setJobId(null);
        setJobStatus(null);

        try {
            // Process URLs if proxy is enabled
            const processedUrls = proxy
                ? urls.map(url => `https://stream.kapil.app?url=${encodeURIComponent(url)}`)
                : urls;

            const payload = {
                urls: processedUrls,
                bucket_id: selectedBucketId,
                prefix: "/uploads" // Default prefix as per requirements
            };
            const token = await signJWT({
                sub: 'user123',
                name: 'Test User'
            }, '1h');
            const res = await fetch('https://api.kapil.app/upload/remote', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || `Upload failed with status ${res.status}`);
            }

            const data: JobStatus = await res.json();

            toast.success(`Job started: ${data.message}`);
            setJobId(data.job_id);
            setJobStatus(data);

        } catch (error: any) {
            console.error("Remote upload error:", error);
            toast.error(error.message || "Failed to start remote upload");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Polling effect
    useEffect(() => {
        if (!jobId) return;

        // Poll every 2 seconds
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`https://api.kapil.app/upload/status/${jobId}`);
                if (res.ok) {
                    const data = await res.json();
                    setJobStatus(prev => ({ ...prev, ...data }));

                    // Stop polling if completed or failed (assuming status field indicates this)
                    // If the API doesn't return an explicit status field for completion, 
                    // we might need to rely on processed_count matching queued_count or specific messages.
                    // For now, valid 'completed' or 'failed' status stops it.
                    if (data.status === 'completed' || data.status === 'failed') {
                        clearInterval(interval);
                        if (data.status === 'completed') toast.success("Remote upload job completed!");
                        if (data.status === 'failed') toast.error("Remote upload job failed.");
                    }
                }
            } catch (err) {
                console.error("Polling error", err);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [jobId]);

    const hasJob = !!jobId;

    return (
        <div className="space-y-6">
            <div className={cn(
                "relative group border-2 border-dashed rounded-3xl transition-all duration-300 ease-in-out overflow-hidden",
                "bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm",
                "p-4 border-border/60"
            )}>
                <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]" />

                <div className="relative z-10 space-y-4">
                    {!hasJob ? (
                        <>
                            <div className="flex flex-col gap-2">
                                <label className="flex text-sm font-medium justify-between text-muted-foreground ml-1">
                                    Enter URLs (one per line)
                                    <span className="text-xs text-muted-foreground">{getUrls().length} URLs detected</span>
                                </label>
                                <Textarea
                                    placeholder="https://example.com/video.mp4&#10;https://example.com/archive.zip"
                                    className="min-h-[178px] bg-background/50 border-border/50 font-mono text-xs resize-none focus-visible:ring-primary/20"
                                    value={inputUrls}
                                    onChange={(e) => setInputUrls(e.target.value)}
                                    disabled={isSubmitting}
                                />
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 space-y-4">
                            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                                <CloudUpload className="h-8 w-8 text-primary" />
                            </div>
                            <div className="text-center space-y-1">
                                <h3 className="font-semibold text-lg">Upload Job Active</h3>
                                <p className="text-sm text-muted-foreground font-mono">{jobId}</p>
                            </div>

                            {jobStatus && (
                                <div className="w-full max-w-sm bg-card/50 border border-border/50 rounded-xl p-4 space-y-3 mt-4">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Status</span>
                                        <span className="font-medium capitalize">{jobStatus.status || 'Running'}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Queued</span>
                                        <span className="font-medium">{jobStatus.queued_count ?? '-'}</span>
                                    </div>
                                    {jobStatus.processed_count !== undefined && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Processed</span>
                                            <span className="font-medium">{jobStatus.processed_count}</span>
                                        </div>
                                    )}
                                    <div className="pt-2 border-t border-border/50">
                                        <p className="text-xs text-center text-muted-foreground">{jobStatus.message}</p>
                                    </div>
                                </div>
                            )}

                            <Button variant="outline" size="sm" onClick={() => {
                                setJobId(null);
                                setJobStatus(null);
                                setInputUrls("");
                            }} className="mt-4">
                                Start New Upload
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Settings Panel - Only show when no job is active */}
            {!hasJob && (
                <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-md p-6 space-y-6 shadow-sm">
                    <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Upload Settings</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Proxy Mode */}
                        <div className="space-y-3">
                            <label className="text-xs font-medium text-foreground/70 uppercase tracking-wider">Advanced</label>
                            <div className="flex items-center justify-between p-3 rounded-lg bg-background/40 border border-border/50">
                                <div className="space-y-0.5">
                                    <span className="text-sm font-medium">Proxy Mode</span>
                                    <p className="text-[10px] text-muted-foreground">Route through stream.kapil.app proxy</p>
                                </div>
                                <Switch checked={proxy} onCheckedChange={setProxy} disabled={isSubmitting} />
                            </div>
                        </div>

                        {/* Bucket Selection */}
                        <div className="space-y-3">
                            <label className="text-xs font-medium text-foreground/70 uppercase tracking-wider">Target</label>
                            <BucketSelector testS3ConnectionAction={async () => []} testConnection={false} />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-border/50 flex justify-end">
                        <Button
                            onClick={handleSubmit}
                            size="lg"
                            className={cn(
                                "min-w-[200px] shadow-lg shadow-primary/20 transition-all duration-300",
                                isSubmitting ? "opacity-90" : "hover:scale-105"
                            )}
                            disabled={isSubmitting || isBucketLoading || getUrls().length === 0}
                        >
                            {isSubmitting ? (
                                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Starting Job...</>
                            ) : (
                                <><Terminal className="mr-2 h-5 w-5" /> Start Remote Upload</>
                            )}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
