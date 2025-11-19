import { removeS3Client } from "@/service/s3-tebi";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { uploadId } = await req.json();
        if (uploadId) {
            removeS3Client(uploadId as string);
        }
        return NextResponse.json({ success: true, message: "Upload resources cleaned up." });
    } catch (error) {
        console.error("Error cleaning up upload resources:", error);
        return NextResponse.json({ success: false, error: "Failed to clean up resources" }, { status: 500 });
    }
}
