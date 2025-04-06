'use client';

import { calculateChunkSize } from "@/lib/helpers/chunk-size";
import { signJWT } from "@/lib/helpers/jose";
import { sanitizeFileName } from "@/lib/helpers/sanitize-file-name";
import { getFileTypeFromFilename } from "@/lib/utils";
import axios from "axios";
import { toast } from "sonner";

// Interfaces for upload responses and progress state.
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

// Default chunk size (in bytes) if file size is unknown.
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Uploads a file using multipart upload.
 *
 * If the file's metadata does not include a content-length (for example, when the file is of type
 * application/vnd.apple.mpegurl), the entire file is loaded into memory to determine its size.
 *
 * @param fileUrl - The URL of the file to upload.
 * @param selectedBucket - The target bucket.
 * @param setProgress - Function to update upload progress.
 * @param proxy - Optional proxy URL.
 * @param isSynologyBucket - If true, perform server-side chunk upload.
 */
export const uploadMultipart = async (
  fileUrl: string,
  selectedBucket: string,
  setProgress: SetProgress,
  proxy?: string,
  isSynologyBucket?: boolean,
): Promise<void> => {
  try {
    toast.info("Starting upload", { description: `Uploading file from URL: ${fileUrl}` });

    // 0. Define proxy domain and URL.
    const proxyDomain =
      proxy ||
      (process.env.NODE_ENV === "development"
        ? "/api/proxy"
        : "https://stream.kapil.app");
    const proxyUrl = `${proxyDomain}?url=${encodeURIComponent(fileUrl)}`;
    toast.info("Using proxy", { description: proxyDomain });

    // 1. Get file metadata via HEAD; if that fails, use a fallback GET.
    let headRes = await fetch(proxyUrl, { method: "HEAD" });
    if (!headRes.ok) {
      // Fallback: try a GET with Range header.
      headRes = await fetch(proxyUrl, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
      });
      if (!headRes.ok) {
        toast.error("Failed to fetch file metadata");
        throw new Error("Failed to fetch file metadata");
      }
    }
    const contentLength = headRes.headers.get("content-length");
    const isFileSizeKnown = !!contentLength;
    let fileSize = isFileSizeKnown ? parseInt(contentLength as string, 10) : 0;
    const fileName =
      sanitizeFileName(fileUrl.split("/").pop() || `file-${Date.now()}`);
    const contentType =
      headRes.headers.get("content-type") ||
      getFileTypeFromFilename(fileName) ||
      "application/octet-stream";
    toast.info("Fetched file metadata", { description: `File: ${fileName}` });

    // 2. Initiate multipart upload.
    const initRes = await fetch(`/api/upload/multipart/initiate?bucket=${selectedBucket}`, {
      method: "POST",
      body: JSON.stringify({ filename: fileName, contentType }),
      headers: { "Content-Type": "application/json" },
    });
    const { uploadId, key }: MultipartInitResponse = await initRes.json();
    if (!uploadId) {
      toast.error("Failed to initiate upload");
      throw new Error("Failed to initiate upload.");
    }
    toast.info("Preparing upload", { description: "Generating presign URLs for chunks" });

    // 3. Determine chunk size.
    const chunkSize = isFileSizeKnown ? calculateChunkSize(fileSize) : DEFAULT_CHUNK_SIZE;
    let totalParts = isFileSizeKnown ? Math.ceil(fileSize / chunkSize) : 0;

    // 4. Prepare the file data.
    let buffer = new Uint8Array(0);
    if (!isFileSizeKnown) {
      // If file size is unknown, fetch the entire file into memory.
      toast.info("File size unknown", { description: "Downloading full file to determine size" });
      const fileRes = await fetch(`${proxyDomain}?url=${encodeURIComponent(fileUrl)}`);
      if (!fileRes.ok) {
        toast.error("Failed to fetch file");
        throw new Error("Failed to fetch file");
      }
      const reader = fileRes.body?.getReader();
      if (!reader) {
        toast.error("Failed to read file stream");
        throw new Error("Failed to read file stream");
      }
      const chunks: Uint8Array[] = [];
      let totalLength = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        totalLength += value.length;
      }
      buffer = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }
      fileSize = buffer.length;
      totalParts = Math.ceil(fileSize / chunkSize);
      toast.info("File downloaded", { description: `Size determined: ${fileSize} bytes` });
    } else {
      // When file size is known, fetch the stream for incremental processing.
      const fileRes = await fetch(`${proxyDomain}?url=${encodeURIComponent(fileUrl)}`);
      if (!fileRes.ok) {
        toast.error("Failed to fetch file");
        throw new Error("Failed to fetch file");
      }
      const reader = fileRes.body?.getReader();
      if (!reader) {
        toast.error("Failed to read file stream");
        throw new Error("Failed to read file stream");
      }
      // For streaming, wrap the reader in an object.
      (buffer as any) = { reader, data: new Uint8Array(0) };
    }

    // 5. Set up upload tracking variables.
    const concurrentUploads = 3;
    const parts: { PartNumber: number; ETag: string }[] = [];
    let completedPartsSize = 0;
    const inProgressParts: { [key: number]: number } = {};
    let currentPart = 1;
    const uploadQueue: Promise<void>[] = [];

    /**
     * Uploads a single chunk.
     *
     * If the bucket is a Synology bucket, the chunk is uploaded server-side
     * via a POST request with a JWT-signed payload. Otherwise, a presigned URL is
     * requested and the chunk is uploaded using a PUT.
     *
     * @param partNumber - The part number.
     * @param chunk - The chunk data.
     */
    const uploadChunk = async (partNumber: number, chunk: Uint8Array): Promise<void> => {
      inProgressParts[partNumber] = 0;
      if (isSynologyBucket) {
        // Server-side upload.
        const payload = { uploadId, key, partNumber };
        const formData = new FormData();
        // Append required fields into form data.
        formData.append("uploadId", uploadId);
        formData.append("key", key);
        formData.append("partNumber", partNumber.toString());
        formData.append("chunk", new Blob([chunk]), fileName);

        const production = process.env.NODE_ENV !== "development";
        const endpoint = production
          ? `${process.env.NEXT_PUBLIC_GCLOUD_URL_CHUNK}/upload?bucket=${selectedBucket}`
          : `/api/upload/multipart/chunk?bucket=${selectedBucket}`;

        const { data } = await axios.post(endpoint, formData, {
          onUploadProgress: (progressEvent) => {
            const loaded = progressEvent.loaded;
            inProgressParts[partNumber] = loaded;
            const totalUploaded = completedPartsSize +
              Object.values(inProgressParts).reduce((acc, curr) => acc + curr, 0);
            const percent = fileSize ? Math.round((totalUploaded / fileSize) * 100) : 0;
            setProgress((prev) => ({
              ...prev,
              [fileUrl]: percent,
            }));
          },
          headers: {
            "Content-Type": "multipart/form-data",
            "x-access-token": await signJWT(payload),
          },
        })

        if (!data.success) throw new Error(data.error || "Chunk upload failed");
        const eTag = data.eTag || data.etag || data.ETag;
        if (!eTag) {
          throw new Error(`ETag missing for part ${partNumber}`);
        }
        parts.push({ PartNumber: partNumber, ETag: eTag });
      } else {
        // Client-side upload via presigned URL.
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
        const response = await axios.put(url, chunk, {
          headers: { "Content-Type": "application/octet-stream" },
          onUploadProgress: (progressEvent) => {
            const loaded = progressEvent.loaded;
            inProgressParts[partNumber] = loaded;
            const totalUploaded = completedPartsSize +
              Object.values(inProgressParts).reduce((acc, curr) => acc + curr, 0);
            const percent = fileSize ? Math.round((totalUploaded / fileSize) * 100) : 0;
            setProgress((prev) => ({
              ...prev,
              [fileUrl]: percent,
            }));
          },
        });
        if (response.status !== 200) {
          throw new Error(`Part ${partNumber} upload failed (${response.status})`);
        }
        const eTag = response.headers.etag?.replace(/"/g, "");
        if (!eTag) {
          throw new Error(`ETag missing for part ${partNumber}`);
        }
        parts.push({ PartNumber: partNumber, ETag: eTag });
      }
      completedPartsSize += chunk.byteLength;
      delete inProgressParts[partNumber];
      const totalUploaded = completedPartsSize +
        Object.values(inProgressParts).reduce((acc, curr) => acc + curr, 0);
      const percent = fileSize ? Math.round((totalUploaded / fileSize) * 100) : 0;
      setProgress((prev) => ({
        ...prev,
        [fileUrl]: percent,
      }));
      toast.info("Uploading...", {
        description: `Part ${partNumber} of ${totalParts} uploaded`,
      });
    };

    // 6. Process the file stream or buffer to upload in chunks.
    if (isFileSizeKnown) {
      // @ts-ignore
      const { reader } = buffer as { reader: ReadableStreamDefaultReader<Uint8Array>; data: Uint8Array };
      let streamBuffer = new Uint8Array(0);
      while (currentPart <= totalParts) {
        while (streamBuffer.length < chunkSize && currentPart <= totalParts) {
          const { done, value } = await reader.read();
          if (done) break;
          const newBuffer = new Uint8Array(streamBuffer.length + value.length);
          newBuffer.set(streamBuffer);
          newBuffer.set(value, streamBuffer.length);
          streamBuffer = newBuffer;
        }
        const isLastPart = currentPart === totalParts;
        const currentChunkSize = isLastPart ? streamBuffer.length : Math.min(chunkSize, streamBuffer.length);
        if (currentChunkSize === 0) break;
        const chunk = streamBuffer.slice(0, currentChunkSize);
        streamBuffer = streamBuffer.slice(currentChunkSize);
        uploadQueue.push(uploadChunk(currentPart, chunk));
        currentPart++;
        if (uploadQueue.length >= concurrentUploads) {
          const results = await Promise.allSettled(uploadQueue);
          uploadQueue.length = 0;
          for (const result of results) {
            if (result.status === "rejected") {
              toast.error(String(result.reason));
              throw new Error(String(result.reason));
            }
          }
        }
      }
    } else {
      // When file size was unknown, buffer already contains the full file.
      while (currentPart <= totalParts) {
        const isLastPart = currentPart === totalParts;
        const currentChunkSize = isLastPart ? buffer.length : Math.min(chunkSize, buffer.length);
        if (currentChunkSize === 0) break;
        const chunk = buffer.slice(0, currentChunkSize);
        buffer = buffer.slice(currentChunkSize);
        uploadQueue.push(uploadChunk(currentPart, chunk));
        currentPart++;
        if (uploadQueue.length >= concurrentUploads) {
          const results = await Promise.allSettled(uploadQueue);
          uploadQueue.length = 0;
          for (const result of results) {
            if (result.status === "rejected") {
              toast.error(String(result.reason));
              throw new Error(String(result.reason));
            }
          }
        }
      }
    }

    // 7. Process any remaining uploads.
    if (uploadQueue.length > 0) {
      const results = await Promise.allSettled(uploadQueue);
      for (const result of results) {
        if (result.status === "rejected") {
          toast.error(String(result.reason));
          throw new Error(String(result.reason));
        }
      }
    }

    // 8. Complete the multipart upload.
    const finalRes = await fetch(`/api/upload/multipart/complete?bucket=${selectedBucket}`, {
      method: "POST",
      body: JSON.stringify({
        uploadId,
        key,
        parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
        filename: fileName,
        size: fileSize,
        type: contentType,
      }),
      headers: { "Content-Type": "application/json" },
    });
    const finalResult = await finalRes.json();
    if (!finalResult.success) {
      toast.error("Failed to complete multipart upload");
      throw new Error("Failed to complete multipart upload");
    } else {
      toast.success("File uploaded successfully");
    }
  } catch (error: any) {
    console.error("Upload error:", error);
    toast.error("Upload error: " + error.message);
  }
};
