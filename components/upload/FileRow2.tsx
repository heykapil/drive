'use client';

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { cn, formatBytes } from '@/lib/utils';
import {
    AlertCircle,
    Check,
    CheckCircle2,
    ChevronDown,
    FileIcon,
    FileText,
    ImageIcon,
    Loader2,
    MoreVertical,
    Music,
    Pencil,
    RefreshCw,
    Trash2,
    Video,
    X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface FileRowProps {
    file: File;
    displayName: string;
    progressData: {
        progress: number;
        uploadedParts: string;
        totalUploaded: number;
        partProgress?: Record<number, number>;
        totalParts?: number;
        chunkSizes?: number;
    };
    fileType: string;
    uploadStatus?: string;
    isUploading: boolean;
    onFileNameChange: (newName: string) => void;
    onCancel: () => void;
    onRetry?: () => void;
    error?: string | null;
}

const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="h-6 w-6 text-purple-500" />;
    if (type.startsWith('video/')) return <Video className="h-6 w-6 text-red-500" />;
    if (type.startsWith('audio/')) return <Music className="h-6 w-6 text-yellow-500" />;
    if (type.includes('pdf')) return <FileText className="h-6 w-6 text-orange-500" />;
    return <FileIcon className="h-6 w-6 text-blue-500" />;
};

export function FileRow2({
    file,
    displayName,
    progressData,
    fileType,
    uploadStatus,
    isUploading,
    onFileNameChange,
    onCancel,
    onRetry,
    error,
}: FileRowProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempName, setTempName] = useState(displayName);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        setTempName(displayName);
    }, [displayName]);

    const hasError = !!error;
    const isComplete = progressData.progress === 100 && !hasError;

    const handleSave = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (tempName.trim() && tempName !== displayName) {
            onFileNameChange(tempName);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        e.stopPropagation();
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') {
            setTempName(displayName);
            setIsEditing(false);
        }
    };

    return (
        <div className={cn(
            "group relative border rounded-2xl overflow-hidden transition-all duration-300",
            "bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl",
            hasError ? "border-red-200 dark:border-red-900/50 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]" : "border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
        )}>
            {/* Main Row */}
            <div className="p-4 flex items-center gap-5">
                {/* Icon Container */}
                <div className={cn(
                    "h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-500 shrink-0 shadow-sm",
                    hasError ? "bg-red-50 dark:bg-red-950/30" : "bg-white dark:bg-zinc-800/50 group-hover:scale-105"
                )}>
                    {isUploading ? (
                        <div className="relative">
                            <Loader2 className="h-7 w-7 animate-spin text-primary" />
                            <div className="absolute inset-0 animate-ping opacity-20 bg-primary rounded-full" />
                        </div>
                    ) : isComplete ? (
                        <CheckCircle2 className="h-7 w-7 text-green-500 animate-in zoom-in duration-300" />
                    ) : hasError ? (
                        <AlertCircle className="h-7 w-7 text-red-500" />
                    ) : (
                        getFileIcon(fileType)
                    )}
                </div>

                {/* Info Section */}
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-3">
                        {isEditing ? (
                            <div className="flex items-center gap-2 flex-1 animate-in fade-in slide-in-from-left-2" onClick={e => e.stopPropagation()}>
                                <Input
                                    value={tempName}
                                    onChange={(e) => setTempName(e.target.value)}
                                    className="h-8 text-sm font-medium bg-background/80"
                                    autoFocus
                                    onKeyDown={handleKeyDown}
                                />
                                <div className="flex gap-1">
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-500 hover:bg-green-500/10" onClick={handleSave}>
                                        <Check className="h-4 w-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-500/10" onClick={() => { setIsEditing(false); setTempName(displayName); }}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="font-semibold text-sm truncate text-foreground/90 tracking-tight" title={displayName}>
                                    {displayName}
                                </span>
                                {!isUploading && !isComplete && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                                        onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                                    >
                                        <Pencil className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                        <span className="bg-secondary/50 px-2 py-0.5 rounded-md text-foreground/70 uppercase tracking-wider text-[10px]">
                            {fileType.split('/').pop()?.toUpperCase() || 'FILE'}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-border" />
                        <span>{formatBytes(file.size)}</span>
                        {hasError && (
                            <>
                                <span className="w-1 h-1 rounded-full bg-red-500" />
                                <span className="text-red-500 truncate max-w-[200px]">{error}</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-3 shrink-0">
                    {isUploading && (
                        <div className="flex flex-col items-end gap-1 min-w-[80px]">
                            <span className="text-xs font-bold text-primary tabular-nums">
                                {progressData.progress.toFixed(0)}%
                            </span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                {uploadStatus || 'Uploading'}
                            </span>
                        </div>
                    )}

                    {hasError && onRetry && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); onRetry(); }}
                            className="h-8 px-3 text-xs border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-red-900/50 dark:hover:bg-red-950/50"
                        >
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
                        </Button>
                    )}

                    {!isComplete && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} disabled={isUploading}>
                                    <Pencil className="mr-2 h-4 w-4" /> Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={(e) => { e.stopPropagation(); onCancel(); }}
                                    className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" /> {isUploading ? 'Cancel' : 'Remove'}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            <div className="px-4 pb-1">
                <Progress
                    value={progressData.progress}
                    className={cn(
                        "h-1.5 bg-secondary/50",
                        hasError && "[&>div]:bg-red-500",
                        isComplete && "[&>div]:bg-green-500"
                    )}
                />
            </div>

            {/* Detailed Progress Accordion */}
            {progressData.totalParts && progressData.totalParts > 1 && (
                <Accordion type="single" collapsible value={isExpanded ? "details" : ""} onValueChange={(v) => setIsExpanded(!!v)}>
                    <AccordionItem value="details" className="border-0">
                        <AccordionTrigger className="px-4 py-2 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary hover:no-underline data-[state=open]:bg-secondary/30 transition-colors">
                            <span className="flex items-center gap-2">
                                {isExpanded ? 'Hide Details' : 'Show Part Details'}
                                <span className="bg-secondary px-1.5 rounded text-foreground/70">
                                    {progressData.uploadedParts}
                                </span>
                            </span>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 pt-2 bg-secondary/10">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                {Array.from({ length: progressData.totalParts }).map((_, i) => {
                                    const partNum = i + 1;
                                    const bytesUploaded = progressData.partProgress?.[partNum] || 0;
                                    const chunkSize = progressData.chunkSizes || 5 * 1024 * 1024;
                                    // Last part calculation is tricky without exact file size logic here, but approximation is fine for UI
                                    const percent = Math.min(100, Math.round((bytesUploaded / chunkSize) * 100));
                                    const isDone = isComplete || percent >= 100;

                                    return (
                                        <div key={partNum} className="flex items-center gap-3 bg-background/50 p-2 rounded-lg border border-border/50">
                                            <div className="flex flex-col gap-0.5 flex-1">
                                                <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                                                    <span>Part {partNum}</span>
                                                    <span className={cn(isDone ? "text-green-500" : "text-primary")}>
                                                        {isDone ? "Done" : `${percent}%`}
                                                    </span>
                                                </div>
                                                <Progress
                                                    value={isDone ? 100 : percent}
                                                    className="h-1 bg-secondary"
                                                    // @ts-ignore
                                                    color={isDone ? "#22c55e" : undefined}
                                                />
                                            </div>
                                            {isDone ? (
                                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                                            ) : (
                                                <div className="h-3.5 w-3.5 rounded-full border-2 border-primary/30 border-t-primary animate-spin shrink-0" />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            )}
        </div>
    );
}