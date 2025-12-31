import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBytes } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Copy, Download, Edit3, Eye, EyeOff, FileWarning, Fullscreen, Share2, Trash2 } from "lucide-react";
import FileIcon from "../FileIcon";
import { FileViewProps } from "./types";
import { toast } from "sonner";

export function FileListView({ files, selectedFiles, actions }: FileViewProps) {
    return (
        <div className="rounded-xl border shadow-sm bg-card overflow-hidden">
            <Table>
                <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent border-b border-border/50">
                        <TableHead className="w-[50px]">
                            <div className="flex items-center justify-center">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            actions.onSelectAll();
                                        } else {
                                            actions.onClearSelection();
                                        }
                                    }}
                                    checked={selectedFiles.size === files.length && files.length > 0}
                                />
                            </div>
                        </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-[100px]">Size</TableHead>
                        <TableHead className="hidden md:table-cell w-[150px]">Uploaded</TableHead>
                        <TableHead className="hidden md:table-cell w-[100px]">Visibility</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {files.map((file) => (
                        <TableRow
                            key={file.id}
                            className={`group transition-colors ${selectedFiles.has(file.id)
                                ? 'bg-primary/5 hover:bg-primary/10'
                                : 'hover:bg-muted/50'
                                }`}
                        >
                            <TableCell>
                                <div className="flex items-center justify-center">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        checked={selectedFiles.has(file.id)}
                                        onChange={() => actions.onToggleSelection(file.id)}
                                    />
                                </div>
                            </TableCell>
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-muted/50 rounded-lg">
                                        <FileIcon fileType={file.filename} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span
                                            className="truncate max-w-[200px] md:max-w-[300px] lg:max-w-[400px] cursor-pointer hover:text-primary transition-colors"
                                            onClick={() => actions.onPreview(file)}
                                        >
                                            {file.filename}
                                        </span>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground font-mono text-xs">{formatBytes(file.size)}</TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                                {formatDistanceToNow(new Date(file?.uploaded_at), { addSuffix: true })}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${file.is_public ? "bg-green-50 text-green-700 ring-1 ring-green-600/20" : "bg-gray-100 text-gray-700 ring-1 ring-gray-600/20"
                                    }`}>
                                    {file.is_public ? "Public" : "Private"}
                                </span>
                            </TableCell>
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                            <span className="sr-only">Open menu</span>
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-4 w-4"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <circle cx="12" cy="12" r="1" />
                                                <circle cx="12" cy="5" r="1" />
                                                <circle cx="12" cy="19" r="1" />
                                            </svg>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem onClick={() => actions.onPreview(file)}>
                                            <Fullscreen className="mr-2 h-4 w-4" />
                                            Preview File
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => actions.onDownload(file)}>
                                            <Download className="mr-2 h-4 w-4" />
                                            Download File
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => actions.onRename(file)}>
                                            <Edit3 className="mr-2 h-4 w-4" />  Rename
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => actions.onCopyLink(file)}>
                                            <Copy className="mr-2 h-4 w-4" />
                                            Copy Link
                                        </DropdownMenuItem>
                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger>
                                                <span className="flex flex-row items-center">
                                                    <Share2 className="mr-2 h-4 w-4" />
                                                    Share File
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
                                            {file.is_public ? (
                                                <EyeOff className="mr-2 h-4 w-4" />
                                            ) : (
                                                <Eye className="mr-2 h-4 w-4" />
                                            )}
                                            {file.is_public ? "Make Private" : "Make Public"}
                                        </DropdownMenuItem>

                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-red-500"
                                            onClick={() => actions.onDelete(file)}
                                        >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                    {files.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                    <FileWarning className="w-12 h-12 mb-2" />
                                    <p className="text-lg font-medium">No files found</p>
                                    <p className="text-sm">Upload some files to get started.</p>
                                </div>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
