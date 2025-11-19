'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatBytes } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

interface FileDiff {
    key: string;
    size: number;
    lastModified: string;
    bucketId: number;
    bucketName: string;
    url: string | null;
}

interface DiffTableProps {
    files: FileDiff[];
    onSync: (selectedFiles: FileDiff[]) => Promise<void>;
    isSyncing: boolean;
}

export function DiffTable({ files, onSync, isSyncing }: DiffTableProps) {
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

    const toggleSelectAll = () => {
        if (selectedFiles.size === files.length) {
            setSelectedFiles(new Set());
        } else {
            setSelectedFiles(new Set(files.map((f) => f.key)));
        }
    };

    const toggleSelect = (key: string) => {
        const newSelected = new Set(selectedFiles);
        if (newSelected.has(key)) {
            newSelected.delete(key);
        } else {
            newSelected.add(key);
        }
        setSelectedFiles(newSelected);
    };

    const handleSync = () => {
        const filesToSync = files.filter((f) => selectedFiles.has(f.key));
        onSync(filesToSync);
        // Optionally clear selection after sync, but let the parent handle data refresh
    };

    if (files.length === 0) {
        return <div className="text-center py-10 text-muted-foreground">No missing files found. Everything is in sync!</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    {selectedFiles.size} of {files.length} files selected
                </div>
                <Button
                    onClick={handleSync}
                    disabled={selectedFiles.size === 0 || isSyncing}
                >
                    {isSyncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sync Selected
                </Button>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">
                                <Checkbox
                                    checked={files.length > 0 && selectedFiles.size === files.length}
                                    onCheckedChange={toggleSelectAll}
                                />
                            </TableHead>
                            <TableHead>Key</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Bucket</TableHead>
                            <TableHead>Last Modified</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {files.map((file) => (
                            <TableRow key={file.key}>
                                <TableCell>
                                    <Checkbox
                                        checked={selectedFiles.has(file.key)}
                                        onCheckedChange={() => toggleSelect(file.key)}
                                    />
                                </TableCell>
                                <TableCell className="font-mono text-sm">{file.key}</TableCell>
                                <TableCell>{formatBytes(file.size)}</TableCell>
                                <TableCell>{file.bucketName}</TableCell>
                                <TableCell>{new Date(file.lastModified).toLocaleString()}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
