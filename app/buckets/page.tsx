import { getallPublicPrivateBuckets } from "@/service/bucket.config";
import { S3BucketViewer } from "./ClientPage";

export default async function BucketPage() {
  const buckets = await getallPublicPrivateBuckets();
  return (
    <div>
     <S3BucketViewer buckets={buckets} />
    </div>
  );
}
