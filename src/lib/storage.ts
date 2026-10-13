import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSetting } from "@/lib/settings";

type Cfg = {
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  pathStyle: boolean;
};

let cached: { sig: string; s3: S3Client } | null = null;

async function config(): Promise<Cfg | null> {
  const [bucket, endpoint, accessKeyId, secretAccessKey, region, pathStyle] = await Promise.all([
    getSetting("S3_BUCKET"),
    getSetting("S3_ENDPOINT"),
    getSetting("S3_ACCESS_KEY_ID"),
    getSetting("S3_SECRET_ACCESS_KEY"),
    getSetting("S3_REGION"),
    getSetting("S3_FORCE_PATH_STYLE"),
  ]);
  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) return null;
  return { bucket, endpoint, region: region || "auto", accessKeyId, secretAccessKey, pathStyle: pathStyle === "true" };
}

export async function storageConfigured(): Promise<boolean> {
  return (await config()) !== null;
}

async function getClient() {
  const c = await config();
  if (!c) throw new Error("Storage is not configured");
  const sig = JSON.stringify(c);
  if (!cached || cached.sig !== sig) {
    cached = {
      sig,
      s3: new S3Client({
        region: c.region,
        endpoint: c.endpoint,
        forcePathStyle: c.pathStyle,
        credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
      }),
    };
  }
  return { s3: cached.s3, bucket: c.bucket };
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  const { s3, bucket } = await getClient();
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function getObject(key: string) {
  const { s3, bucket } = await getClient();
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error("Empty object");
  return {
    stream: res.Body.transformToWebStream(),
    contentType: res.ContentType ?? "application/octet-stream",
    length: res.ContentLength,
  };
}

export async function deleteObject(key: string): Promise<void> {
  const { s3, bucket } = await getClient();
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
