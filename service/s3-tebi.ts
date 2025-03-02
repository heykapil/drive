import {
    CopyObjectCommand,
    DeleteObjectCommand,
    ListObjectsCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import { nanoid } from './nanoid';
type StorageListResponse = {
  url: string
  fileName: string
  uploadedAt?: Date
}[];

const AWS_BUCKET = process.env.AWS_BUCKET_NAME ?? '';
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID ?? '';
const AWS_SECRET_ACCESS_KEY =
  process.env.AWS_SECRET_ACCESS_KEY ?? '';
const AWS_ENDPOINT = process.env.AWS_ENDPOINT ?? '';

export const Client = () =>
  new S3Client({
    region: 'auto',
    endpoint: AWS_ENDPOINT,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });
export const AWS_BASE_URL_PUBLIC = 'https://cdn.kapil.app'
export const AWS_BASE_URL_PRIVATE =
  AWS_ENDPOINT && AWS_BUCKET
    ? `${AWS_ENDPOINT}/${AWS_BUCKET}`
    : undefined;

const urlForKey = (key?: string, isPublic = true) =>
  isPublic
    ? `${AWS_BASE_URL_PUBLIC}/${key}`
    : `${AWS_BASE_URL_PRIVATE}/${key}`;

export const isUrlFromCloudflareR2 = (url?: string) =>
  (AWS_BASE_URL_PRIVATE &&
    url?.startsWith(AWS_BASE_URL_PRIVATE)) ||
  (AWS_BASE_URL_PUBLIC &&
    url?.startsWith(AWS_BASE_URL_PUBLIC));

export const s3PutObjectCommandForKey = (Key: string) =>
  new PutObjectCommand({ Bucket: AWS_BUCKET, Key });

export const s3Put = async (
  file: Buffer,
  fileName: string,
): Promise<string> =>
Client()
    .send(
      new PutObjectCommand({
        Bucket: AWS_BUCKET,
        Key: fileName,
        Body: file,
      }),
    )
    .then(() => urlForKey(fileName));

export const s3Copy = async (
  fileNameSource: string,
  fileNameDestination: string,
  addRandomSuffix?: boolean,
) => {
  const name = fileNameSource.split('.')[0];
  const extension = fileNameSource.split('.')[1];
  const Key = addRandomSuffix
    ? `${name}-${nanoid(6)}.${extension}`
    : fileNameDestination;
  return Client()
    .send(
      new CopyObjectCommand({
        Bucket: AWS_BUCKET,
        CopySource: `${AWS_BUCKET}/${fileNameSource}`,
        Key,
      }),
    )
    .then(() => urlForKey(fileNameDestination));
};

export const s3List = async (
  Prefix: string,
): Promise<StorageListResponse> =>
  Client()
    .send(
      new ListObjectsCommand({
        Bucket: AWS_BUCKET,
        Prefix,
      }),
    )
    .then(
      (data) =>
        data.Contents?.map(({ Key, LastModified }) => ({
          url: urlForKey(Key),
          fileName: Key ?? '',
          uploadedAt: LastModified,
        })) ?? [],
    );

export const s3Delete = async (Key: string) => {
  Client().send(
    new DeleteObjectCommand({
      Bucket: AWS_BUCKET,
      Key,
    }),
  );
};

const getStorageUrlsForPrefix = async (prefix = '') => {
  const urls: StorageListResponse = [];
    urls.push(...await s3List(prefix)
      .catch(() => []));


  return urls
    .sort((a, b) => {
      if (!a.uploadedAt) { return 1; }
      if (!b.uploadedAt) { return -1; }
      return b.uploadedAt.getTime() - a.uploadedAt.getTime();
    });
};

export const testStorageConnection = () =>
  getStorageUrlsForPrefix();
