"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useBucketStore } from "@/hooks/use-bucket-store";
import { extractVideoFromPage, VideoData } from "@/lib/videoExtactor";
import { useState } from "react";
import { uploadMultipart } from "./RemoteUpload2";


export default function RemoteUploadForm() {
  const [urls, setUrls] = useState("");
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});

  const { selectedBucket } = useBucketStore()
  const handleExtractVideos = async () => {
    setLoading(true);
    setVideos([]);
    const pages = urls.split("\n").map((url) => url.trim()).filter(Boolean);

    const allVideos: VideoData[] = [];
    for (const page of pages) {
      const extractedVideos = await extractVideoFromPage(page, '/api/proxy' );
      allVideos.push(...extractedVideos);
    }

    setVideos(allVideos);
    setIsDialogOpen(true);
    setLoading(false);
  };

  const handleUpload = async () => {
    for (const fileUrl of selectedVideos) {
      await uploadMultipart(fileUrl, selectedBucket, setProgress);
    }
    setIsDialogOpen(false);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Textarea
        placeholder="Enter page URLs, one per line..."
        value={urls}
        onChange={(e) => setUrls(e.target.value)}
        className="w-full h-40"
      />
      <Button onClick={handleExtractVideos} disabled={loading}>
        {loading ? "Extracting..." : "Extract Videos"}
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Videos to Upload</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {videos.length === 0 ? (
              <p>No videos found.</p>
            ) : (
              videos.map((video) => (
                <div key={video.url} className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedVideos.has(video.url)}
                    onCheckedChange={(checked) => {
                      setSelectedVideos((prev) => {
                        const newSet = new Set(prev);
                        // @ts-ignore
                        checked ? newSet.add(video.url) : newSet.delete(video.url);
                        return newSet;
                      });
                    }}
                  />
                  <a href={video.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline truncate w-64">
                    {video.url}
                  </a>
                  {video.previewUrl && <img src={video.previewUrl} alt="Preview" className="w-10 h-10 rounded-md" />}
                </div>
              ))
            )}
          </div>
          <Button onClick={handleUpload} disabled={selectedVideos.size === 0}>
            Upload Selected Videos
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
