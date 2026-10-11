import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

let client: S3Client | null = null;

function config() {
  const { S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_REGION } = process.env;
  if (!S3_BUCKET || !S3_ENDPOINT || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) return null;
  return {
    bucket: S3_BUCKET,
    endpoint: S3_ENDPOINT,
    region: S3_REGION || "auto",
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  };
}

export function storageConfigured(): boolean {
  return config() !== null;
}

function getClient() {
  const c = config();
  if (!c) throw new Error("Storage is not configured");
  if (!client) {
    client = new S3Client({
      region: c.region,
      endpoint: c.endpoint,
      credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
    });
  }
  return { s3: client, bucket: c.bucket };
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  const { s3, bucket } = getClient();
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function getObject(key: string) {
  const { s3, bucket } = getClient();
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error("Empty object");
  return {
    stream: res.Body.transformToWebStream(),
    contentType: res.ContentType ?? "application/octet-stream",
    length: res.ContentLength,
  };
}
