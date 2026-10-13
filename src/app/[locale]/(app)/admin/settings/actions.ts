"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { getActionUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { ALL_SETTINGS, saveSetting } from "@/lib/settings";
import { deleteObject, putObject, storageConfigured } from "@/lib/storage";
import type { FormState } from "@/components/action-form";

export async function saveSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getActionUser(["SYSTEM_ADMIN"]);
  if (!me) return { ok: false, error: "unauthorized" };
  if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) return { ok: false, error: "noAuthSecret" };

  const changed: string[] = [];
  for (const def of ALL_SETTINGS) {
    const raw = formData.get(def.key);
    const text = typeof raw === "string" ? raw.trim().slice(0, 600) : "";
    if (def.type === "url" && text && !/^https?:\/\/\S+$/i.test(text)) return { ok: false, error: "badUrl" };

    if (def.secret) {
      // Blank keeps the saved secret; the "clear" box removes it.
      if (formData.get(`clear:${def.key}`) === "on") {
        await saveSetting(def.key, null, me.id);
        changed.push(def.key);
      } else if (text) {
        await saveSetting(def.key, text, me.id);
        changed.push(def.key);
      }
    } else {
      await saveSetting(def.key, text || null, me.id);
      changed.push(def.key);
    }
  }
  // Never write the values themselves to the audit log.
  await audit(me.id, "settings.update", "AppSetting", null, { keys: changed });
  revalidatePath("/", "layout");
  return { ok: true, error: null, info: "saved" };
}

/** Writes and removes a tiny object to prove the storage settings work. */
export async function testStorageAction(_prev: FormState, _fd: FormData): Promise<FormState> {
  const me = await getActionUser(["SYSTEM_ADMIN"]);
  if (!me) return { ok: false, error: "unauthorized" };
  if (!(await storageConfigured())) return { ok: false, error: "storageMissing" };
  const key = `healthcheck/${Date.now()}-${randomBytes(4).toString("hex")}.txt`;
  try {
    await putObject(key, Buffer.from("ok"), "text/plain");
    await deleteObject(key);
  } catch (err) {
    console.error("storage test failed", err);
    const name = err instanceof Error ? err.name : "Error";
    return { ok: false, error: "storageFailed", value: name };
  }
  return { ok: true, error: null, info: "storageOk" };
}
