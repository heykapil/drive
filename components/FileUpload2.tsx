"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useBucketStore } from "@/hooks/use-bucket-store";
import { formatBytes, getFileType } from "@/lib/utils";
import Image from "next/image";
import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

const FILE_SIZE_THRESHOLD = 5 * 1024 * 1024; // 5MB

interface FileState {
  files: File[];
  progress: Record<string, number>;
  uploading: boolean;
  fileNames: Record<string, string>;
}

export default function FileUpload() {
  const { selectedBucket } = useBucketStore();
  const [state, setState] = useState<FileState>({
    files: [],
    progress: {},
    uploading: false,
    fileNames: {},
  });

  const onDrop = (acceptedFiles: File[]) => {
      setState((prev) => ({
        ...prev,
        files: [...prev.files, ...acceptedFiles],
        fileNames: {
          ...prev.fileNames,
          ...Object.fromEntries(acceptedFiles.map((file) => [file.name, file.name])),
        },
      }));
    };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    multiple: true,
    maxSize: 1024 * 1024 * 1024, // 1000MB limit per file
  });

  const handleFileNameChange = (oldName: string, newName: string) => {
      if (!newName || newName === oldName) return;
      const ext = oldName.split(".").pop();
      const newFileName = newName.includes(".") ? newName : `${newName}.${ext}`;
      setState((prev) => ({
        ...prev,
        fileNames: { ...prev.fileNames, [oldName]: newFileName },
      }));
    };


  const uploadFiles = async () => {
    setState((prev) => ({ ...prev, uploading: true }));

    for (const file of state.files) {
      const updatedFileName = state.fileNames[file.name] || file.name;

      // Rename the file before uploading
      const renamedFile = new File([file], updatedFileName, { type: file.type });

      setState((prev) => ({
        ...prev,
        progress: { ...prev.progress, [renamedFile.name]: 0 },
      }));

      if (renamedFile.size <= FILE_SIZE_THRESHOLD) {
        await uploadSimple(renamedFile);
      } else {
        await uploadMultipart(renamedFile);
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
    formData.append("file", file)
    try {
      toast.info(`Uploading ${file.name}...`);
      const response = await fetch(`/api/upload/simple?bucket=${selectedBucket}`, {
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
      const initRes = await fetch(`/api/upload/multipart/initiate?bucket=${selectedBucket}`, {
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
        const presignRes = await fetch(`/api/upload/multipart/presign?bucket=${selectedBucket}`, {
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

      // Make sure parts are in order
      parts.sort((a, b) => a.PartNumber - b.PartNumber); // 🔥 Ensure parts are in order

      // Step 4: Complete multipart upload
      const finalRes = await fetch(`/api/upload/multipart/complete?bucket=${selectedBucket}`, {
        method: "POST",
        body: JSON.stringify({ uploadId, key, parts, filename: file.name, size: file.size, type: file.type }),
      });

      if ((await finalRes.json()).success) {
        toast.success(`${file.name} uploaded successfully!`);
      } else {
        throw new Error("Failed to complete multipart upload");
      }
    } catch (error) {
      console.log("Multipart upload error:", error);
      toast.error(`Upload failed: ${error && JSON.stringify(error)}`);
    }
  };


  return (
    <div className="space-y-4 p-4 lg:ml-4 border rounded-lg">
      <div {...getRootProps()} className="border-dashed border-2 px-6 py-36 text-center cursor-pointer bg-background rounded-lg">
        <input {...getInputProps()} />
        <p>Drag & drop files here, or click to select</p>
      </div>
      <div className="space-y-2">
        {state.files.map((file) => (
          <div key={file.name} className="flex items-center gap-2 p-2 border rounded-lg">
            <Image src={URL.createObjectURL(file)} alt={file.name} width={40} height={30} className="rounded-md" />
            <div className="flex-1 space-y-1">
              <Input
                placeholder="File Name.ext"
                className="text-sm font-medium w-full border-muted"
                required
                value={state.fileNames[file.name] || file.name}
                onChange={(e) => handleFileNameChange(file.name, e.target.value)}
              />
              <div className="flex flex-row space-x-2 w-full items-center">
                <Progress className="flex-1 min-w-[150px] md:w-1/2 lg:w-[95%]" value={state.progress[state.fileNames[file.name] || file.name] || 0} />
                <p className="text-xs text-green-600 dark:text-green-400">{state.progress[state.fileNames[file.name] || file.name] || 0} %</p>
              </div>
              <p className="text-xs text-gray-500">{getFileType(file)} | {formatBytes(file.size)}</p>
            </div>
          </div>
        ))}
      </div>
      <Button onClick={uploadFiles} disabled={state.files.length === 0 || state.uploading}>
        {state.uploading ? "Uploading..." : `Upload to ${selectedBucket}`}
      </Button>
    </div>
  );
}
