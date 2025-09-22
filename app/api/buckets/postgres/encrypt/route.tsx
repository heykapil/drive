import { decryptSecret } from "@/lib/helpers/jose";
import { decryptTokenV4, encryptTokenV4 } from "@/lib/helpers/paseto-ts";
import { getBucketConfig } from "@/service/bucket.config";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest){
  const { bucketId } = await req.json();
  if (!bucketId || bucketId === isNaN) {
    return NextResponse.json({
      error: 'Bucket Id is required'
    })
  }
  const config = await getBucketConfig(bucketId)
  const payload = {
    name: config[0].name,
    accessKey: await decryptSecret(config[0].accessKey),
    secretKey: await decryptSecret(config[0].secretKey),
    region: config[0].region,
    endpoint: config[0].endpoint,
    availableCapacity: config[0]?.storageUsedBytes || 20,
    private: config[0]?.private || true,
    cdnUrl: config[0]?.cdnUrl || '',
    provider: config[0]?.provider || 'synology'
  }
  const token = await encryptTokenV4(payload) as string;
  console.log(token);
  const decode = await decryptTokenV4(token);
  console.log(decode)
  return NextResponse.json({ token })
}
