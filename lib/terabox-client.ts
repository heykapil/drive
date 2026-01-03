import Client, { terabox, Environment } from '@/client';
import { getUploadToken } from './actions/auth-token';
import axios from "axios";

const target = Environment('api');

export const client = new Client(target, {
    auth: async () => {
        const token = await getUploadToken();
        return { authorization: `Bearer ${token}` };
    }
});

export const teraboxClient = client.terabox;

export const isTeraboxUrl = (url: string) => {
    return url.includes('terabox.com') || url.includes('1024tera.com') || url.includes('terabox.app') || url.includes('terabox.fun') || url.includes('mirrobox.com') || url.includes('nephobox.com') || url.includes('freeterabox.com');
}

export async function createBucket(params: terabox.CreateBucketRequest) {
    return await client.terabox.createBucket(params);
}


export async function deleteFiles(params: terabox.DeleteRequest) {
    return await client.terabox.teraboxDelete(params);
}

export async function downloadFile(params: terabox.DownloadRequest) {
    return await client.terabox.teraboxDownload(params);
}

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
    onProgress?: (percent: number) => void;
    signal?: AbortSignal;
}

export async function localUpload(params: LocalUploadRequest) {
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('bucket_id', params.bucket_id.toString());

    if (params.remote_dir) {
        formData.append('remote_dir', params.remote_dir || '/uploads');
    }

    try {
        const token = await getUploadToken();
        const response = await axios.post(`${target}/terabox/local-upload`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                "Authorization": `Bearer ${token}`,
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
        return response.data; // Terabox generated client returned globalThis.Response, but here we return JSON data directly.
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

export async function remoteUpload(params: terabox.RemoteUploadRequest) {
    return await client.terabox.teraboxRemoteUpload(params);
}

export async function saveVideo(params: { urls: string[]; bucket_id: number; userAgent?: string }) {
    return await client.terabox.teraboxSaveVideo(params);
}

export async function streamVideo(method: "POST", body?: RequestInit["body"], options?: any) {
    return await client.terabox.teraboxStream(method, body, options);
}

export async function updateThumbnail(params: { file_id: number; userAgent?: string }) {
    return await client.terabox.teraboxUpdateThumbnail(params);
}
