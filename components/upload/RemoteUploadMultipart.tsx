'use client'
import { calculateChunkSize } from "@/lib/helpers/chunk-size";
import { sanitizeFileName } from "@/lib/helpers/sanitize-file-name";
import { getFileTypeFromFilename } from "@/lib/utils";
import axios from "axios";
import { toast } from "sonner";

interface ProgressState {
  [fileUrl: string]: number;
}

interface MultipartInitResponse {
  uploadId: string;
  key: string;
}

interface PresignResponse {
  url: string;
}

type SetProgress = React.Dispatch<React.SetStateAction<ProgressState>>;

export const uploadMultipart = async (
  fileUrl: string,
  selectedBucket: string,
  setProgress: SetProgress,
  proxy?: string
): Promise<void> => {
  try {
    toast.info('Uploading file from url:', { description: fileUrl });

    // 0. Define proxy domain and URL
    const proxyDomain =
      proxy || (process.env.NODE_ENV === "development" ? "/api/proxy" : "https://stream.kapil.app");
    const proxyUrl = `${proxyDomain}?url=${encodeURIComponent(fileUrl)}`;
    toast.info('Using proxy', { description: proxyDomain });

    // 1. Get file metadata
    const headRes = await fetch(proxyUrl, { method: "HEAD" });
    if (!headRes.ok) {
      toast.error("Failed to fetch file metadata");
      throw new Error("Failed to fetch file metadata");
    }

    // 2. Extract metadata
    const contentLength = headRes.headers.get("content-length");
    if (!contentLength) {
      toast.error('Could not determine file size');
      throw new Error("Could not determine file size");
    }
    const fileSize = parseInt(contentLength, 10);
    const fileName = sanitizeFileName(fileUrl.split("/").pop() || `file-${Date.now()}`);
    const contentType =
      headRes.headers.get("content-type") || getFileTypeFromFilename(fileName) || "application/octet-stream";
    toast.info('Fetched file url..', { description: fileUrl });

    // 3. Initiate multipart upload
    const initRes = await fetch(`/api/upload/multipart/initiate?bucket=${selectedBucket}`, {
      method: "POST",
      body: JSON.stringify({ filename: fileName, contentType }),
      headers: { "Content-Type": "application/json" },
    });
    const { uploadId, key }: MultipartInitResponse = await initRes.json();
    if (!uploadId) {
      toast.error('Failed to initiate upload');
      throw new Error("Failed to initiate upload.");
    }
    toast.info('Preparing for upload...', { description: 'Generating presign urls for chunks!' });

    // 4. Upload configuration
    const chunkSize = calculateChunkSize(fileSize);
    const totalParts = Math.ceil(fileSize / chunkSize);
    const concurrentUploads = 3;
    const parts: { PartNumber: number; ETag: string }[] = [];

    // 5. Fetch file stream using proxy
    const fileRes = await fetch(`${proxyDomain}?url=${encodeURIComponent(fileUrl)}`);
    if (!fileRes.ok) {
      toast.error('Failed to fetch file');
      throw new Error("Failed to fetch file");
    }
    const reader = fileRes.body?.getReader();
    if (!reader) {
      toast.error('Failed to read stream');
      throw new Error("Failed to read file stream");
    }

    // 6. Stream processing variables
    let buffer = new Uint8Array(0);
    let currentPart = 1;
    const uploadQueue: Promise<void>[] = [];
    let completedPartsSize = 0;
    const inProgressParts: { [key: number]: number } = {};

    // 7. Function to upload a single chunk
    const uploadChunk = async (partNumber: number, chunk: Uint8Array): Promise<void> => {
      // Get presigned URL
      const presignRes = await fetch(`/api/upload/multipart/presign?bucket=${selectedBucket}`, {
        method: "POST",
        body: JSON.stringify({ uploadId, key, partNumber }),
        headers: { "Content-Type": "application/json" },
      });
      const { url }: PresignResponse = await presignRes.json();
      if (!url) {
        toast.error(`Presigned URL missing for part ${partNumber}`);
        throw new Error(`Presigned URL missing for part ${partNumber}`);
      }

      // Add part to inProgress tracking
      inProgressParts[partNumber] = 0;

      try {
        // Upload chunk with Axios
        const response = await axios.put(url, chunk, {
          headers: { 'Content-Type': 'application/octet-stream' },
          onUploadProgress: (progressEvent) => {
            const loaded = progressEvent.loaded;
            inProgressParts[partNumber] = loaded;

            // Calculate total uploaded bytes
            const totalUploaded = completedPartsSize +
              Object.values(inProgressParts).reduce((acc, curr) => acc + curr, 0);

            // Update progress
            const percent = Math.round((totalUploaded / fileSize) * 100);
            setProgress(prev => ({
              ...prev,
              [fileUrl]: percent,
            }));
          },
        });

        if (response.status !== 200) {
          throw new Error(`Part ${partNumber} upload failed (${response.status})`);
        }

        // Store ETag and update completion tracking
        const eTag = response.headers.etag?.replace(/"/g, "");
        if (!eTag) {
          throw new Error(`ETag missing for part ${partNumber}`);
        }
        parts.push({ PartNumber: partNumber, ETag: eTag });

        // Update completed parts size
        completedPartsSize += chunk.byteLength;
        delete inProgressParts[partNumber];

        // Final progress update after completion
        const totalUploaded = completedPartsSize +
          Object.values(inProgressParts).reduce((acc, curr) => acc + curr, 0);
        const percent = Math.round((totalUploaded / fileSize) * 100);
        setProgress(prev => ({
          ...prev,
          [fileUrl]: percent,
        }));

        toast.info('Uploading...', { description: `Part ${partNumber} of ${totalParts} uploaded` });
      } catch (error) {
        delete inProgressParts[partNumber];
        throw error;
      }
    };

    // 8. Stream processing loop
    while (currentPart <= totalParts) {
      // Accumulate data until we have a full chunk
      while (buffer.length < chunkSize && currentPart <= totalParts) {
        const { done, value } = await reader.read();
        if (done) break;

        // Merge chunks into buffer
        const newBuffer = new Uint8Array(buffer.length + value.length);
        newBuffer.set(buffer);
        newBuffer.set(value, buffer.length);
        buffer = newBuffer;
      }

      // Determine chunk size (last part may be smaller)
      const isLastPart = currentPart === totalParts;
      const currentChunkSize = isLastPart ? buffer.length : Math.min(chunkSize, buffer.length);
      if (currentChunkSize === 0) break;

      // Extract chunk and update buffer
      const chunk = buffer.slice(0, currentChunkSize);
      buffer = buffer.slice(currentChunkSize);

      // Add to upload queue
      uploadQueue.push(uploadChunk(currentPart, chunk));
      currentPart++;

      // Manage concurrency
      if (uploadQueue.length >= concurrentUploads) {
        const results = await Promise.allSettled(uploadQueue);
        uploadQueue.length = 0;

        // Check for errors
        for (const result of results) {
          if (result.status === "rejected") {
            toast.error(result.reason)
            throw new Error(result.reason);
          }
        }
      }
    }

    // 9. Process remaining uploads
    if (uploadQueue.length > 0) {
      const results = await Promise.allSettled(uploadQueue);
      for (const result of results) {
        if (result.status === "rejected") {
          toast.error(result.reason)
          throw new Error(result.reason);
        }
      }
    }

    // 10. Complete multipart upload
    const finalRes = await fetch(`/api/upload/multipart/complete?bucket=${selectedBucket}`, {
      method: "POST",
      body: JSON.stringify({
        uploadId,
        key,
        parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
        filename: fileName,
        size: fileSize,
        type: contentType
      }),
      headers: { "Content-Type": "application/json" },
    });

    const finalResult = await finalRes.json();

    if (!finalResult.success) {
      toast.error(`Failed to complete multipart upload`)
      throw new Error("Failed to complete multipart upload");
    } else {
      toast.success('File uploaded')
    }
  } catch (error) {
    console.log(error)
    toast.error("Upload error:"+ error)
  }
};
