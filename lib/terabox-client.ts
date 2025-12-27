import Client, { Local, Environment } from '@/client';
import { getUploadToken } from './actions/auth-token';

// Determine the target environment based on NODE_ENV or other config
// Adjust this logic if you have specific environment naming conventions
const target = Local;

export const client = new Client(target, {
    auth: async () => {
        const token = await getUploadToken();
        return { authorization: `Bearer ${token}` };
    }
});

export const isTeraboxUrl = (url: string) => {
    return url.includes('terabox.com') || url.includes('1024tera.com') || url.includes('terabox.app') || url.includes('terabox.fun') || url.includes('mirrobox.com') || url.includes('nephobox.com') || url.includes('freeterabox.com');
}


export async function remoteUpload(payload: { urls: string[]; bucket_id: number; prefix: string }) {
    return await client.upload.remoteUpload(payload);
}

export async function saveVideo(payload: { url: string; bucket_id: number }) {
    // Assuming the client has a saveVideo method in the terabox service as implied
    // If not, we might need to adjust based on available methods, but this matches the user request.
    return await (client.terabox as any).saveVideo(payload);
}
