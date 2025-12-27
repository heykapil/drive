import Client, { Local, Environment } from '@/client';
import { getUploadToken } from './actions/auth-token';

// Determine the target environment based on NODE_ENV or other config
// Adjust this logic if you have specific environment naming conventions
const target = process.env.NODE_ENV === 'production'
    ? Environment('api-hszi') // Replace 'api-hszi' with your actual environment name if different, but 'api-hszi' is in the generated client.
    : Local;

export const client = new Client(target, {
    auth: async () => {
        const token = await getUploadToken();
        return { authorization: `Bearer ${token}` };
    }
});
