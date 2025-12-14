"use server";

import { getSession } from "@/lib/auth";
import { signJWT } from "@/lib/helpers/jose";

export async function getUploadToken() {
    const session = await getSession();

    if (!session || !session.isLoggedIn || !session.userInfo) {
        throw new Error("User is not authenticated");
    }

    // Create a payload based on the authenticated user
    const payload = {
        sub: session.userInfo.sub,
        name: session.userInfo.name,
        email: session.userInfo.email,
        username: session.userInfo.username,
    };

    // Sign a short-lived token (e.g., 1 hour) for the upload
    const token = await signJWT(payload, "1h");

    return token;
}
