"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useBucketStore } from "@/hooks/use-bucket-store";
import { cn, formatBytes, getFileType } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import FileIcon from "../data/FileIcon";

const FILE_SIZE_THRESHOLD = 5 * 1024 * 1024; // 5MB
const PREVIEW_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB

interface FileState {
  files: File[];
  progress: Record<string, number>;
  uploading: boolean;
  fileNames: Record<string, string>;
}

export default function FileUpload() {
  const { selectedBucketName: selectedBucket } = useBucketStore();
  const [state, setState] = useState<FileState>({
    files: [],
    progress: {},
    uploading: false,
    fileNames: {},
  });
  const abortControllers = useRef<Record<string, AbortController[]>>({});

  // Paste functionality
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        onDrop(files);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const onDrop = (acceptedFiles: File[]) => {
    setState(prev => ({
      ...prev,
      files: [...prev.files, ...acceptedFiles],
      fileNames: acceptedFiles.reduce((acc, file) => {
        acc[file.name] = file.name;
        return acc;
      }, { ...prev.fileNames }),
    }));
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    multiple: true,
    maxSize: 1024 * 1024 * 1024,
  });

  const handleFileNameChange = (oldName: string, newName: string) => {
    if (!newName || newName === oldName) return;
    const ext = oldName.split(".").pop();
    const newFileName = newName.includes(".") ? newName : `${newName}.${ext}`;
    setState(prev => ({
      ...prev,
      fileNames: { ...prev.fileNames, [oldName]: newFileName },
    }));
  };

  const handleCancel = (fileName: string) => {
    // Abort ongoing uploads
    if (abortControllers.current[fileName]) {
      abortControllers.current[fileName].forEach(controller => controller.abort());
      delete abortControllers.current[fileName];
    }

    setState(prev => ({
      ...prev,
      files: prev.files.filter(f => f.name !== fileName),
      progress: Object.fromEntries(
        Object.entries(prev.progress).filter(([key]) => key !== fileName)
      ),
      fileNames: Object.fromEntries(
        Object.entries(prev.fileNames).filter(([key]) => key !== fileName)
      ),
    }));
  };

  const uploadFiles = async () => {
    setState(prev => ({ ...prev, uploading: true }));

    const filesToUpload = [...state.files];

    for (const file of filesToUpload) {
      // Check if file still exists in state
      if (!state.files.some(f => f.name === file.name)) continue;
      const updatedFileName = state.fileNames[file.name] || file.name;
      const renamedFile = new File([file], updatedFileName, { type: file.type });

      setState(prev => ({
            ...prev,
            progress: {
              ...prev.progress,
              [renamedFile.name]: 0,
            },
          }));

      try {
        if (renamedFile.size <= FILE_SIZE_THRESHOLD) {
          await uploadSimple(renamedFile);
        } else {
          await uploadMultipart(renamedFile);
        }
      } catch (error) {
        console.error('Upload error:', error);
        continue;
      }

      handleCancel(file.name);
    }

    setState(prev => ({ ...prev, uploading: false }));
  };

  const uploadSimple = async (file: File) => {
    const controller = new AbortController();
    abortControllers.current[file.name] = [controller];

    try {
      toast.info(`Uploading ${file.name}...`);
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/upload/simple?bucket=${selectedBucket}`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      const simRes = await response.json();
      if (!simRes.success) {
        toast.error(`Error: ${simRes.error}`);
        throw new Error(simRes.error);
      }
      toast.success(`${file.name} uploaded successfully!`);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        toast.error("Failed to upload file");
        throw e;
      }
    }
  };

  const uploadMultipart = async (file: File) => {
    let uploadId: string, key: string;
    const controllers: AbortController[] = [];

    try {
      toast.info('Preparing for multipart upload of the file...', {
        description: file.name
      })
      // Initiate upload
      const initRes = await fetch(`/api/upload/multipart/initiate?bucket=${selectedBucket}`, {
        method: "POST",
        body: JSON.stringify({ filename: file.name, contentType: getFileType(file) }),
      });

      ({ uploadId, key } = await initRes.json());
      if (!uploadId) throw new Error("Failed to initiate upload");
      toast.info('Preparing for presigned urls..',{
        description: file.name
      })
      // Dynamic chunk sizing
      const chunkSize = calculateChunkSize(file.size);
      const totalParts = Math.ceil(file.size / chunkSize);
      const parts: { PartNumber: number; ETag: string }[] = [];

      // Upload chunks with controlled concurrency
      const concurrentUploads = 3;
      const uploadQueue: Promise<void>[] = [];

      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        if (uploadQueue.length >= concurrentUploads) {
          await Promise.all(uploadQueue);
          uploadQueue.length = 0;
          await new Promise(resolve => setTimeout(resolve, 0)); // Yield to UI
        }

        uploadQueue.push(
          uploadChunk(file, partNumber, chunkSize, uploadId, key, parts, totalParts)
        );
      }

      await Promise.all(uploadQueue);

      // Complete upload
      await completeMultipartUpload(file, uploadId, key, parts);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        toast.error(`Upload failed: ${error.message}`);
      }
      throw error;
    } finally {
      controllers.forEach(controller => controller.abort());
    }
  };

  const uploadChunk = async (
    file: File,
    partNumber: number,
    chunkSize: number,
    uploadId: string,
    key: string,
    parts: any[],
    totalParts: number
  ) => {
    const controller = new AbortController();
    if (!abortControllers.current[file.name]) {
      abortControllers.current[file.name] = [];
    }
    abortControllers.current[file.name].push(controller);

    try {
      const start = (partNumber - 1) * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);

      // Get presigned URL
      const presignRes = await fetch(`/api/upload/multipart/presign?bucket=${selectedBucket}`, {
        method: "POST",
        body: JSON.stringify({ uploadId, key, partNumber }),
      });

      const { url } = await presignRes.json();
      if (!url) toast.error(`Failed to get presigned URL for part ${partNumber}`);
      // toast.success('Presigned url generated for ' + partNumber)
      // Upload chunk
      const uploadRes = await fetch(url, {
        method: "PUT",
        body: chunk,
        signal: controller.signal,
      });

      if (!uploadRes.ok) toast.error(`Upload failed for part ${partNumber}`);
      const eTag = uploadRes.headers.get("ETag")?.replace(/"/g, "") || '';
      toast.success( `Chunk uploaded for ${file.name}`, {
        description: `Chunk: ${partNumber}/${totalParts}`
      })
      parts.push({ PartNumber: partNumber, ETag: eTag });

      // Update progress
      setState(prev => ({
        ...prev,
        progress: {
          ...prev.progress,
          [file.name]: Math.round((parts.length / totalParts) * 100),
        },
      }));
    } catch (error: any) {
      if (error.name !== 'AbortError') throw error;
    }
  };

  const completeMultipartUpload = async (
    file: File,
    uploadId: string,
    key: string,
    parts: any[]
  ) => {
    const finalRes = await fetch(`/api/upload/multipart/complete?bucket=${selectedBucket}`, {
      method: "POST",
      body: JSON.stringify({
        uploadId,
        key,
        parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
        filename: file.name,
        size: file.size,
        type: file.type
      }),
    });

    if (!(await finalRes.json()).success) {
      throw new Error("Failed to complete multipart upload");
    }
  };

  return (
    <div className="space-y-4 p-4 lg:ml-4 border rounded-lg">
      <div {...getRootProps()} className="border-dashed border-2 px-6 py-36 text-center cursor-pointer bg-background rounded-lg">
        <input {...getInputProps()} />
        <p>Drag & drop files here, or click to select (Ctrl/Cmd+V to paste)</p>
      </div>
      <div className="space-y-2">
        {state.files.map((file) => {
          const displayName = state.fileNames[file.name] || file.name;
          return (
            <div key={file.name} className="flex items-center gap-2 p-2 border rounded-lg">
              {file.size <= PREVIEW_SIZE_LIMIT && file.type.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt={displayName}
                  className="rounded-md w-10 h-10 object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-md flex items-center justify-center">
                  <FileIcon fileType={file.name} />
                </div>
              )}
              <div className="flex-1 space-y-1">
                <div className="flex gap-2">
                  <Input
                    value={displayName}
                    onChange={(e) => handleFileNameChange(file.name, e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleCancel(file.name)}
                    disabled={state.uploading}
                  >
                    Cancel
                  </Button>
                </div>
                <div className="w-full flex items-center gap-2">
                  <Progress
                    value={state.progress[displayName] || 0}
                    className={cn(
                      "h-2 w-full rounded-lg transition-all",
                      "after:bg-blue-500 dark:after:bg-blue-400" // Progress bar color
                    )}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{state.progress[displayName] || 0}%</span>
                </div>
                <p className="text-xs text-gray-500">
                  {getFileType(file)} | {formatBytes(file.size)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <Button
        onClick={uploadFiles}
        disabled={state.files.length === 0 || state.uploading}
      >
        {state.uploading ? "Uploading..." : `Upload to ${selectedBucket}`}
      </Button>
    </div>
  );
}

function calculateChunkSize(fileSize: number): number {
  const chunkSizeMap = [
    { limit: 100 * 1024 * 1024, size: 5 * 1024 * 1024 },
    { limit: 500 * 1024 * 1024, size: 15 * 1024 * 1024 },
    { limit: 1024 * 1024 * 1024, size: 25 * 1024 * 1024 },
  ];

  return chunkSizeMap.find(({ limit }) => fileSize < limit)?.size || 50 * 1024 * 1024;
}
