"use client";

import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useBucketStore } from "@/hooks/use-bucket-store";
import { calculateChunkSize } from "@/lib/helpers/chunk-size";
import { runPromisePool } from "@/lib/helpers/promise-pool";
import { getFileType, getFileTypeFromFilename } from "@/lib/utils";
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { FileRow } from "./FileRow";

const FILE_SIZE_THRESHOLD = 5 * 1024 * 1024; // 5MB
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // base delay in ms
const DEFAULT_CONTENT_TYPE = "application/octet-stream";

interface FileState {
  files: File[];
  uploadingFiles: Record<string, boolean>;
  fileNames: Record<string, string>;
  uploadProgress: Record<string, Record<number, number>>;
  totalParts: Record<string, number>;
  chunkSizes: Record<string, number>;
  uploadStatus: Record<string, string>;
}

interface UploadPart {
  PartNumber: number;
  ETag: string;
}

export default function FileUpload() {
  const { selectedBucket } = useBucketStore();
  const [state, setState] = useState<FileState>({
    files: [],
    uploadingFiles: {},
    fileNames: {},
    uploadProgress: {},
    totalParts: {},
    chunkSizes: {},
    uploadStatus: {},
  });

  // Concurrency states.
  const [maxConcurrentFiles, setMaxConcurrentFiles] = useState<number>(3);
  const [maxConcurrentChunks, setMaxConcurrentChunks] = useState<number>(3);

  // Abort controllers for canceling uploads.
  const abortControllers = useRef<Record<string, AbortController[]>>({});

  // Helper: update upload status.
  const updateUploadStatus = (fileName: string, status: string) => {
    setState((prev) => ({
      ...prev,
      uploadStatus: { ...prev.uploadStatus, [fileName]: status },
    }));
  };

  const handleFileUploadStart = (fileName: string) => {
    setState((prev) => ({
      ...prev,
      uploadingFiles: { ...prev.uploadingFiles, [fileName]: true },
    }));
    toast.info(`Starting upload for ${fileName}`);
  };

  const handleFileUploadEnd = (fileName: string) => {
    setState((prev) => ({
      ...prev,
      uploadingFiles: { ...prev.uploadingFiles, [fileName]: false },
    }));
  };

  // Handle file drop (or paste) events.
  const onDrop = (acceptedFiles: File[]) => {
    setState((prev) => {
      const newFileNames = acceptedFiles.reduce((acc, file) => {
        acc[file.name] = file.name;
        return acc;
      }, {} as Record<string, string>);
      return {
        ...prev,
        files: [...prev.files, ...acceptedFiles],
        fileNames: { ...prev.fileNames, ...newFileNames },
      };
    });
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    multiple: true,
    maxSize: 1024 * 1024 * 1024,
  });

  // Allow pasting files.
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = e.clipboardData.items;
      const files: File[] = [];
      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        onDrop(files);
      }
      // Clean up blob URLs for images.
      files.forEach((file) => {
        if (file.type.startsWith("image/")) {
          URL.revokeObjectURL(URL.createObjectURL(file));
        }
      });
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  // Update file name and corresponding state.
  const handleFileNameChange = (oldName: string, newName: string) => {
    if (!newName || newName === oldName) return;
    const ext = oldName.split(".").pop();
    const newFileName = newName.includes(".") ? newName : `${newName}.${ext}`;
    setState((prev) => {
      const updatedFiles = prev.files.map((file) =>
        file.name === oldName
          ? new File([file], newFileName, { type: file.type || DEFAULT_CONTENT_TYPE })
          : file
      );
      const updatedFileNames = { ...prev.fileNames };
      delete updatedFileNames[oldName];
      updatedFileNames[newFileName] = newFileName;

      const updatedUploadProgress = { ...prev.uploadProgress };
      if (oldName in updatedUploadProgress) {
        updatedUploadProgress[newFileName] = updatedUploadProgress[oldName];
        delete updatedUploadProgress[oldName];
      }
      const updatedTotalParts = { ...prev.totalParts };
      if (oldName in updatedTotalParts) {
        updatedTotalParts[newFileName] = updatedTotalParts[oldName];
        delete updatedTotalParts[oldName];
      }
      const updatedChunkSizes = { ...prev.chunkSizes };
      if (oldName in updatedChunkSizes) {
        updatedChunkSizes[newFileName] = updatedChunkSizes[oldName];
        delete updatedChunkSizes[oldName];
      }
      const updatedUploadStatus = { ...prev.uploadStatus };
      if (oldName in updatedUploadStatus) {
        updatedUploadStatus[newFileName] = updatedUploadStatus[oldName];
        delete updatedUploadStatus[oldName];
      }
      const updatedUploadingFiles = { ...prev.uploadingFiles };
      if (oldName in updatedUploadingFiles) {
        updatedUploadingFiles[newFileName] = updatedUploadingFiles[oldName];
        delete updatedUploadingFiles[oldName];
      }
      return {
        ...prev,
        files: updatedFiles,
        fileNames: updatedFileNames,
        uploadProgress: updatedUploadProgress,
        totalParts: updatedTotalParts,
        chunkSizes: updatedChunkSizes,
        uploadStatus: updatedUploadStatus,
        uploadingFiles: updatedUploadingFiles,
      };
    });
  };

  // Cancel upload and remove file from state.
  const handleCancel = (fileName: string) => {
    if (abortControllers.current[fileName]) {
      abortControllers.current[fileName].forEach((controller) => controller.abort());
      delete abortControllers.current[fileName];
    }
    setState((prev) => ({
      ...prev,
      files: prev.files.filter((f) => f.name !== fileName),
      fileNames: Object.fromEntries(Object.entries(prev.fileNames).filter(([key]) => key !== fileName)),
      uploadProgress: Object.fromEntries(Object.entries(prev.uploadProgress).filter(([key]) => key !== fileName)),
      totalParts: Object.fromEntries(Object.entries(prev.totalParts).filter(([key]) => key !== fileName)),
      chunkSizes: Object.fromEntries(Object.entries(prev.chunkSizes).filter(([key]) => key !== fileName)),
      uploadStatus: Object.fromEntries(Object.entries(prev.uploadStatus).filter(([key]) => key !== fileName)),
      uploadingFiles: Object.fromEntries(Object.entries(prev.uploadingFiles).filter(([key]) => key !== fileName)),
    }));
  };



  // Main file upload function.
  const uploadFiles = async () => {
    const fileTasks = state.files.map((file) => async () => {
      handleFileUploadStart(file.name);
      updateUploadStatus(file.name, "Initiating upload...");
      try {
        if (file.size <= FILE_SIZE_THRESHOLD) {
          await uploadSimple(file);
        } else {
          await uploadMultipart(file);
        }
        toast.success(`${file.name} uploaded successfully!`);
      } catch (error: any) {
        const errorMessage =
          error.name === "AbortError" ? "Upload cancelled" : error.message;
        toast.error(`Failed to upload ${file.name}: ${errorMessage}`);
      } finally {
        handleFileUploadEnd(file.name);
        handleCancel(file.name);
      }
    });
    try {
      await runPromisePool(fileTasks, maxConcurrentFiles);
    } catch (error: any) {
      toast.error(error?.message || "An unexpected error occurred during upload");
    }
  };

  // Simple upload for small files.
  const uploadSimple = async (file: File) => {
    const fileName = file.name;
    updateUploadStatus(fileName, "Uploading file...");
    const controller = new AbortController();
    abortControllers.current[fileName] = [controller];
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`/api/upload/simple?bucket=${selectedBucket}`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    const simRes = await response.json();
    if (!simRes.success) {
      throw new Error(simRes.error);
    }
  };

  // Multipart upload for large files.
  const uploadMultipart = async (file: File) => {
    const fileName = file.name;
    const contentType = getFileType(file) || file.type || getFileTypeFromFilename(fileName) || DEFAULT_CONTENT_TYPE;

    const initRes = await fetch(`/api/upload/multipart/initiate?bucket=${selectedBucket}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: fileName, contentType }),
    });
    if (!initRes.ok) throw new Error("Failed to initiate upload");
    const { uploadId, key } = await initRes.json();

    const chunkSize = calculateChunkSize(file.size);
    const totalParts = Math.ceil(file.size / chunkSize);

    setState((prev) => ({
      ...prev,
      totalParts: { ...prev.totalParts, [fileName]: totalParts },
      chunkSizes: { ...prev.chunkSizes, [fileName]: chunkSize },
      uploadProgress: {
        ...prev.uploadProgress,
        [fileName]: Array.from({ length: totalParts }, (_, i) => i + 1).reduce<Record<number, number>>(
          (acc, part) => ({ ...acc, [part]: 0 }),
          {}
        ),
      },
    }));

    const chunkTasks = [];
    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
      chunkTasks.push(() =>
        uploadChunk(file, partNumber, totalParts, chunkSize, uploadId, key, fileName)
      );
    }
    const parts: UploadPart[] = await runPromisePool(chunkTasks, maxConcurrentChunks);
    await completeMultipartUpload(file, uploadId, key,  contentType, parts, fileName);
  };

  // Upload a single chunk with retry logic.
  const uploadChunk = async (
    file: File,
    partNumber: number,
    totalParts: number,
    chunkSize: number,
    uploadId: string,
    key: string,
    fileName: string
  ): Promise<UploadPart> => {
    const controller = new AbortController();
    if (!abortControllers.current[fileName]) {
      abortControllers.current[fileName] = [];
    }
    abortControllers.current[fileName].push(controller);
    updateUploadStatus(fileName, `Uploading chunk ${partNumber} of ${totalParts}...`);
    let attempt = 0;
    while (attempt < MAX_RETRY_ATTEMPTS) {
      try {
        const start = (partNumber - 1) * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        const presignRes = await fetch(`/api/upload/multipart/presign?bucket=${selectedBucket}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId, key, partNumber }),
        });
        const { url } = await presignRes.json();
        const response = await axios.put(url, chunk, {
          signal: controller.signal,
          onUploadProgress: (progressEvent) => {
            setState((prev) => ({
              ...prev,
              uploadProgress: {
                ...prev.uploadProgress,
                [fileName]: {
                  ...prev.uploadProgress[fileName],
                  [partNumber]: progressEvent.loaded,
                },
              },
            }));
          },
        });
        const eTag = response.headers.etag?.replace(/"/g, "") || "";
        if (!eTag) throw new Error(`Missing ETag for part ${partNumber}`);
        setState((prev) => ({
          ...prev,
          uploadProgress: {
            ...prev.uploadProgress,
            [fileName]: { ...prev.uploadProgress[fileName], [partNumber]: chunk.size },
          },
        }));
        return { PartNumber: partNumber, ETag: eTag };
      } catch (error: any) {
        if (error.name === "AbortError") throw error;
        attempt++;
        if (attempt >= MAX_RETRY_ATTEMPTS) {
          throw new Error(`Part ${partNumber} upload failed after ${MAX_RETRY_ATTEMPTS} attempts`);
        }
        const delay = RETRY_DELAY * Math.pow(2, attempt) + Math.random() * 500;
        await new Promise((resolve) => setTimeout(resolve, delay));
        setState((prev) => ({
          ...prev,
          uploadProgress: {
            ...prev.uploadProgress,
            [fileName]: { ...prev.uploadProgress[fileName], [partNumber]: 0 },
          },
        }));
      }
    }
    throw new Error(`Part ${partNumber} upload failed after ${MAX_RETRY_ATTEMPTS} attempts`);
  };

  // Complete multipart upload.
  const completeMultipartUpload = async (
    file: File,
    uploadId: string,
    key: string,
    type: string,
    parts: UploadPart[],
    fileName: string
  ) => {
    const contentType = getFileType(file) || type || file.type || DEFAULT_CONTENT_TYPE;
    const finalRes = await fetch(`/api/upload/multipart/complete?bucket=${selectedBucket}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadId,
        key,
        parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
        filename: fileName,
        size: file.size,
        type: contentType,
      }),
    });
    const result = await finalRes.json();
    console.log("Complete upload response:", result);
    if (!finalRes.ok || !result.success) {
      throw new Error(result.error || "Unknown error");
    }
  };

  // Calculate upload progress for a file.
  const getUploadProgress = (file: File) => {
    const fileName = file.name;
    const totalParts = state.totalParts[fileName] || 0;
    const chunkSize = state.chunkSizes[fileName] || 0;
    const progressData = state.uploadProgress[fileName] || {};
    const totalUploaded = Object.values(progressData).reduce((sum, bytes) => sum + bytes, 0);
    const progress = (totalUploaded / file.size) * 100;
    const completedParts = Object.entries(progressData).reduce((count, [partStr, bytes]) => {
      const partNumber = parseInt(partStr);
      const isLastPart = partNumber === totalParts;
      const partSize = isLastPart ? file.size - chunkSize * (partNumber - 1) : chunkSize;
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
      <h2 className="text-xl font-bold mb-4">File Upload</h2>
      {/* Concurrency Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Max Concurrent File Uploads
          </label>
          <Select
            value={maxConcurrentFiles.toString()}
            onValueChange={(value) => setMaxConcurrentFiles(parseInt(value))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select uploads" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                <SelectItem key={num} value={num.toString()}>
                  {num}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Max Concurrent Chunk Uploads
          </label>
          <Select
            value={maxConcurrentChunks.toString()}
            onValueChange={(value) => setMaxConcurrentChunks(parseInt(value))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select uploads" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                <SelectItem key={num} value={num.toString()}>
                  {num}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div
        {...getRootProps()}
        className="border-dashed border-2 px-6 py-36 text-center cursor-pointer bg-background rounded-lg"
      >
        <input {...getInputProps()} />
        <p>Drag & drop files here, or click to select (Ctrl/Cmd+V to paste)</p>
      </div>
      {/* File List */}
      <div className="space-y-2">
        {state.files.map((file) => (
          <FileRow
            key={file.name}
            file={file}
            displayName={state.fileNames[file.name] || file.name}
            progressData={getUploadProgress(file)}
            fileType={getFileType(file) || DEFAULT_CONTENT_TYPE}
            uploadStatus={state.uploadStatus[file.name]}
            isUploading={state.uploadingFiles[file.name] || false}
            onFileNameChange={(newName) => handleFileNameChange(file.name, newName)}
            onCancel={() => handleCancel(file.name)}
          />
        ))}
      </div>
      <Button
        onClick={uploadFiles}
        disabled={state.files.length === 0 || Object.values(state.uploadingFiles).some(Boolean)}
      >
        {Object.values(state.uploadingFiles).some(Boolean)
          ? "Uploading..."
          : `Upload to ${selectedBucket}`}
      </Button>
    </div>
  );
}
