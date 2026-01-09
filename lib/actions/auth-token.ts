"use server";

import { getSession } from "@/lib/auth";
import { signJWT } from "@/lib/helpers/jose";

export async function getUploadToken() {
    const session = await getSession();
    const production = process.env.NODE_ENV === "production";
    if (production && (!session || !session.isLoggedIn || !session.userInfo)) {
        throw new Error("User is not authenticated");
    }

    // Create a payload based on the authenticated user
    const payload = {
        sub: production ? session.userInfo!.sub : 'anonymous',
        name: production ? session.userInfo!.name : 'anonymous',
        email: production ? session.userInfo!.email : 'anonymous',
        username: production ? session.userInfo!.username : 'anonymous',
    };

    // Sign a short-lived token (e.g., 1 hour) for the upload
    const token = await signJWT(payload, "5m");

    return token;
}
