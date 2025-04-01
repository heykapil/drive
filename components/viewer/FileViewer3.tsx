"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { getFileTypeFromFilename } from "@/lib/utils"
import { Download, File, FileImage, FileText, FileVideo, ScanEyeIcon, X } from "lucide-react"
import { VideoPlayer } from "./VideoPlayer4"

interface FileViewerProps {
  previewFile: {
    name: string
    id: string
    url: string
    type: string
    uploaded_at: string
    size: string
    is_public: boolean
  }
  onClose: () => void
}

export default function FileViewer({ previewFile, onClose }: FileViewerProps) {
  const { name, url, type, uploaded_at, size, id, is_public } = previewFile
  const fileType = getFileTypeFromFilename(name).split("/")[0] || type.split("/")[0]
  const isImage = fileType === "image" || name.match(/\.(jpeg|jpg|gif|png)$/)
  const isVideo = fileType === "video" || name.match(/\.(mp4|webm|ogg|mov)$/)
  const isPdf = type === "application/pdf" || name.match(/\.(pdf)$/)
  const isText = fileType === "text" || name.match(/\.(txt|md|rtf)$/)

  const getFileIcon = () => {
    if (isVideo) return <FileVideo className="w-5 h-5" />
    if (isImage) return <FileImage className="w-5 h-5" />
    if (isPdf || isText) return <FileText className="w-5 h-5" />
    return <File className="w-5 h-5" />
  }

  return (
    <Dialog open={!!previewFile} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh] p-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-2 border-b">
          <div className="flex items-center gap-2 truncate">
            {getFileIcon()}
            <div className="flex flex-col">
              <span className="font-medium truncate max-w-[150px] md:max-w-[300px] lg:max-w-[500px]">{name}</span>
              <span className="text-xs text-muted-foreground">
                Uploaded: {uploaded_at} | Size: {size} | {!is_public ? "Private" : "Public"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="hidden md:flex items-center gap-1"
              onClick={() => window.open(url, "_blank")}
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
            </Button>

            {isPdf && (
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
                onClick={() => window.open(`https://pdf.kapil.app?file=${url}`, "_blank")}
              >
                <ScanEyeIcon className="w-4 h-4" />
                <span>PDF.js</span>
              </Button>
            )}

            <Button variant="outline" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
          {isImage && (
            <div className="relative flex justify-center max-h-full">
              <img
                src={url || "/placeholder.svg"}
                alt={name}
                className="max-w-full max-h-[calc(95vh-120px)] object-contain rounded-md"
              />
            </div>
          )}

          {isVideo && (
            <div className="w-full max-w-4xl">
              <VideoPlayer url={url} id={id} />
            </div>
          )}

          {isPdf && (
            <div className="w-full h-full bg-muted rounded-md overflow-hidden">
              <iframe src={url} title={name} className="w-full h-full border-0" />
            </div>
          )}

          {isText && (
            <div className="w-full h-full bg-white rounded-md overflow-hidden">
              <iframe src={url} title={name} className="w-full h-full border-0" />
            </div>
          )}

          {!isImage && !isVideo && !isPdf && !isText && (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <File className="w-16 h-16 mb-4 text-muted-foreground" />
              <p className="mb-4">Preview not available for this file type</p>
              <Button onClick={() => window.open(url, "_blank")}>Download File</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
