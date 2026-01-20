
import Client, { gateway, Environment, Local } from '@/client';
import { SessionData, clientConfig } from './auth-config';
import { signJWT } from './helpers/jose';
import { cookies } from 'next/headers';

const target = process.env.NODE_ENV === 'development' ? Local : Environment('api');

// Create a lightweight client for Edge runtime (uses fetch)
export const edgeClient = new Client(target, {
    // Explicitly us fetch (though Encore client defaults to it, being explicit helps)
    fetcher: fetch
});

export async function createNewSession(session: SessionData) {
    const production = process.env.NODE_ENV === 'production';

    // Generate token locally using the session data we already have
    const payload = {
        sub: production && session.userInfo ? session.userInfo.sub : 'anonymous',
        name: production && session.userInfo ? session.userInfo.name : 'anonymous',
        email: production && session.userInfo ? session.userInfo.email : 'anonymous',
        username: production && session.userInfo ? session.userInfo.username : 'anonymous',
    };

    // Sign a short-lived token (e.g., 5 minutes) for the upload/session creation
    const token = await signJWT(payload, "5m");

    return await edgeClient.gateway.newAuthSession('POST', null, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });
}

export async function refreshSession() {
    const cookieStore = await cookies();
    return await edgeClient.gateway.refreshSession('POST', null, {
        headers: {
            Cookie: cookieStore.toString(),
        },
    })
}
