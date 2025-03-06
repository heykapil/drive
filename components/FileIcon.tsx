import { File, FileArchive, FileAudio, FileBadge, FileCode2, FilePen, FileText, Image, Video } from "lucide-react";

const getFileExtension = (filename: string): string => {
  return filename.split('.').pop()?.toLowerCase() || "";
};

export default function FileIcon({ fileType }: { fileType: string }) {
  const ext = getFileExtension(fileType);

  if (["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp"].includes(ext)) {
    return <Image className="w-5 h-5 text-blue-500" />;
  }

  if (["mp4", "avi", "mov", "mkv", "wmv", "flv", "webm"].includes(ext)) {
    return <Video className="w-5 h-5 text-red-500" />;
  }

  if (["mp3", "wav", "aac", "flac", "ogg", "m4a"].includes(ext)) {
    return <FileAudio className="w-5 h-5 text-purple-500" />;
  }

  if (["pdf"].includes(ext)) {
    return <FileBadge className="w-5 h-5 text-red-600" />;
  }

  if (["zip", "rar", "tar", "7z", "gz"].includes(ext)) {
    return <FileArchive className="w-5 h-5 text-orange-500" />;
  }

  if (["doc", "docx", "txt", "rtf"].includes(ext)) {
    return <FilePen className="w-5 h-5 text-green-500" />;
  }

  if (["xls", "xlsx", "csv"].includes(ext)) {
    return <FileText className="w-5 h-5 text-yellow-500" />;
  }

  if (["js", "jsx", "ts", "tsx", "html", "css", "json", "xml", "py", "java", "c", "cpp"].includes(ext)) {
    return <FileCode2 className="w-5 h-5 text-indigo-500" />;
  }

  return <File className="w-5 h-5 text-gray-500" />;
}
