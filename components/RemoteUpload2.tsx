'use client'
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useBucketStore } from "@/hooks/use-bucket-store";
import { useState } from "react";
import { toast } from "react-hot-toast";

export default function RemoteUpload() {
  const [urls, setUrls] = useState("");
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);
  const { selectedBucket } = useBucketStore()
  const uploadMultipart = async (fileUrl: string) => {
    try {
      // 1. Get file metadata
      const proxyUrl = `/api/proxy?bucket=${selectedBucket}&url=${encodeURIComponent(fileUrl)}`;
      const headRes = await fetch(proxyUrl, { method: "HEAD" });
      if (!headRes.ok) throw new Error("Failed to fetch file metadata");

      // 2. Extract metadata
      const contentLength = headRes.headers.get("content-length");
      const contentType = headRes.headers.get("content-type") || "application/octet-stream";
      if (!contentLength) throw new Error("Could not determine file size");
      const fileSize = parseInt(contentLength, 10);
      const fileName = fileUrl.split("/").pop() || `file-${Date.now()}`;

      // 3. Initiate multipart upload
      const initRes = await fetch(`/api/upload/multipart/initiate?bucket=${selectedBucket}`, {
        method: "POST",
        body: JSON.stringify({ filename: fileName, contentType }),
        headers: { "Content-Type": "application/json" },
      });
      const { uploadId, key } = await initRes.json();
      if (!uploadId) throw new Error("Failed to initiate upload.");

      // 4. Upload configuration
      const chunkSize = 5 * 1024 * 1024; // 5MB chunks
      const totalParts = Math.ceil(fileSize / chunkSize);
      const concurrentUploads = 3;
      const parts: { PartNumber: number; ETag: string }[] = [];

      // 5. Fetch file stream
      const fileRes = await fetch(`/api/proxy?url=${encodeURIComponent(fileUrl)}`);
      if (!fileRes.ok) throw new Error("Failed to fetch file");
      const reader = fileRes.body?.getReader();
      if (!reader) throw new Error("Failed to read file stream");

      // 6. Stream processing variables
      let buffer = new Uint8Array(0);
      let currentPart = 1;
      const uploadQueue: Promise<void>[] = [];

      // 7. Upload chunk function
      const uploadChunk = async (partNumber: number, chunk: Uint8Array) => {
        try {
          // Get presigned URL
          const presignRes = await fetch(`/api/upload/multipart/presign?bucket=${selectedBucket}`, {
            method: "POST",
            body: JSON.stringify({ uploadId, key, partNumber }),
            headers: { "Content-Type": "application/json" },
          });

          const { url } = await presignRes.json();
          if (!url) throw new Error(`Presigned URL missing for part ${partNumber}`);

          // Upload chunk
          const uploadRes = await fetch(url, { method: "PUT", body: chunk });
          if (!uploadRes.ok) throw new Error(`Part ${partNumber} upload failed (${uploadRes.status})`);

          // Store ETag
          const eTag = uploadRes.headers.get("ETag")?.replace(/"/g, "");
          if (!eTag) throw new Error(`ETag missing for part ${partNumber}`);
          parts.push({ PartNumber: partNumber, ETag: eTag });

          // Update progress
          setProgress(prev => ({
            ...prev,
            [fileUrl]: Math.round((parts.length / totalParts) * 100)
          }));
        } catch (error) {
          throw new Error(`Part ${partNumber} failed: ${error instanceof Error ? error.message : String(error)}`);
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
        throw new Error("Failed to complete multipart upload");
      }

      toast.success(`${fileName} uploaded successfully!`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(`Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const handleUpload = async () => {
    const urlList = urls.split("\n").map(url => url.trim()).filter(Boolean);
    if (urlList.length === 0) return;

    setIsUploading(true);
    setProgress(Object.fromEntries(urlList.map(url => [url, 0])));

    await Promise.all(urlList.map(uploadMultipart));
    setIsUploading(false);
  };

  return (
    <div className="w-full mx-auto space-y-4">
      <Textarea
        placeholder="Enter URLs, each on a new line"
        value={urls}
        onChange={(e) => setUrls(e.target.value)}
        rows={6}
        className="w-full"
      />
      <Button onClick={handleUpload} disabled={isUploading}>
        {isUploading ? "Uploading..." : "Upload"}
      </Button>
      {Object.keys(progress).length > 0 && (
        <div className="space-y-2">
          {Object.entries(progress).map(([url, progressValue]) => (
            <div key={url}>
              <p className="text-sm truncate">{url}</p>
              <Progress value={progressValue} className="w-full" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
