import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { putObject } from "@/lib/storage";

export const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES = 5;

const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type UploadError = "noFiles" | "tooManyFiles" | "fileType" | "fileTooLarge" | "storage";

export type StoredFile = { fileName: string; mimeType: string; data: Buffer };

/** Validates the uploaded files. Returns an error key, or the files read into memory. */
export async function readUploads(entries: FormDataEntryValue[], opts: { required: boolean }): Promise<{ error: UploadError } | { files: StoredFile[] }> {
  const files = entries.filter((e): e is File => typeof e !== "string" && e.size > 0);
  if (files.length === 0) return opts.required ? { error: "noFiles" } : { files: [] };
  if (files.length > MAX_FILES) return { error: "tooManyFiles" };
  const out: StoredFile[] = [];
  for (const f of files) {
    if (!(ALLOWED_MIME as readonly string[]).includes(f.type)) return { error: "fileType" };
    if (f.size > MAX_FILE_BYTES) return { error: "fileTooLarge" };
    out.push({ fileName: f.name || "invoice", mimeType: f.type, data: Buffer.from(await f.arrayBuffer()) });
  }
  return { files: out };
}

/** Uploads files to the bucket and records them as the next version of the expense. */
export async function storeExpenseFiles(expenseId: string, files: StoredFile[]): Promise<{ error: UploadError } | { ok: true }> {
  if (files.length === 0) return { ok: true };
  const last = await prisma.expenseFile.aggregate({ where: { expenseId }, _max: { version: true } });
  const version = (last._max.version ?? 0) + 1;
  const rows: { storageKey: string; fileName: string; mimeType: string; sizeBytes: number; sha256: string }[] = [];
  try {
    for (const f of files) {
      const storageKey = `invoices/${expenseId}/v${version}-${randomUUID()}.${EXT[f.mimeType]}`;
      await putObject(storageKey, f.data, f.mimeType);
      rows.push({
        storageKey,
        fileName: f.fileName.slice(0, 200),
        mimeType: f.mimeType,
        sizeBytes: f.data.length,
        sha256: createHash("sha256").update(f.data).digest("hex"),
      });
    }
  } catch (err) {
    console.error("upload failed", err);
    return { error: "storage" };
  }
  await prisma.expenseFile.createMany({ data: rows.map((r) => ({ expenseId, version, ...r })) });
  return { ok: true };
}
