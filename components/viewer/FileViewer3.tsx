"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { getFileTypeFromFilename } from "@/lib/utils"
import { Copy, Download, ExternalLink, File, FileImage, FileText, FileVideo, X } from "lucide-react"
import { toast } from "sonner"
import { VideoPlayer } from "./VideoPlayer"

interface FileViewerProps {
  previewFile: {
    name: string
    id: string
    url: string
    type: string
    uploaded_at: string
    size: string
    is_public: boolean
    thumbnail?: string | null
  }
  onClose: () => void
}

export default function FileViewer({ previewFile, onClose }: FileViewerProps) {
  const { name, url, type, uploaded_at, size, id, is_public } = previewFile
  const fileType = getFileTypeFromFilename(name).split("/")[0] || type.split("/")[0]
  const isImage = fileType === "image" || name.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i)
  const isVideo = fileType === "video" || name.match(/\.(mp4|webm|ogg|mov)$/i)
  const isPdf = type === "application/pdf" || name.match(/\.(pdf)$/i)
  const isText = fileType === "text" || name.match(/\.(txt|md|rtf|json|xml|js|ts|css|html)$/i)

  const getFileIcon = () => {
    if (isVideo) return <FileVideo className="w-5 h-5 text-blue-400" />
    if (isImage) return <FileImage className="w-5 h-5 text-purple-400" />
    if (isPdf || isText) return <FileText className="w-5 h-5 text-orange-400" />
    return <File className="w-5 h-5 text-gray-400" />
  }

  const copyLink = () => {
    navigator.clipboard.writeText(url)
    toast.success("Link copied to clipboard")
  }

  return (
    <Dialog open={!!previewFile} onOpenChange={onClose}>
      <DialogContent className="max-w-[98vw] max-h-[98vh] w-full h-full md:w-[95vw] md:h-[95vh] p-0 gap-0 bg-black/95 border-white/10 backdrop-blur-xl overflow-hidden flex flex-col shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-xl">
        <DialogTitle className="sr-only">Preview: {name}</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5 backdrop-blur-md z-50">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 bg-white/10 rounded-lg shrink-0">
              {getFileIcon()}
            </div>
            <div className="flex flex-col overflow-hidden">
              <h2 className="text-sm font-medium text-white truncate max-w-[200px] md:max-w-md lg:max-w-xl">
                {name}
              </h2>
              <div className="flex items-center gap-2 text-xs text-white/60">
                <span>{size}</span>
                <span className="w-1 h-1 bg-white/20 rounded-full" />
                <span>{uploaded_at}</span>
                <span className="w-1 h-1 bg-white/20 rounded-full" />
                <span className={is_public ? "text-green-400" : "text-yellow-400"}>
                  {is_public ? "Public" : "Private"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white/70 hover:text-white hover:bg-white/10 h-9 w-9 hidden sm:flex"
              onClick={copyLink}
              title="Copy Link"
            >
              <Copy className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="text-white/70 hover:text-white hover:bg-white/10 h-9 w-9 hidden sm:flex"
              onClick={() => window.open(url, "_blank")}
              title="Open in New Tab"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="text-white/70 hover:text-white hover:bg-white/10 h-9 gap-2 hidden md:flex"
              asChild
            >
              <a href={url} download target="_blank" rel="noopener noreferrer">
                <Download className="w-4 h-4" />
              </a>
            </Button>

            <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block" />

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white/70 hover:text-white hover:bg-red-500/20 hover:text-red-400 h-9 w-9 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative bg-black/50 flex items-center justify-center w-full h-full">
          {isImage && (
            <div className="w-full h-full flex items-center justify-center p-4 md:p-8">
              <img
                src={url}
                alt={name}
                className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
              />
            </div>
          )}

          {isVideo && (
            <div className="w-full h-full flex items-center justify-center bg-black">
              <div className="w-full max-w-6xl aspect-video max-h-full">
                <VideoPlayer url={url} id={id} poster={previewFile.thumbnail || undefined} />
              </div>
            </div>
          )}

          {isPdf && (
            <iframe
              src={`${url}#toolbar=0`}
              className="w-full h-full border-none bg-white"
              title={name}
            />
          )}

          {isText && (
            <div className="w-full h-full bg-[#1e1e1e] overflow-auto p-8">
              <iframe
                src={url}
                className="w-full h-full border-none bg-white rounded-lg shadow-lg"
                title={name}
              />
            </div>
          )}

          {!isImage && !isVideo && !isPdf && !isText && (
            <div className="flex flex-col items-center justify-center p-8 text-center text-white/60">
              <div className="w-24 h-24 bg-white/5 rounded-2xl flex items-center justify-center mb-6 animate-pulse">
                <File className="w-12 h-12 opacity-50" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">Preview not available</h3>
              <p className="max-w-md mb-8">
                This file type cannot be previewed directly in the browser.
                Please download the file to view it.
              </p>
              <Button
                variant="secondary"
                size="lg"
                className="gap-2 font-medium"
                onClick={() => window.open(url, "_blank")}
              >
                <Download className="w-4 h-4" />
                Download File
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
