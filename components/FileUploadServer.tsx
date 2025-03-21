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

export default function FileUploadServer() {
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

  const [maxConcurrentFiles, setMaxConcurrentFiles] = useState<number>(3);
  const [maxConcurrentChunks, setMaxConcurrentChunks] = useState<number>(3);
  const abortControllers = useRef<Record<string, AbortController[]>>({});

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
    // maxSize: 1024 * 1024 * 1024,
  });

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const files = Array.from(e.clipboardData.items)
        .filter(item => item.kind === "file")
        .map(item => item.getAsFile())
        .filter((file): file is File => file !== null);

      if (files.length > 0) {
        e.preventDefault();
        onDrop(files);
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

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

      return {
        ...prev,
        files: updatedFiles,
        fileNames: { ...prev.fileNames, [newFileName]: newFileName },
        uploadProgress: updateObjectKey(prev.uploadProgress, oldName, newFileName),
        totalParts: updateObjectKey(prev.totalParts, oldName, newFileName),
        chunkSizes: updateObjectKey(prev.chunkSizes, oldName, newFileName),
        uploadStatus: updateObjectKey(prev.uploadStatus, oldName, newFileName),
        uploadingFiles: updateObjectKey(prev.uploadingFiles, oldName, newFileName),
      };
    });
  };

  const handleCancel = (fileName: string) => {
    abortControllers.current[fileName]?.forEach(controller => controller.abort());
    delete abortControllers.current[fileName];

    setState((prev) => ({
      ...prev,
      files: prev.files.filter((f) => f.name !== fileName),
      fileNames: omitKey(prev.fileNames, fileName),
      uploadProgress: omitKey(prev.uploadProgress, fileName),
      totalParts: omitKey(prev.totalParts, fileName),
      chunkSizes: omitKey(prev.chunkSizes, fileName),
      uploadStatus: omitKey(prev.uploadStatus, fileName),
      uploadingFiles: omitKey(prev.uploadingFiles, fileName),
    }));
  };

  const uploadFiles = async () => {
    const fileTasks = state.files.map((file) => async () => {
      handleFileUploadStart(file.name);
      updateUploadStatus(file.name, "Initiating upload...");
      try {
        file.size <= FILE_SIZE_THRESHOLD
          ? await uploadSimple(file)
          : await uploadMultipart(file);
        toast.success(`${file.name} uploaded successfully!`);
      } catch (error: any) {
        const message = error.name === "AbortError" ? "Upload cancelled" : error.message;
        toast.error(`Failed to upload ${file.name}: ${message}`);
      } finally {
        handleFileUploadEnd(file.name);
        handleCancel(file.name);
      }
    });

    try {
      await runPromisePool(fileTasks, maxConcurrentFiles);
    } catch (error: any) {
      toast.error(error?.message || "Upload failed");
    }
  };

  const uploadSimple = async (file: File) => {
    const controller = new AbortController();
    abortControllers.current[file.name] = [controller];

    const formData = new FormData();
    formData.append("file", file);

    await fetch(`/api/upload/simple?bucket=${selectedBucket}`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
  };

  const uploadMultipart = async (file: File) => {
    const fileName = file.name;
    const contentType = getFileType(file) || getFileTypeFromFilename(fileName) || DEFAULT_CONTENT_TYPE;

    const initRes = await fetch(`/api/upload/multipart/initiate?bucket=${selectedBucket}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: fileName, contentType }),
    });

    if (!initRes.ok) throw new Error("Initiation failed");
    const { uploadId, key } = await initRes.json();

    const chunkSize = calculateChunkSize(file.size);
    const totalParts = Math.ceil(file.size / chunkSize);

    setState((prev) => ({
      ...prev,
      totalParts: { ...prev.totalParts, [fileName]: totalParts },
      chunkSizes: { ...prev.chunkSizes, [fileName]: chunkSize },
      uploadProgress: {
        ...prev.uploadProgress,
        [fileName]: Array.from({ length: totalParts }, (_, i) => i + 1).reduce(
          (acc, part) => ({ ...acc, [part]: 0 }),
          {}
        ),
      },
    }));

    const chunkTasks = Array.from({ length: totalParts }, (_, i) => i + 1).map((partNumber) =>
      () => uploadChunk(file, partNumber, totalParts, chunkSize, uploadId, key, fileName)
    );

    const parts = await runPromisePool(chunkTasks, maxConcurrentChunks);
    await completeMultipartUpload(file, uploadId, key, contentType, parts, fileName);
  };

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
    abortControllers.current[fileName] = [...(abortControllers.current[fileName] || []), controller];

    let attempt = 0;
    while (attempt < MAX_RETRY_ATTEMPTS) {
      try {
        const start = (partNumber - 1) * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append("uploadId", uploadId);
        formData.append("key", key);
        formData.append("partNumber", partNumber.toString());
        formData.append("chunk", new Blob([chunk]));

        const { data } = await axios.post(
          `/api/upload/multipart/chunk?bucket=${selectedBucket}`,
          formData,
          {
            signal: controller.signal,
            onUploadProgress: (progressEvent) => {
              setState(prev => ({
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
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );

        if (!data.success) throw new Error(data.error || "Chunk upload failed");

        setState(prev => ({
          ...prev,
          uploadProgress: {
            ...prev.uploadProgress,
            [fileName]: { ...prev.uploadProgress[fileName], [partNumber]: chunk.size },
          },
        }));

        return { PartNumber: partNumber, ETag: data.ETag };
      } catch (error: any) {
        if (error.name === "AbortError") throw error;
        if (++attempt >= MAX_RETRY_ATTEMPTS) throw error;
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, attempt)));
      }
    }
    throw new Error(`Part ${partNumber} failed after ${MAX_RETRY_ATTEMPTS} attempts`);
  };

  const completeMultipartUpload = async (
    file: File,
    uploadId: string,
    key: string,
    contentType: string,
    parts: UploadPart[],
    fileName: string
  ) => {
    const res = await fetch(`/api/upload/multipart/complete?bucket=${selectedBucket}`, {
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

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Completion failed");
    }
  };

  const getUploadProgress = (file: File) => {
    const fileName = file.name;
    const totalParts = state.totalParts[fileName] || 0;
    const chunkSize = state.chunkSizes[fileName] || 0;
    const progressData = state.uploadProgress[fileName] || {};

    const totalUploaded = Object.values(progressData).reduce((sum, bytes) => sum + bytes, 0);
    const completedParts = Object.entries(progressData).reduce((count, [part, bytes]) => {
      const partNum = parseInt(part);
      const isLast = partNum === totalParts;
      const expected = isLast ? file.size - (totalParts - 1) * chunkSize : chunkSize;
      return count + (bytes >= expected ? 1 : 0);
    }, 0);

    return {
      progress: Math.min(100, (totalUploaded / file.size) * 100),
      uploadedParts: `${completedParts}/${totalParts}`,
      totalUploaded,
    };
  };

  return (
    <div className="space-y-4 p-4 lg:ml-4 border rounded-lg">

      <div
        {...getRootProps()}
        className="border-dashed border-2 px-6 py-36 text-center cursor-pointer bg-background rounded-lg"
      >
        <input {...getInputProps()} />
        <p>Drag & drop files here, or click/paste to upload</p>
      </div>

      <div className="space-y-2">
        {state.files.map((file) => (
          <FileRow
            key={file.name}
            file={file}
            displayName={state.fileNames[file.name]}
            progressData={getUploadProgress(file)}
            fileType={getFileType(file) || DEFAULT_CONTENT_TYPE}
            uploadStatus={state.uploadStatus[file.name]}
            isUploading={!!state.uploadingFiles[file.name]}
            onFileNameChange={(newName) => handleFileNameChange(file.name, newName)}
            onCancel={() => handleCancel(file.name)}
          />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 items-center">
        <div className="flex flex-row space-x-2 items-center">
          <label className="block text-sm font-medium mb-1">
            Concurrent Files
          </label>
          <Select
            value={maxConcurrentFiles.toString()}
            onValueChange={(value) => setMaxConcurrentFiles(parseInt(value))}
          >
            <SelectTrigger className="w-auto">
              <SelectValue placeholder="Select uploads" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                <SelectItem key={num} value={num.toString()}>
                  {num} Files
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-row space-x-2 items-center">
           <label className="block text-sm font-medium mb-1">Concurrent Chunks</label>
          <Select
            value={maxConcurrentChunks.toString()}
            onValueChange={(value) => setMaxConcurrentChunks(parseInt(value))}
          >
            <SelectTrigger className="w-auto">
              <SelectValue placeholder="Select uploads" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                <SelectItem key={num} value={num.toString()}>
                  {num} chunks
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>



      <Button
        onClick={uploadFiles}
        disabled={!state.files.length || Object.values(state.uploadingFiles).some(Boolean)}
        className="w-full"
      >
        {Object.values(state.uploadingFiles).some(Boolean)
          ? "Uploading..."
          : `Upload ${state.files.length} file(s) to ${selectedBucket}`}
      </Button>
    </div>
  );
}

// Helper functions
const updateObjectKey = <T extends object>(obj: T, oldKey: keyof T, newKey: string) => {
  const { [oldKey]: value, ...rest } = obj;
  return { ...rest, [newKey]: value } as T;
};

const omitKey = <T extends object>(obj: T, key: keyof T) => {
  const { [key]: _, ...rest } = obj;
  return rest as Omit<T, keyof T>;
};
