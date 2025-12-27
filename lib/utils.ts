import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDate(dateString: string | Date) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}


const mimeTypeMap: Record<string, string> = {
  // Video formats
  ".vid": "video/mp4", // Assuming .vid is MP4, update if needed
  ".mp4": "video/mp4",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".wmv": "video/x-ms-wmv",
  ".flv": "video/x-flv",
  ".webm": "video/webm",

  // Image formats
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".tiff": "image/tiff",
  ".ico": "image/x-icon",

  // Audio formats
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",

  // Document formats
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".json": "application/json",
  ".xml": "application/xml",
  ".md": "text/markdown",

  // Compressed formats
  ".zip": "application/zip",
  ".rar": "application/vnd.rar",
  ".7z": "application/x-7z-compressed",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",

  // Code formats
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".ts": "application/typescript",
  ".jsx": "text/javascript",
  ".tsx": "application/typescript",
  ".py": "text/x-python",
  ".java": "text/x-java-source",
  ".cpp": "text/x-c",
  ".c": "text/x-c",
  ".go": "text/x-go",
  ".rb": "text/x-ruby",
  ".php": "text/x-php",
  ".sh": "application/x-sh",
  ".bat": "application/x-msdos-program",

  // Default binary type
  ".bin": "application/octet-stream",
};

export const getFileType = (file: File) => {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  return mimeTypeMap[extension] || file.type || "application/octet-stream";
};

export const getFileTypeFromFilename = (filename: string): string => {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1) {
    return "application/octet-stream";
  }
  const extension = filename.slice(dotIndex).toLowerCase();
  return mimeTypeMap[extension] || "application/octet-stream";
};

// Define the types for our data for type safety
export interface Bucket {
  bucket_id: number;
  bucket_name: string;
  private?: boolean; // S3 specific
  provider: string; // 'AWS', 'Terabox', etc.
  storage_used_bytes: number | string;
  total_capacity_gb: number | string;
  available_storage_gb: number | string;
  usage_percentage: number | string;
  updated_at: string | Date;

  // Frontend specific unique ID to handle ID collisions between S3 and TB
  uniqueId?: string; // e.g. "s3_123" or "tb_456"
  bucketType?: 'S3' | 'TB';
}

// Represents a folder row from the new `/api/folders/all` endpoint
export interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
}

export interface FolderNode {
  folder_id: number;
  folder_name: string;
  folder_parent_id: number | null;
  children: FolderNode[]; // For nested subfolders
  buckets: Bucket[];      // For buckets directly inside this folder
}

// The raw data format from your buckets API
type ApiBucketEntry = Bucket & {
  folder_id: number;
  folder_name: string;
  folder_parent_id: number | null;
};

/**
 * Transforms a list of all folders and a list of bucket data
 * into a complete hierarchical tree structure.
 * @param allFolders A list of all folders from the `folders` table.
 * @param bucketData The flat array from '/api/buckets/postgres'.
 * @returns An array of root-level folder nodes.
 */
export function buildFolderTree(allFolders: Folder[], bucketData: ApiBucketEntry[]): FolderNode[] {
  const folderMap: { [key: number]: FolderNode } = {};

  // First pass: Create a map of ALL folders using the complete list from the new API.
  // This is the crucial step that ensures even folders without direct buckets are included.
  allFolders.forEach(folder => {
    folderMap[folder.id] = {
      folder_id: folder.id,
      folder_name: folder.name,
      folder_parent_id: folder.parent_id,
      children: [],
      buckets: [], // Initialize with empty buckets
    };
  });

  // Second pass: Populate the buckets into their respective folders.
  bucketData.forEach(item => {
    const { folder_id, ...bucketDetails } = item;
    // Check if the folder exists in our map before adding buckets
    if (folderMap[folder_id]) {
      folderMap[folder_id].buckets.push({ ...bucketDetails });
    }
  });

  // Third pass: Link children to their parents to build the final tree.
  const rootFolders: FolderNode[] = [];
  Object.values(folderMap).forEach(folderNode => {
    if (folderNode.folder_parent_id && folderMap[folderNode.folder_parent_id]) {
      // If it has a parent that exists in our map, add it as a child.
      folderMap[folderNode.folder_parent_id].children.push(folderNode);
    } else {
      // Otherwise, it's a root folder.
      rootFolders.push(folderNode);
    }
  });

  return rootFolders;
}
