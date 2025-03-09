"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download } from "lucide-react";
import { VideoPlayer } from "./VideoPlayer2";

interface FileViewerProps {
  previewFile: {
    name: string;
    url: string;
    type: string;
    uploaded_at: string;
    size: string;
    is_public: boolean;
  };
  onClose: () => void;
}

export default function FileViewer({ previewFile, onClose }: FileViewerProps) {
  const { name, url, type, uploaded_at, size, is_public } = previewFile;
  const fileType = type.split("/")[0];
  const isImage = fileType === "image" || name.match(/\.(jpeg|jpg|gif|png)$/);
  const isVideo = fileType === "video" || name.match(/\.(mp4|webm|ogg|mov)$/);
  return (
    <Dialog open={!!previewFile} onOpenChange={onClose}>
      <DialogContent className="min-w-[90%] h-[90vh] flex flex-col">
        <DialogHeader className="flex flex-row justify-between items-center">
          <div className="truncate overflow-x-auto max-w-[150px] lg:max-w-[400px] ">
            <DialogTitle className="text-sm font-semibold">{name}</DialogTitle>
            <p className="text-sm text-gray-500">Uploaded: {uploaded_at} | Size: {size} | {!is_public ? "Private" : "Public"}</p>
          </div>
          <div className="flex gap-2 mr-4">
            <Button variant="outline" onClick={() => window.open(url, "_blank")}>
             Download File  <Download className="w-5 h-5" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex justify-center items-center flex-grow p-1 bg-gray-100 rounded-md overflow-auto">
          {isImage && <img src={url} alt={name} className="max-h-full w-auto rounded-md" />}
          {isVideo && (
            <VideoPlayer url={url} id={url} />
          )}
          {type === "application/pdf" && (
            <iframe src={url} className="w-full h-full bg-white rounded-md border"></iframe>
          )}
          {fileType === "text" && (
            <iframe src={url} className="w-full h-full bg-white rounded-md border"></iframe>
          )}
          {!["image", "video", "application", "text"].includes(fileType) && (
            <p className="text-gray-600">Preview not available for this file type.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
