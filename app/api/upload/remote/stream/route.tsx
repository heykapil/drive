import { buckets } from "@/service/bucket.config";
import { query } from "@/service/postgres";
import { s3WithConfig } from "@/service/s3-tebi";
import { Upload } from "@aws-sdk/lib-storage";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const bucket = searchParams.get("bucket") || "";
    if(!bucket){
      return NextResponse.json({success: false, error: 'Bucket name not provided'})
    }
    const bucketConfig = buckets[bucket]

    if(!bucketConfig.name){
      return NextResponse.json({success: false, error: 'Wrong bucket id provided'})
    }

    const { fileUrl, fileName, contentType, fileSize } = await req.json();
    if (!fileUrl) return NextResponse.json({ error: "File URL is required" }, { status: 400 });
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error("Failed to fetch file");

    const stream = response.body;
    if (!stream) throw new Error("No readable stream found");

    const client = await s3WithConfig(bucketConfig)
    const uploader = new Upload({
          client: client,
          params: {
            Bucket: bucketConfig.name,
            Key: `uploads/${fileName}`,
            Body: stream,
            ContentType: contentType || "application/octet-stream",
          },
        });
    await uploader.done().then(async() =>
    await query(
"INSERT INTO files (filename, key, size, type, bucket) VALUES ($1, $2, $3, $4, $5)",
[fileName, `uploads/${fileName}`, fileSize, contentType, bucketConfig.name]
)
    )


    return NextResponse.json({
      message: "File uploaded successfully",
      });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
