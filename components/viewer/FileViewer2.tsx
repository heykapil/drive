"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

interface FileViewerProps {
  previewFile: {
    name: string;
    url: string;
    type: string;
  };
  onClose: () => void;
}

export default function FileViewer({ previewFile, onClose }: FileViewerProps) {
  const [fileType, setFileType] = useState<string>("");

  useEffect(() => {
    if (previewFile?.type) {
      setFileType(previewFile.type.split("/")[0]); // Get the primary type (image, video, etc.)
    }
  }, [previewFile]);

  return (
    <Dialog open={!!previewFile} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl w-full">
        <DialogHeader className="flex justify-between items-center">
          <DialogTitle className="text-lg font-semibold">{previewFile.name}</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="flex justify-center items-center p-4 bg-gray-100 rounded-md">
          {fileType === "image" && <img src={previewFile.url} alt={previewFile.name} className="max-h-96 w-auto rounded-md" />}
          {fileType === "video" && (
            <video controls className="max-h-96 w-auto rounded-md">
              <source src={previewFile.url} type={previewFile.type} />
              Your browser does not support the video tag.
            </video>
          )}
          {fileType === "application" && previewFile.type === "application/pdf" && (
            <iframe src={previewFile.url} className="w-full h-96 rounded-md"></iframe>
          )}
          {fileType === "text" && (
            <iframe src={previewFile.url} className="w-full h-96 bg-white rounded-md border"></iframe>
          )}
          {!["image", "video", "application", "text"].includes(fileType) && (
            <p className="text-gray-600">Preview not available for this file type.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
