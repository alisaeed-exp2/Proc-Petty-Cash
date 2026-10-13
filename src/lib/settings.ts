import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type SettingDef = {
  key: string;
  secret?: boolean;
  /** Also read this environment variable if the key itself is not set. */
  envAlias?: string;
  type?: "text" | "url" | "bool" | "password";
};

export type SettingGroup = { id: "storage" | "ocr" | "email" | "general"; items: SettingDef[] };

/** Everything the admin can set from the UI. A value saved here wins over the environment variable. */
export const SETTING_GROUPS: SettingGroup[] = [
  {
    id: "storage",
    items: [
      { key: "S3_ENDPOINT", type: "url" },
      { key: "S3_BUCKET" },
      { key: "S3_REGION" },
      { key: "S3_ACCESS_KEY_ID", secret: true },
      { key: "S3_SECRET_ACCESS_KEY", secret: true },
      { key: "S3_FORCE_PATH_STYLE", type: "bool" },
    ],
  },
  {
    id: "ocr",
    items: [{ key: "ANTHROPIC_API_KEY", secret: true }, { key: "ANTHROPIC_MODEL" }],
  },
  {
    id: "email",
    items: [{ key: "RESEND_API_KEY", secret: true }, { key: "EMAIL_FROM" }],
  },
  {
    id: "general",
    items: [{ key: "APP_URL", type: "url", envAlias: "NEXT_PUBLIC_APP_URL" }],
  },
];

export const ALL_SETTINGS: SettingDef[] = SETTING_GROUPS.flatMap((g) => g.items);
const BY_KEY = new Map(ALL_SETTINGS.map((d) => [d.key, d]));

// ---- encryption (key derived from AUTH_SECRET) ----
function cipherKey(): Buffer {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required to store secrets");
  return createHash("sha256").update("akcc-settings:" + secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cipherKey(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string | null {
  try {
    const [v, iv, tag, data] = stored.split(":");
    if (v !== "v1") return null;
    const d = createDecipheriv("aes-256-gcm", cipherKey(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
  } catch {
    return null; // wrong AUTH_SECRET or corrupted: behave as "not set"
  }
}

// ---- cached reads ----
type Row = { value: string; secret: boolean };
let cache: { at: number; rows: Map<string, Row> } | null = null;
const TTL_MS = 15_000;

async function rows(): Promise<Map<string, Row>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  const map = new Map<string, Row>();
  try {
    const all = await prisma.appSetting.findMany();
    for (const r of all) map.set(r.key, { value: r.value, secret: r.secret });
  } catch (err) {
    console.error("settings read failed, using environment only", err);
  }
  cache = { at: Date.now(), rows: map };
  return map;
}

export function invalidateSettings() {
  cache = null;
}

function fromEnv(def: SettingDef): string | undefined {
  const v = process.env[def.key] || (def.envAlias ? process.env[def.envAlias] : undefined);
  return v && v.trim() ? v.trim() : undefined;
}

/** Value saved in the UI if any, otherwise the environment variable, otherwise undefined. */
export async function getSetting(key: string): Promise<string | undefined> {
  const def = BY_KEY.get(key);
  if (!def) return process.env[key] || undefined;
  const row = (await rows()).get(key);
  if (row) {
    const v = row.secret ? decryptSecret(row.value) : row.value;
    if (v) return v;
  }
  return fromEnv(def);
}

export type SettingView = { key: string; secret: boolean; type: string; source: "db" | "env" | "none"; value: string };

/** For the admin page. Secret values are never returned. */
export async function settingsForUi(): Promise<SettingView[]> {
  const r = await rows();
  return ALL_SETTINGS.map((d) => {
    const row = r.get(d.key);
    const secret = !!d.secret;
    const dbValue = row ? (row.secret ? decryptSecret(row.value) : row.value) : null;
    const env = fromEnv(d);
    const source: SettingView["source"] = dbValue ? "db" : env ? "env" : "none";
    return {
      key: d.key,
      secret,
      type: d.type ?? (secret ? "password" : "text"),
      source,
      value: secret ? "" : (dbValue ?? env ?? ""),
    };
  });
}

export async function saveSetting(key: string, value: string | null, actorId: string | null) {
  const def = BY_KEY.get(key);
  if (!def) throw new Error("Unknown setting");
  if (value === null || value === "") {
    await prisma.appSetting.deleteMany({ where: { key } });
  } else {
    const stored = def.secret ? encryptSecret(value) : value;
    await prisma.appSetting.upsert({
      where: { key },
      create: { key, value: stored, secret: !!def.secret, updatedById: actorId },
      update: { value: stored, secret: !!def.secret, updatedById: actorId },
    });
  }
  invalidateSettings();
}
