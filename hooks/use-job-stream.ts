
import { useState, useEffect, useRef } from 'react';
import { streamJobUpdates } from '@/lib/terabox-client';
import { terabox } from '@/client';

export interface JobEvent {
    type: 'log' | 'progress' | 'status' | 'error' | 'success';
    job_id: string;
    message?: string;
    percentage?: number;
    meta?: any;
    timestamp: string;
    step?: number;
    total_steps?: number;
}

export interface JobStreamState {
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'initializing';
    progress: number;
    logs: LogEntry[];
    message: string;
    queuedCount?: number;
    processedCount?: number;
    failedCount?: number;
}

export interface LogEntry {
    timestamp: string;
    message: string;
    type: 'log' | 'error' | 'success';
    meta?: any;
    step?: number;
    total_steps?: number;
}

/**
 * Helper to consume job stream outside of React components
 */
export async function monitorJobStream(
    jobId: string,
    handlers: {
        onProgress?: (percentage: number) => void;
        onStatus?: (status: string, message?: string) => void;
        onLog?: (log: LogEntry) => void;
        onError?: (error: string) => void;
        onComplete?: () => void;
        onMeta?: (meta: any) => void;
        signal?: AbortSignal;
    }
) {
    try {
        console.log(`[JobStream] Starting stream for job ${jobId}`);
        const stream = await streamJobUpdates(jobId);
        console.log(`[JobStream] Stream connection established`);

        // Handle stream using async iterator
        // Assuming stream is an async iterable based on Encore's StreamIn
        for await (const msg of stream) {
            console.log(`[JobStream] Received message:`, msg);

            if (handlers.signal?.aborted) {
                console.log(`[JobStream] Aborted, closing stream`);
                stream.close();
                break;
            }

            // Try different message formats - the backend might send events directly
            let event: JobEvent | null = null;

            if (msg.type === 'event' && msg.data) {
                event = msg.data as JobEvent;
            } else if (msg.data && typeof msg.data === 'object') {
                // Maybe the data IS the event directly
                event = msg.data as JobEvent;
            } else if (msg && typeof msg === 'object' && 'job_id' in msg) {
                // Or maybe msg itself is the event
                event = msg as any as JobEvent;
            }

            if (!event) {
                console.warn(`[JobStream] Could not parse event from message:`, msg);
                continue;
            }

            console.log(`[JobStream] Processing event:`, event);

            if (event.meta && handlers.onMeta) {
                handlers.onMeta(event.meta);
            }

            switch (event.type) {
                case 'progress':
                    if (event.percentage !== undefined) {
                        console.log(`[JobStream] Progress: ${event.percentage}%`);
                        handlers.onProgress?.(event.percentage);
                    }
                    break;
                case 'status':
                    console.log(`[JobStream] Status: ${event.message}`);
                    handlers.onStatus?.(event.message || '', event.message);

                    if (event.message === 'completed') {
                        handlers.onComplete?.();
                    }
                    break;
                case 'log':
                    console.log(`[JobStream] Log: ${event.message}`);
                    handlers.onLog?.({
                        timestamp: event.timestamp || new Date().toISOString(),
                        message: event.message || '',
                        type: 'log',
                        meta: event.meta,
                        step: event.step,
                        total_steps: event.total_steps
                    });
                    break;
                case 'success':
                    console.log(`[JobStream] Success: ${event.message}`);
                    handlers.onLog?.({
                        timestamp: event.timestamp || new Date().toISOString(),
                        message: event.message || '',
                        type: 'success',
                        meta: event.meta,
                        step: event.step,
                        total_steps: event.total_steps
                    });
                    break;
                case 'error':
                    const errorMsg = event.message || 'Unknown error';
                    console.error(`[JobStream] Error: ${errorMsg}`);
                    handlers.onError?.(errorMsg);
                    handlers.onLog?.({
                        timestamp: event.timestamp || new Date().toISOString(),
                        message: errorMsg,
                        type: 'error',
                        step: event.step,
                        total_steps: event.total_steps
                    });
                    break;
                default:
                    console.warn(`[JobStream] Unknown event type: ${event.type}`, event);
            }
        }
        console.log(`[JobStream] Stream ended for job ${jobId}`);
    } catch (err: any) {
        if (handlers.signal?.aborted) {
            console.log(`[JobStream] Aborted during stream`);
            return;
        }
        console.error(`[JobStream] Stream error for job ${jobId}:`, err);
        handlers.onError?.(err.message || "Connection lost");
    }
}

/**
 * Hook to consume job stream in React components
 */
export function useJobStream(jobId: string | null) {
    const [state, setState] = useState<JobStreamState>({
        status: 'initializing',
        progress: 0,
        logs: [],
        message: '',
        queuedCount: 0,
        processedCount: 0,
        failedCount: 0
    });

    useEffect(() => {
        if (!jobId) {
            setState({
                status: 'initializing',
                progress: 0,
                logs: [],
                message: '',
                queuedCount: 0,
                processedCount: 0,
                failedCount: 0
            });
            return;
        }

        const controller = new AbortController();
        let mounted = true;

        const startStream = async () => {
            setState(prev => ({ ...prev, status: 'pending', message: 'Connecting to stream...' }));

            // Initial status update
            try {
                // We use the helper but override handlers to update local state
                await monitorJobStream(jobId, {
                    signal: controller.signal,
                    onProgress: (pct) => {
                        if (mounted) setState(prev => ({ ...prev, progress: pct }));
                    },
                    onStatus: (statusStr, msg) => {
                        if (!mounted) return;

                        // normalize status string if needed
                        let status: JobStreamState['status'] = 'processing';
                        if (statusStr.includes('complete')) status = 'completed';
                        else if (statusStr.includes('fail')) status = 'failed';
                        else if (statusStr.includes('pending')) status = 'pending';

                        setState(prev => ({
                            ...prev,
                            status,
                            message: msg || prev.message
                        }));
                    },
                    onMeta: (meta) => {
                        if (!mounted) return;
                        setState(prev => ({
                            ...prev,
                            queuedCount: meta.queued_count ?? prev.queuedCount,
                            processedCount: meta.processed_count ?? prev.processedCount,
                            failedCount: meta.failed_count ?? prev.failedCount,
                            // If total_urls is in meta, maybe queued_count
                        }));
                    },
                    onLog: (log) => {
                        if (mounted) setState(prev => ({
                            ...prev,
                            logs: [...prev.logs, log],
                            // Also update message if it's a log event to show latest activity
                            message: log.type === 'error' ? log.message : prev.message
                        }));
                    },
                    onError: (err) => {
                        if (mounted) setState(prev => ({
                            ...prev,
                            status: 'failed',
                            message: err,
                            logs: [...prev.logs, { timestamp: new Date().toISOString(), message: err, type: 'error' }]
                        }));
                    },
                    onComplete: () => {
                        if (mounted) setState(prev => ({ ...prev, status: 'completed', progress: 100 }));
                    }
                });
            } catch (e) {
                if (mounted) console.error("Hook stream failed", e);
            }
        };

        startStream();

        return () => {
            mounted = false;
            controller.abort();
        };
    }, [jobId]);

    return state;
}
