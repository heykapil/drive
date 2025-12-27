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
