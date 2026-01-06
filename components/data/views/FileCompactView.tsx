import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatBytes } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { CheckSquare, Copy, Download, Edit3, Eye, EyeOff, Fullscreen, RefreshCcw, Share2, Trash2 } from "lucide-react";
import FileIcon from "../FileIcon";
import { FileViewProps } from "./types";
import { toast } from "sonner";

export function FileCompactView({ files, selectedFiles, actions }: FileViewProps) {
    return (
        <div className="flex flex-col gap-2">
            {files.map((file) => (
                <div
                    key={file.id}
                    className={`flex group justify-between items-center p-3 rounded-lg hover:bg-muted/50 transition-colors ${selectedFiles.has(file.id) ? "border-1 border-blue-500" : "border border-muted"}`}
                >
                    <div className="flex items-center gap-3 truncate">
                        <div className="w-8 h-8 bg-muted rounded-md flex items-center justify-center mr-2">
                            <button onClick={() => actions.onToggleSelection(file.id)}>
                                {selectedFiles.has(file.id) ? <CheckSquare className="text-blue-500" /> : <FileIcon fileType={file.filename} />}
                            </button>
                        </div>
                        <div className="truncate hover:cursor-pointer"
                            onClick={() => actions.onPreview(file)}
                        >
                            <p className="text-sm font-medium truncate max-w-[200px] sm:max-w-none">
                                {file.filename}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-none">
                                {formatBytes(file.size)} • {formatDistanceToNow(new Date(file?.uploaded_at), { addSuffix: true })}
                            </p>
                        </div>
                    </div>

                    {/* Action Menu for Compact View */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <span className="sr-only">Menu</span>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => actions.onPreview(file)}>
                                <Fullscreen className="mr-2 h-4 w-4" /> Preview File
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => actions.onDownload(file)}>
                                <Download className="mr-2 h-4 w-4" /> Download File
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => actions.onRename(file)}>
                                <Edit3 className="mr-2 h-4 w-4" /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => actions.onCopyLink(file)}>
                                <Copy className="mr-2 h-4 w-4" /> Copy Link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => actions.onUpdateThumbnail(file)}>
                                <RefreshCcw className="mr-2 h-4 w-4" /> Update Thumbnail
                            </DropdownMenuItem>
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
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => actions.onDelete(file)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ))}
        </div>
    );
}
