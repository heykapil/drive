import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatBytes } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { CheckSquare, Copy, Edit3, Eye, EyeOff, Fullscreen, Share2, Trash2 } from "lucide-react";
import { VideoPlayer } from "../../viewer/VideoPlayer";
import FileIcon from "../FileIcon";
import { FileViewProps } from "./types";
import { toast } from "sonner";

export function FileGridView({ files, selectedFiles, actions }: FileViewProps) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {files.map((file) => (
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
                            actions.onToggleSelection(file.id);
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
                                onClick={() => actions.onPreview(file)}
                            >
                                <Fullscreen className="w-4 h-4" />
                            </Button>
                            <Button
                                size="icon"
                                variant="secondary"
                                className="h-8 w-8 rounded-full bg-white/90 hover:bg-white text-black shadow-sm"
                                onClick={() => actions.onCopyLink(file)}
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
                                    <DropdownMenuItem onClick={() => actions.onRename(file)}>
                                        <Edit3 className="mr-2 h-4 w-4" /> Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-destructive" onClick={() => actions.onDelete(file)}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                    </DropdownMenuItem>

                                    {/* Added Share and Privacy options to Grid View context menu as well for consistency */}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>
                                            <span className="flex flex-row items-center">
                                                <Share2 className="mr-2 h-4 w-4" /> Share
                                            </span>
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuPortal>
                                            <DropdownMenuSubContent>
                                                {[1, 7, 30, 180, 365].map((days) => (
                                                    <DropdownMenuItem
                                                        key={days}
                                                        onClick={() => toast.promise(new Promise((resolve) => {
                                                            actions.onShare(file, days);
                                                            resolve(true);
                                                        }), {
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

                                    <DropdownMenuItem onClick={() => actions.onTogglePrivacy(file)}>
                                        {file.is_public ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                                        {file.is_public ? "Make Private" : "Make Public"}
                                    </DropdownMenuItem>

                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{formatBytes(file.size)}</span>
                            <span>{formatDistanceToNow(new Date(file?.uploaded_at), { addSuffix: true })}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
