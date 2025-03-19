'use client'
import { cn, formatBytes } from "@/lib/utils";
import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Progress } from "./ui/progress";


interface FileRowProps {
  file: File;
  displayName: string;
  progressData: { progress: number; uploadedParts: string; totalUploaded: number };
  fileType: string;
  uploadStatus?: string;
  isUploading: boolean;
  onFileNameChange: (newName: string) => void;
  onCancel: () => void;
}

export function FileRow({
  file,
  displayName,
  progressData,
  fileType,
  uploadStatus,
  isUploading,
  onFileNameChange,
  onCancel,
}: FileRowProps) {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [tempName, setTempName] = useState<string>(displayName);

  return (
    <div className="flex items-center gap-2 p-2 border rounded-lg">
      <div className="flex-1 space-y-1">
        <div className="flex gap-2 items-center">
          {isEditing ? (
            <>
              <Input
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                className="flex-1"
              />
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  onFileNameChange(tempName);
                  setIsEditing(false);
                }}
              >
                Save
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <span className="flex-1">{displayName}</span>
              <Button variant="default" size="sm" onClick={() => setIsEditing(true)} disabled={isUploading}>
                Edit
              </Button>
              <Button variant="destructive" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            </>
          )}
        </div>
        <div className="w-full flex items-center gap-2">
          <Progress
            value={progressData.progress}
            className={cn("h-2 w-full rounded-lg transition-all", "after:bg-blue-500 dark:after:bg-blue-400")}
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {progressData.progress.toFixed(0)}%
          </span>
        </div>
        <p className="text-xs text-primary/70">
          {fileType} | {uploadStatus ? `Uploaded: ${formatBytes(progressData.totalUploaded)} of ${formatBytes(file.size)} (Parts: ${progressData.uploadedParts})` : 'Waiting for upload...'}
          {uploadStatus ? ` | ${uploadStatus}` : ""}
        </p>
      </div>
    </div>
  );
}
