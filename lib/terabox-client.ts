import Client, { terabox, Environment, migrations, Local } from '@/client';
import axios from "axios";

const target = process.env.NODE_ENV === 'development' ? Local : Environment('api');

export const client = new Client(target, {
    requestInit: {
        credentials: "include"
    }
});

export const createClient = (options?: any) => new Client(target, options);


export interface JobResponse {
    success: boolean;
    job_id: string;
    queued_count?: number;
    message: string;
    data?: any;
    error?: string;
}

export const teraboxClient = client.terabox;


export const isTeraboxUrl = (url: string) => {
    return url.includes('terabox.com') || url.includes('1024tera.com') || url.includes('terabox.app') || url.includes('terabox.fun') || url.includes('mirrobox.com') || url.includes('nephobox.com') || url.includes('freeterabox.com');
}

export async function backfillDuration(params: { limit?: number }, customClient?: any) {
    return await (customClient || client).terabox.teraboxBackfillDuration(params);
}

export async function backfillQuality(params: { limit?: number }, customClient?: any) {
    return await (customClient || client).terabox.teraboxBackfillQuality(params);
}

export async function backfillShareId(params: { limit?: number }, customClient?: any) {
    return await (customClient || client).terabox.teraboxBackfillShareId(params);
}

export async function createBucket(params: terabox.CreateBucketRequest) {
    return await client.terabox.createBucket(params);
}

export async function debugFileInfo(params: { fileId: number }) {
    return await client.terabox.debugFileInfo(params);
}

export async function deleteFiles(params: terabox.DeleteRequest, customClient?: any) {
    return await (customClient || client).terabox.teraboxDelete(params);
}

export async function downloadFile(params: terabox.DownloadRequest) {
    return await client.terabox.teraboxDownload(params);
}


/**
 * Terabox File manager copy/move/rename/delete files
 *     operation - copy (file copy), move (file movement), rename (file renaming), and delete (file deletion)
 *     opera=copy: filelist: [{"path":"/hello/test.mp4","dest":"","newname":"test.mp4"}]
 *     opera=move: filelist: [{"path":"/test.mp4","dest":"/test_dir","newname":"test.mp4"}]
 *     opera=rename: filelist：[{"path":"/hello/test.mp4","newname":"test_one.mp4"}]
 *     opera=delete: filelist: ["/test.mp4"]
 */
export async function fileManager(params: terabox.FileManagerRequest) {
    return await client.terabox.teraboxFileManager(params);
}

export async function getUploadHost(params: terabox.GetUploadHostRequest) {
    return await client.terabox.teraboxGetUploadHost(params);
}

export interface LocalUploadRequest {
    file: File | Blob;
    bucket_id: number;
    remote_dir?: string;
    encrypt?: boolean;
    onProgress?: (percent: number) => void;
    signal?: AbortSignal;
}

export async function localUpload(params: LocalUploadRequest): Promise<JobResponse> {
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('bucket_id', params.bucket_id.toString());

    if (params.remote_dir) {
        formData.append('remote_dir', params.remote_dir || '/uploads');
    }

    if (params.encrypt !== undefined) {
        formData.append('encrypt', params.encrypt.toString());
    }

    try {
        const response = await axios.post(`${target}/terabox/local-upload`, formData,
            {
                withCredentials: true,
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                signal: params.signal,
                onUploadProgress: (progressEvent) => {
                    if (params.onProgress && progressEvent.total) {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        params.onProgress(percentCompleted);
                    }
                }
            });

        // Return raw response data as standard
        // Return raw response data as standard
        return response.data as JobResponse;
        // Note: The previous generated wrapper `teraboxLocalUpload` returned `Promise<globalThis.Response>`.
        // Check usages if any expect Response object. `RemoteUpload4` just uses it. `FileUpload5` will use it.
    } catch (error: any) {
        if (axios.isCancel(error)) {
            throw error;
        }
        // Mimic error response structure or throw?
        // Let's throw to let caller handle error
        if (error.response?.data) throw new Error(error.response.data.error || error.message);
        throw error;
    }
}

export async function precreateFile(params: terabox.PrecreateFileRequest) {
    return await client.terabox.teraboxPrecreateFile(params);
}

export async function proxy(method: "GET", body?: RequestInit["body"], options?: any) {
    return await client.terabox.teraboxProxy(method, body, options);
}

export async function getQuota(params: { bucket_id?: number; userAgent?: string }) {
    return await client.terabox.teraboxQuota(params);
}

export async function remoteUpload(params: terabox.RemoteUploadRequest): Promise<JobResponse> {
    const res = await client.terabox.teraboxRemoteUpload(params);
    return res as unknown as JobResponse;
}

export async function saveVideo(params: { urls: string[]; bucket_id: number; userAgent?: string }): Promise<JobResponse> {
    const res = await client.terabox.teraboxSaveVideo(params);
    return res as unknown as JobResponse;
}

export async function serveStreamM3U8(method: "GET", fileId: string, body?: RequestInit["body"], options?: any) {
    return await client.terabox.serveStreamM3U8(method, fileId, body, options);
}

export async function generateGifPreview(params: { file_id: number }) {
    return await client.terabox.teraboxGenerateGifPreview(params);
}


export async function streamVideo(method: "POST", body?: RequestInit["body"], options?: any) {
    return await client.terabox.teraboxStream(method, body, options);
}

export async function updateThumb(params: migrations.UpdateThumbnailRequest) {
    return await client.terabox.teraboxUpdateThumb(params);
}

export async function updateDuration(params: { file_id: number }) {
    return await client.terabox.updateDuration(params);
}

export async function updateQuality(params: { file_id: number }) {
    return await client.terabox.updateQuality(params);
}

export async function updateShareId(params: { file_id: number }) {
    return await client.terabox.updateShareId(params);
}

export async function downloadProxy(method: "GET", fileId: string, body?: RequestInit["body"], options?: any) {
    return await client.terabox.teraboxDownloadProxy(method, fileId, body, options);
}

export async function emptyRecycleBin(params: { bucket_id?: number; userAgent?: string }) {
    return await client.terabox.teraboxEmptyRecyleBin(params);
}

export async function getRecycleBin(params: { bucket_id?: number; userAgent?: string }) {
    return await client.terabox.teraboxGetRecyleBin(params);
}

export async function getThumbnail(params: { share_id: string; bucket_id: number; userAgent?: string }) {
    return await client.terabox.teraboxThumbnail(params);
}

