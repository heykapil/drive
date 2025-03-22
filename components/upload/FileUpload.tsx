"use client";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBytes, getFileType } from "@/lib/utils";
import Image from "next/image";
import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

const FILE_SIZE_THRESHOLD = 5 * 1024 * 1024; // 5MB

export default function FileUpload() {
  const [state, setState] = useState<{
    files: File[];
    progress: Record<string, number>;
    uploading: boolean;
  }>({
    files: [],
    progress: {},
    uploading: false,
  });

  const onDrop = (acceptedFiles: File[]) => {
    setState((prev) => ({
      ...prev,
      files: [...prev.files, ...acceptedFiles],
    }));
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    multiple: true,
    maxSize: 1024 * 1024 * 1024, // 1000MB limit per file
  });

  const uploadFiles = async () => {
    setState((prev) => ({ ...prev, uploading: true }));
    for (const file of state.files) {
      setState((prev) => ({
        ...prev,
        progress: { ...prev.progress, [file.name]: 0 },
      }));

      if (file.size <= FILE_SIZE_THRESHOLD) {
        await uploadSimple(file);
      } else {
        await uploadMultipart(file);
      }

      // Remove file from state after successful upload
      setState((prev) => ({
        ...prev,
        files: prev.files.filter((f) => f.name !== file.name),
      }));
    }
    setState((prev) => ({ ...prev, uploading: false }));
  };

  const uploadSimple = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
      toast.info(`Uploading ${file.name}...`);
      const response = await fetch("/api/upload/simple", {
        method: "POST",
        body: formData,
      });
      const simRes = await response.json();
      if (!simRes.success) {
        toast.error(`Error: ${simRes.error}`);
      } else {
        toast.success(`${file.name} uploaded successfully!`);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to upload file");
    }
  };

  const uploadMultipart = async (file: File) => {
    try {
      // Step 1: Initiate multipart upload
      const initRes = await fetch("/api/upload/multipart/initiate", {
        method: "POST",
        body: JSON.stringify({ filename: file.name, contentType: getFileType(file) }),
      });

      const { uploadId, key } = await initRes.json();
      if (!uploadId) throw new Error("Failed to initiate upload.");

      // Step 2: Determine chunk size dynamically
      const chunkSizeMap = [
        { limit: 100 * 1024 * 1024, size: 5 * 1024 * 1024 },
        { limit: 200 * 1024 * 1024, size: 10 * 1024 * 1024 },
        { limit: 300 * 1024 * 1024, size: 15 * 1024 * 1024 },
        { limit: 500 * 1024 * 1024, size: 20 * 1024 * 1024 },
        { limit: 700 * 1024 * 1024, size: 25 * 1024 * 1024 },
        { limit: 1 * 1024 * 1024 * 1024, size: 50 * 1024 * 1024 },
      ];

      const chunkSize =
        chunkSizeMap.find(({ limit }) => file.size < limit)?.size ??
        (() => {
          throw new Error("File size exceeds 1GB limit");
        })();
      const totalParts = Math.ceil(file.size / chunkSize);
      const parts: { PartNumber: number; ETag: string }[] = [];

      const concurrentUploads = 3; // Limit to 3 parallel uploads
      let activeUploads = 0;
      let currentPart = 1;

      // Helper function to upload a single chunk
      const uploadChunk = async (partNumber: number) => {
        const start = (partNumber - 1) * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        // Get presigned URL
        const presignRes = await fetch("/api/upload/multipart/presign", {
          method: "POST",
          body: JSON.stringify({ uploadId, key, partNumber }),
        });

        const { url } = await presignRes.json();
        if (!url) throw new Error(`Failed to get presigned URL for part ${partNumber}`);

        // Upload chunk
        const uploadRes = await fetch(url, { method: "PUT", body: chunk });

        if (!uploadRes.ok) throw new Error(`Upload failed for part ${partNumber}`);

        const eTag = uploadRes.headers.get("ETag")?.replace(/"/g, "");
        if (!eTag) throw new Error(`Missing ETag for part ${partNumber}`);

        parts.push({ PartNumber: partNumber, ETag: eTag });

        // Update progress
        setState((prev) => ({
          ...prev,
          progress: {
            ...prev.progress,
            [file.name]: Math.round((parts.length / totalParts) * 100),
          },
        }));

        activeUploads--;
      };

      // Step 3: Process uploads with concurrency limit
      const uploadQueue = [];
      while (currentPart <= totalParts || activeUploads > 0) {
        while (activeUploads < concurrentUploads && currentPart <= totalParts) {
          uploadQueue.push(uploadChunk(currentPart));
          activeUploads++;
          currentPart++;
        }
        await Promise.allSettled(uploadQueue);
        uploadQueue.length = 0;
      }

      // Step 4: Complete multipart upload
      const finalRes = await fetch("/api/upload/multipart/complete", {
        method: "POST",
        body: JSON.stringify({ uploadId, key, parts, filename: file.name, size: file.size, type: file.type }),
      });

      if ((await finalRes.json()).success) {
        toast.success(`${file.name} uploaded successfully!`);
      } else {
        throw new Error("Failed to complete multipart upload");
      }
    } catch (error:any) {
      console.error("Multipart upload error:", error);
      toast.error(`Upload failed: ${error.message}`);
    }
  };


  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div {...getRootProps()} className="border-dashed border-2 px-6 py-36 text-center cursor-pointer bg-background rounded-lg">
        <input {...getInputProps()} />
        <p>Drag & drop files here, or click to select</p>
      </div>
      <div className="space-y-2">
        {state.files.map((file) => (
          <div key={file.name} className="flex items-center gap-2 p-2  border rounded-lg">
            <Image src={URL.createObjectURL(file)} alt={file.name} width={40} height={40} className="rounded-md" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium trucate max-w-[200px] lg:max-w-[500px]">{file.name}</p>
              <div className="flex flex-row space-x-2 items-center">
              <Progress className="min-w-[150px] md:w-1/2 lg:w-[95%]" value={state.progress[file.name] || 0} />
              <p className="text-xs text-green-600 dark:text-green-400">{state.progress[file.name] || 0} %</p>
              </div>
              <p className="text-xs text-gray-500">{getFileType(file)} | {formatBytes(file.size)} </p>
            </div>
          </div>
        ))}
      </div>
      <Button onClick={uploadFiles} disabled={state.files.length === 0 || state.uploading}>
        {state.uploading ? "Uploading..." : "Upload Files"}
      </Button>
    </div>
  );
}
