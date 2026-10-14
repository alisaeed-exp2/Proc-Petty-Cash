"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { btnPrimary, btnSecondary, inputCls, labelCls, hintCls, Notice } from "@/components/ui";
import { emptyState, type FormState } from "@/components/action-form";
import type { ReadInvoiceResult } from "@/app/[locale]/(app)/expenses/actions";

export type ProjectOption = { id: string; name: string };

function ProjectSelect({ projects, projectId }: { projects: ProjectOption[]; projectId?: string | null }) {
  const t = useTranslations("expenses");
  const c = useTranslations("common");
  return (
    <div>
      <label className={labelCls} htmlFor="projectId">{c("project")} ({c("optional")})</label>
      <select id="projectId" name="projectId" defaultValue={projectId ?? ""} className={inputCls}>
        <option value="">{t("noProject")}</option>
        {projects.map((x) => (
          <option key={x.id} value={x.id}>{x.name}</option>
        ))}
      </select>
    </div>
  );
}

function CompanyBadge({ name }: { name: string }) {
  const c = useTranslations("common");
  return (
    <div>
      <span className={labelCls}>{c("company")}</span>
      <div className="mt-1 rounded-control border border-line bg-gray px-3.5 py-2.5 text-sm font-semibold text-ocean">{name}</div>
    </div>
  );
}

function Messages({ state }: { state: FormState }) {
  const t = useTranslations("expenses");
  return (
    <>
      {state.error && <Notice tone="bad">{t(`errors.${state.error}`)}</Notice>}
      {state.ok && state.info && <Notice tone="good">{t(`info.${state.info}`)}</Notice>}
    </>
  );
}

export function NewExpenseForm({
  action,
  readAction,
  companyName,
  projects,
  locale,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  readAction: (fd: FormData) => Promise<ReadInvoiceResult>;
  companyName: string;
  projects: ProjectOption[];
  locale: string;
}) {
  const t = useTranslations("expenses");
  const c = useTranslations("common");
  const [state, setState] = useState<FormState>(emptyState);
  const [pending, startTransition] = useTransition();
  const [reading, startReading] = useTransition();
  const [files, setFiles] = useState<File[]>([]);
  const [qr, setQr] = useState("");
  const [note, setNote] = useState<{ tone: "info" | "warn"; text: string } | null>(null);
  const [projectId, setProjectId] = useState("");
  const [notes, setNotes] = useState("");
  const [f, setF] = useState({ vendorName: "", vendorVatNo: "", invoiceNumber: "", invoiceDate: "", subtotal: "", vatAmount: "", total: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));
  const num = `${inputCls} text-start`;

  // Saudi e-invoices carry a ZATCA QR code. When a photo has one, decode it in the browser
  // so the server can use the signed data instead of guessing from the picture.
  async function scanQr(list: File[]) {
    setQr("");
    try {
      const { default: jsQR } = await import("jsqr");
      for (const file of list) {
        if (!file.type.startsWith("image/")) continue;
        const bmp = await createImageBitmap(file);
        const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bmp.width * scale);
        canvas.height = Math.round(bmp.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height);
        if (code?.data) {
          setQr(code.data);
          return;
        }
      }
    } catch {
      // Scanning is a bonus; the server still reads the invoice.
    }
  }

  function onFiles(list: FileList | null) {
    const arr = list ? Array.from(list) : [];
    setFiles(arr);
    setNote(null);
    void scanQr(arr);
  }

  function readAuto() {
    if (files.length === 0) return;
    setNote(null);
    setState(emptyState);
    const fd = new FormData();
    fd.append("file", files[0]);
    fd.append("qr", qr);
    startReading(async () => {
      const r = await readAction(fd);
      if (r.ok) {
        // Only overwrite with what was actually read; keep anything the agent already typed.
        setF((p) => ({
          vendorName: r.fields.vendorName || p.vendorName,
          vendorVatNo: r.fields.vendorVatNo || p.vendorVatNo,
          invoiceNumber: r.fields.invoiceNumber || p.invoiceNumber,
          invoiceDate: r.fields.invoiceDate || p.invoiceDate,
          subtotal: r.fields.subtotal || p.subtotal,
          vatAmount: r.fields.vatAmount || p.vatAmount,
          total: r.fields.total || p.total,
        }));
        setNote({ tone: "info", text: t("ocrDone") });
      } else if (r.error === "ocrOff") {
        setNote({ tone: "warn", text: t("ocrSkipped") });
      } else if (r.error === "ocrFailed" || r.error === "nothing") {
        setNote({ tone: "warn", text: t("ocrFailed") });
      } else {
        setState({ ok: false, error: r.error });
      }
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const fd = new FormData();
    fd.append("locale", locale);
    fd.append("intent", submitter?.value === "submit" ? "submit" : "save");
    fd.append("qr", qr);
    fd.append("projectId", projectId);
    fd.append("notes", notes);
    for (const [k, v] of Object.entries(f)) fd.append(k, v);
    for (const file of files) fd.append("files", file);
    startTransition(async () => {
      setState(await action(emptyState, fd));
    });
  }

  const busy = pending || reading;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <CompanyBadge name={companyName} />
        <div>
          <label className={labelCls} htmlFor="projectId">{c("project")} ({c("optional")})</label>
          <select id="projectId" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls}>
            <option value="">{t("noProject")}</option>
            {projects.map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls} htmlFor="files">{t("files")} *</label>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-start">
          <input
            id="files"
            type="file"
            multiple
            onChange={(e) => onFiles(e.target.files)}
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className={`${inputCls} !mt-0 min-w-0 flex-1 file:me-3 file:rounded file:border-0 file:bg-ocean-10 file:px-3 file:py-1.5 file:text-sm file:text-ocean`}
          />
          <button type="button" onClick={readAuto} disabled={busy || files.length === 0} className={`${btnSecondary} shrink-0 whitespace-nowrap`}>
            {reading ? t("readingShort") : t("readAuto")}
          </button>
        </div>
        <p className={hintCls}>{t("filesHint")}</p>
      </div>

      {note && <Notice tone={note.tone}>{note.text}</Notice>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="vendorName">{t("vendor")} *</label>
          <input id="vendorName" value={f.vendorName} onChange={set("vendorName")} maxLength={200} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="vendorVatNo">{t("vatNo")}</label>
          <input id="vendorVatNo" value={f.vendorVatNo} onChange={set("vendorVatNo")} inputMode="numeric" dir="ltr" maxLength={15} className={num} />
        </div>
        <div>
          <label className={labelCls} htmlFor="invoiceNumber">{t("invoiceNo")}</label>
          <input id="invoiceNumber" value={f.invoiceNumber} onChange={set("invoiceNumber")} dir="ltr" maxLength={80} className={num} />
        </div>
        <div>
          <label className={labelCls} htmlFor="invoiceDate">{t("invoiceDate")} *</label>
          <input id="invoiceDate" type="date" value={f.invoiceDate} onChange={set("invoiceDate")} className={inputCls} />
        </div>
        <div />
        <div>
          <label className={labelCls} htmlFor="subtotal">{t("subtotal")} ({c("currency")})</label>
          <input id="subtotal" value={f.subtotal} onChange={set("subtotal")} inputMode="decimal" dir="ltr" className={num} />
        </div>
        <div>
          <label className={labelCls} htmlFor="vatAmount">{t("vat")} ({c("currency")})</label>
          <input id="vatAmount" value={f.vatAmount} onChange={set("vatAmount")} inputMode="decimal" dir="ltr" className={num} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="total">{t("total")} ({c("currency")}) *</label>
          <input id="total" value={f.total} onChange={set("total")} inputMode="decimal" dir="ltr" className={`${num} font-semibold`} />
        </div>
      </div>

      <div>
        <label className={labelCls} htmlFor="notes">{c("notes")} ({c("optional")})</label>
        <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} className={inputCls} />
      </div>

      <Messages state={state} />
      {pending && <Notice tone="info">{t("saving")}</Notice>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" value="submit" disabled={busy} className={btnPrimary}>
          {pending ? c("saving") : t("submit")}
        </button>
        <button type="submit" value="save" disabled={busy} className={btnSecondary}>
          {t("saveDraft")}
        </button>
      </div>
    </form>
  );
}

export type ExpenseValues = {
  companyId: string;
  projectId: string | null;
  vendorName: string;
  vendorVatNo: string;
  invoiceNumber: string;
  invoiceDate: string;
  subtotal: string;
  vatAmount: string;
  total: string;
  notes: string;
};

export function ExpenseEditForm({
  action,
  companyName,
  projects,
  values,
  locale,
  rejected,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  companyName: string;
  projects: ProjectOption[];
  values: ExpenseValues;
  locale: string;
  rejected: boolean;
}) {
  const t = useTranslations("expenses");
  const c = useTranslations("common");
  const [state, formAction, pending] = useActionState(action, emptyState);
  const num = `${inputCls} text-start`;
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-4 sm:grid-cols-2">
        <CompanyBadge name={companyName} />
        <ProjectSelect projects={projects} projectId={values.projectId} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="vendorName">{t("vendor")} *</label>
          <input id="vendorName" name="vendorName" defaultValue={values.vendorName} maxLength={200} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="vendorVatNo">{t("vatNo")}</label>
          <input id="vendorVatNo" name="vendorVatNo" defaultValue={values.vendorVatNo} inputMode="numeric" dir="ltr" maxLength={15} className={num} />
        </div>
        <div>
          <label className={labelCls} htmlFor="invoiceNumber">{t("invoiceNo")}</label>
          <input id="invoiceNumber" name="invoiceNumber" defaultValue={values.invoiceNumber} dir="ltr" maxLength={80} className={num} />
        </div>
        <div>
          <label className={labelCls} htmlFor="invoiceDate">{t("invoiceDate")} *</label>
          <input id="invoiceDate" name="invoiceDate" type="date" defaultValue={values.invoiceDate} className={inputCls} />
        </div>
        <div />
        <div>
          <label className={labelCls} htmlFor="subtotal">{t("subtotal")} ({c("currency")})</label>
          <input id="subtotal" name="subtotal" defaultValue={values.subtotal} inputMode="decimal" dir="ltr" className={num} />
        </div>
        <div>
          <label className={labelCls} htmlFor="vatAmount">{t("vat")} ({c("currency")})</label>
          <input id="vatAmount" name="vatAmount" defaultValue={values.vatAmount} inputMode="decimal" dir="ltr" className={num} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="total">{t("total")} ({c("currency")}) *</label>
          <input id="total" name="total" defaultValue={values.total} inputMode="decimal" dir="ltr" className={`${num} font-semibold`} />
        </div>
      </div>
      <div>
        <label className={labelCls} htmlFor="notes">{c("notes")} ({c("optional")})</label>
        <textarea id="notes" name="notes" rows={2} maxLength={500} defaultValue={values.notes} className={inputCls} />
      </div>
      {rejected && (
        <div>
          <label className={labelCls} htmlFor="files">{t("replaceFile")}</label>
          <input
            id="files"
            name="files"
            type="file"
            multiple
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className={`${inputCls} file:me-3 file:rounded file:border-0 file:bg-ocean-10 file:px-3 file:py-1.5 file:text-sm file:text-ocean`}
          />
          <p className={hintCls}>{t("replaceHint")}</p>
        </div>
      )}
      <Messages state={state} />
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="intent" value="submit" disabled={pending} className={btnPrimary}>
          {pending ? c("saving") : rejected ? t("resubmit") : t("submit")}
        </button>
        <button type="submit" name="intent" value="save" disabled={pending} className={btnSecondary}>
          {t("saveDraft")}
        </button>
      </div>
    </form>
  );
}
