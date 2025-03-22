"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useBucketStore } from "@/hooks/use-bucket-store";
import { calculateChunkSize } from "@/lib/helpers/chunk-size";
import { cn, formatBytes, getFileType } from "@/lib/utils";
import axios from 'axios';
import { useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import FileIcon from "../data/FileIcon";

const FILE_SIZE_THRESHOLD = 5 * 1024 * 1024; // 5MB
const PREVIEW_SIZE_LIMIT = 10 * 1024 * 1024; // 10MB

interface FileState {
  files: File[];
  uploading: boolean;
  fileNames: Record<string, string>;
  uploadProgress: Record<string, Record<number, number>>;
  totalParts: Record<string, number>;
  chunkSizes: Record<string, number>;
}

export default function FileUpload() {
  const { selectedBucket } = useBucketStore();
  const [state, setState] = useState<FileState>({
    files: [],
    uploading: false,
    fileNames: {},
    uploadProgress: {},
    totalParts: {},
    chunkSizes: {},
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
      fileNames: acceptedFiles.reduce((acc, file) => ({
        ...acc,
        [file.name]: file.name
      }), prev.fileNames),
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
    if (abortControllers.current[fileName]) {
      abortControllers.current[fileName].forEach(controller => controller.abort());
      delete abortControllers.current[fileName];
    }

    setState(prev => ({
      ...prev,
      files: prev.files.filter(f => f.name !== fileName),
      fileNames: Object.fromEntries(
        Object.entries(prev.fileNames).filter(([key]) => key !== fileName)
      ),
      uploadProgress: Object.fromEntries(
        Object.entries(prev.uploadProgress).filter(([key]) => key !== fileName)
      ),
      totalParts: Object.fromEntries(
        Object.entries(prev.totalParts).filter(([key]) => key !== fileName)
      ),
      chunkSizes: Object.fromEntries(
        Object.entries(prev.chunkSizes).filter(([key]) => key !== fileName)
      ),
    }));
  };

  const uploadFiles = async () => {
    setState(prev => ({ ...prev, uploading: true }));

    try {
      await Promise.all(state.files.map(async (file) => {
        if (!state.files.some(f => f.name === file.name)) return;
        const updatedFileName = state.fileNames[file.name] || file.name;
        const renamedFile = new File([file], updatedFileName, { type: file.type });

        if (renamedFile.size <= FILE_SIZE_THRESHOLD) {
          await uploadSimple(renamedFile);
        } else {
          await uploadMultipart(renamedFile);
        }
        handleCancel(file.name);
      }));
    } finally {
      setState(prev => ({ ...prev, uploading: false }));
    }
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
      if (!simRes.success) throw new Error(simRes.error);
      toast.success(`${file.name} uploaded successfully!`);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        toast.error(`Failed to upload ${file.name}: ${e.message}`);
        throw e;
      }
    }
  };

  const uploadMultipart = async (file: File) => {
    let uploadId: string, key: string;
    const controllers: AbortController[] = [];

    try {
      // Initiate upload
      const initRes = await fetch(`/api/upload/multipart/initiate?bucket=${selectedBucket}`, {
        method: "POST",
        body: JSON.stringify({ filename: file.name, contentType: getFileType(file) }),
      });

      ({ uploadId, key } = await initRes.json());
      if (!uploadId) throw new Error("Failed to initiate upload");

      // Calculate chunk size and total parts
      const chunkSize = calculateChunkSize(file.size);
      const totalParts = Math.ceil(file.size / chunkSize);

      // Initialize progress tracking
      setState(prev => ({
        ...prev,
        totalParts: { ...prev.totalParts, [file.name]: totalParts },
        chunkSizes: { ...prev.chunkSizes, [file.name]: chunkSize },
        uploadProgress: {
          ...prev.uploadProgress,
          [file.name]: Array.from({ length: totalParts }, (_, i) => i + 1).reduce((acc, part) => {
            acc[part] = 0;
            return acc;
          }, {} as Record<number, number>),
        },
      }));

      // Upload parts with concurrency control
      const concurrentUploads = 3;
      const uploadQueue: Promise<{ PartNumber: number; ETag: string }>[] = [];

      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        if (uploadQueue.length >= concurrentUploads) {
          await Promise.all(uploadQueue);
          uploadQueue.length = 0;
        }

        uploadQueue.push(
          uploadChunk(file, partNumber, chunkSize, uploadId, key)
        );
      }

      const parts = await Promise.all(uploadQueue);

      // Complete upload
      await completeMultipartUpload(file, uploadId, key, parts);
      toast.success(`${file.name} uploaded successfully!`);
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
  ): Promise<{ PartNumber: number; ETag: string }> => {
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

      // Upload chunk with progress tracking
      await axios.put(url, chunk, {
        signal: controller.signal,
        onUploadProgress: (progressEvent) => {
          setState(prev => ({
            ...prev,
            uploadProgress: {
              ...prev.uploadProgress,
              [file.name]: {
                ...prev.uploadProgress[file.name],
                [partNumber]: progressEvent.loaded,
              }
            },
          }));
        },
      });

      // Mark part as fully uploaded
      setState(prev => ({
        ...prev,
        uploadProgress: {
          ...prev.uploadProgress,
          [file.name]: {
            ...prev.uploadProgress[file.name],
            [partNumber]: chunk.size,
          }
        },
      }));

      return { PartNumber: partNumber, ETag: 'etag' };
    } catch (error: any) {
      if (error.name !== 'AbortError') throw error;
      return { PartNumber: partNumber, ETag: 'aborted' };
    }
  };

  const completeMultipartUpload = async (
    file: File,
    uploadId: string,
    key: string,
    parts: { PartNumber: number; ETag: string }[]
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

  const getUploadProgress = (file: File) => {
    const totalParts = state.totalParts[file.name] || 0;
    const chunkSize = state.chunkSizes[file.name] || 0;
    const progressData = state.uploadProgress[file.name] || {};

    // Calculate total uploaded bytes
    const totalUploaded = Object.values(progressData).reduce((sum, bytes) => sum + bytes, 0);
    const progress = (totalUploaded / file.size) * 100;

    // Calculate completed parts
    const completedParts = Object.entries(progressData).reduce((count, [partStr, bytes]) => {
      const partNumber = parseInt(partStr);
      const isLastPart = partNumber === totalParts;
      const partSize = isLastPart ? file.size - (chunkSize * (partNumber - 1)) : chunkSize;
      return count + (bytes >= partSize ? 1 : 0);
    }, 0);

    return {
      progress: Math.min(100, progress),
      uploadedParts: `${completedParts}/${totalParts}`,
      totalUploaded,
    };
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
          const { progress, uploadedParts, totalUploaded } = getUploadProgress(file);

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
                    value={progress}
                    className={cn(
                      "h-2 w-full rounded-lg transition-all",
                      "after:bg-blue-500 dark:after:bg-blue-400"
                    )}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {progress.toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {getFileType(file)} | {formatBytes(file.size)} |
                  <span> Parts: {uploadedParts}</span> |
                  <span> {formatBytes(totalUploaded)}</span>
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
