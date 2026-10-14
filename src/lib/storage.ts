import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
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

/** "s3" (default) keeps files in a bucket; "local" keeps them in a folder on the server's disk. */
async function mode(): Promise<"s3" | "local"> {
  return (await getSetting("STORAGE_MODE")) === "local" ? "local" : "s3";
}

async function localRoot(): Promise<string> {
  const configured = await getSetting("STORAGE_LOCAL_PATH");
  return path.resolve(configured || path.join(process.cwd(), "storage"));
}

/** Resolves a storage key inside the local folder and refuses anything that escapes it. */
async function localPath(key: string): Promise<string> {
  const root = await localRoot();
  const full = path.resolve(root, key);
  if (full !== root && !full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export async function storageConfigured(): Promise<boolean> {
  if ((await mode()) === "local") return true;
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
        // Newer SDK versions add CRC32 checksums by default, which Alibaba OSS and other
        // S3-compatible services can reject. Only send them when the operation requires it.
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
        credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
      }),
    };
  }
  return { s3: cached.s3, bucket: c.bucket };
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  if ((await mode()) === "local") {
    const file = await localPath(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return;
  }
  const { s3, bucket } = await getClient();
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function getObject(key: string) {
  if ((await mode()) === "local") {
    const file = await localPath(key);
    const info = await stat(file);
    return {
      stream: Readable.toWeb(createReadStream(file)) as unknown as ReadableStream,
      contentType: "application/octet-stream",
      length: info.size as number | undefined,
    };
  }
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
  if ((await mode()) === "local") {
    await rm(await localPath(key), { force: true });
    return;
  }
  const { s3, bucket } = await getClient();
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
