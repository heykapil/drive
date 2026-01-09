import Client, { s3, Environment, Local } from '@/client';
import { getUploadToken } from './actions/auth-token';
import axios from "axios";

const target = process.env.NODE_ENV === 'development' ? Local : Environment('api');

export const client = new Client(target, {
    requestInit: {
        credentials: "include",
    }
});

export async function remoteUpload(params: s3.RemoteUploadRequest) {
    return await client.s3.remoteUpload(params);
}

export async function getJobStatus(jobId: string) {
    return await client.s3.getJobStatus(jobId);
}

export interface LocalUploadRequest {
    file: File | Blob;
    bucket_id: number;
    prefix?: string;
    onProgress?: (percent: number) => void;
    signal?: AbortSignal;
}

export interface LocalUploadResponse {
    success: boolean;
    job_id?: string;
    key: string;
    filename: string;
    size: number;
    error?: string;
    data?: any;
}

export async function localUpload(params: LocalUploadRequest): Promise<LocalUploadResponse> {
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('bucket_id', params.bucket_id.toString());

    if (params.prefix) {
        formData.append('prefix', params.prefix);
    }

    try {
        const token = await getUploadToken();
        const response = await axios.post(`${target}/s3/local`, formData, {
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

        return response.data as LocalUploadResponse;
    } catch (error: any) {
        if (axios.isCancel(error)) {
            throw error;
        }
        return {
            success: false,
            key: '',
            filename: '',
            size: 0,
            error: error.response?.data?.error || error.message || "Upload failed"
        };
    }
}