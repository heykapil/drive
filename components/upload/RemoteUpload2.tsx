'use client'
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useBucketStore } from "@/hooks/use-bucket-store";
import { sanitizeFileName } from "@/lib/helpers/sanitize-file-name";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";

export default function RemoteUpload() {
  const [useProxy, setUseProxy] = useState(false);
  const [proxyUrl, setProxyUrl] = useState("https://stream.kapil.app");
  const [urls, setUrls] = useState("");
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [lineHeight, setLineHeight] = useState(20); // Default line height

  useEffect(() => {
      if (textAreaRef.current) {
        const computedStyle = window.getComputedStyle(textAreaRef.current);
        setLineHeight(parseInt(computedStyle.lineHeight, 10) || 20);
      }
    }, [urls]);

    // Sync scrolling between textarea and line numbers
    const handleScroll = () => {
      if (lineNumbersRef.current && textAreaRef.current) {
        lineNumbersRef.current.scrollTop = textAreaRef.current.scrollTop;
      }
    };

  const { selectedBucket } = useBucketStore()
  const handleUpload = async(useProxy: boolean, proxyUrl?:string) => {
    const urlList = urls.split("\n").map(url => url.trim()).filter(Boolean);
    const proxy = useProxy ? proxyUrl : undefined;
    if (urlList.length === 0) return toast.error("No URLs found");
    setProgress(Object.fromEntries(urlList.map((url) => [url, 0])));
    for (const [index, url] of urlList.entries()) {
      toast.promise(uploadMultipart(url, selectedBucket, setProgress, proxy), {
        loading: `Uploading... ${index + 1} of ${urlList.length}`,
        error: `Error occured in number ${index + 1} URL: ${url}`,
      })
    }
    setIsUploading(false);
  };

  return (
  <div className="w-full mx-auto space-y-6 p-2">
        <Card className="">
          <CardContent className="space-y-4">
            <div className="relative w-full mx-auto">
                  <div className="flex">
                    {/* Line Numbers (Now Scrollable & Perfectly Aligned) */}
                    <div
                      ref={lineNumbersRef}
                      className="absolute left-0 top-0 bottom-0 w-8 bg-secondary text-primary
                               flex flex-col items-end pr-2 pt-3 rounded-lg text-xs overflow-hidden"
                      style={{ overflowY: "hidden" }}
                    >
                      {urls.split("\n").map((_, index) => (
                        <span
                          key={index}
                          className="leading-none"
                          style={{ height: `${lineHeight}px`, lineHeight: `${lineHeight}px` }}
                        >
                          {index + 1}
                        </span>
                      ))}
                    </div>

                    {/* Textarea with Scrolling */}
                    <Textarea
                      ref={textAreaRef}
                      placeholder="Enter URLs, each on a new line"
                      value={urls}
                      onChange={(e) => setUrls(e.target.value)}
                      onScroll={handleScroll} // Sync scrolling
                      rows={6}
                      className="w-full font-mono text-sm tracking-wide pl-10 pr-3 pt-3 resize-none overflow-auto
                                 whitespace-nowrap border rounded-lg bg-background text-foreground
                                 focus:ring-0 focus:ring-blue-500 focus:outline-none leading-[20px]"
                      style={{ overflowX: "auto" }}
                    />
                  </div>
                </div>

              {/* Proxy Switch & Input */}
              <div className="flex flex-row space-x-4 gap-4 my-8 h-6 items-center justify-between">
              <div className="flex items-center gap-4 min-w-fit">
                <Switch checked={useProxy} onCheckedChange={setUseProxy} />
                <span className="text-sm">Use Proxy</span>
              </div>
              {useProxy && (
                <Input
                  type="text"
                  placeholder="Enter Proxy URL"
                  value={proxyUrl}
                  onChange={(e) => setProxyUrl(e.target.value)}
                  className="flex w-full"
                />
              )}
            </div>

            <Button onClick={async()=>await handleUpload(useProxy, proxyUrl)} disabled={isUploading} className="w-full">
              {isUploading ? "Uploading..." : `Upload to ${selectedBucket}`}
            </Button>
          </CardContent>
        </Card>
      {Object.keys(progress).length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-4">
            {Object.entries(progress).map(([url, progressValue]) => (
              <div key={url} className="space-y-1">
                <p className="text-sm font-medium truncate overflow-hidden max-w-full" title={url}>
                  {url.length > 30 ? `${url.substring(0, 47)}...` : url}
                </p>
                <div className="flex items-center gap-2">
                  <Progress value={progressValue} className="w-full" />
                  <span className="text-xs font-medium w-12 text-right">{progressValue}%</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
  </div>
  );
}

export const uploadMultipart = async (fileUrl: string, selectedBucket: string, setProgress: any, proxy?: string) => {

  try {
    toast.info('Uploading file from url:', {
      description: fileUrl
    })

    // 0. Use proxy
    const proxyDomain = proxy ? proxy : (process.env.NODE_ENV === "development" ? "/api/proxy" : "https://stream.kapil.app")
    const proxyUrl = `${proxyDomain}?url=${encodeURIComponent(fileUrl)}`;
    toast.info('Using proxy', {
      description: proxyDomain
    })

    // 1. Get file metadata

    const headRes = await fetch(proxyUrl, {
      method: "HEAD",
    });
    if (!headRes.ok) toast.error("Failed to fetch file metadata");

    // 2. Extract metadata
    const contentLength = headRes.headers.get("content-length");
    const contentType = headRes.headers.get("content-type") || "application/octet-stream";
    if (!contentLength) {
      toast.error('Could not determine file size')
      throw new Error("Could not determine file size")
    } else {
      toast.info('Fetched file url..', {
        description: fileUrl
      })
    }
    const fileSize = parseInt(contentLength as string, 10);
    const fileName = sanitizeFileName(fileUrl.split("/").pop() || `file-${Date.now()}`);

    // 3. Initiate multipart upload
    const initRes = await fetch(`/api/upload/multipart/initiate?bucket=${selectedBucket}`, {
      method: "POST",
      body: JSON.stringify({ filename: fileName, contentType }),
      headers: { "Content-Type": "application/json" },
    });
    const { uploadId, key } = await initRes.json();
    if (!uploadId) {
      toast.error('Failed to initiate upload')
      throw new Error("Failed to initiate upload.")
    } else{
      toast.info('Preparing for upload...', { description: 'Generating presign urls for chunks!' })
    }


    // 4. Upload configuration
    const chunkSize = 5 * 1024 * 1024; // 5MB chunks
    const totalParts = Math.ceil(fileSize / chunkSize);
    const concurrentUploads = 3;
    const parts: { PartNumber: number; ETag: string }[] = [];

    // 5. Fetch file stream
    const fileRes = await fetch(`${proxyDomain}?url=${encodeURIComponent(fileUrl)}`);

    if (!fileRes.ok) {
      toast.error('Failed to fetch file')
      throw new Error("Failed to fetch file")
    }
    const reader = fileRes.body?.getReader();
    if (!reader) {
      toast.error('Failed to read stream')
      throw new Error("Failed to read file stream")
    }

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
        if (!url) {
          toast.error(`Presigned URL missing for part ${partNumber}`)
          throw new Error(`Presigned URL missing for part ${partNumber}`)
        }

        // Upload chunk
        const uploadRes = await fetch(url, { method: "PUT", body: chunk });
        if (!uploadRes.ok) {
          toast.error(`Part ${partNumber} upload failed (${uploadRes.status})`)
          throw new Error(`Part ${partNumber} upload failed (${uploadRes.status})`)
        } else {
          toast.info('Uploading...', { description: `Part ${partNumber} of ${totalParts} uploaded` })
        }

        // Store ETag
        const eTag = uploadRes.headers.get("ETag")?.replace(/"/g, "");
        if (!eTag) {
          toast.error(`Etag missing for part ${partNumber}`)
          throw new Error(`ETag missing for part ${partNumber}`)
        };
        parts.push({ PartNumber: partNumber, ETag: eTag });

        // Update progress
        setProgress((prev: any) => ({
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
