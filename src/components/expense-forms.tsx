"use client";

import { useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { btnPrimary, btnSecondary, inputCls, labelCls, hintCls, Notice } from "@/components/ui";
import { emptyState, type FormState } from "@/components/action-form";

export type CompanyOption = { id: string; name: string; projects: { id: string; name: string }[] };

function CompanyProject({ companies, companyId, projectId }: { companies: CompanyOption[]; companyId?: string; projectId?: string | null }) {
  const t = useTranslations("expenses");
  const c = useTranslations("common");
  const [company, setCompany] = useState(companyId ?? "");
  const projects = companies.find((x) => x.id === company)?.projects ?? [];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className={labelCls} htmlFor="companyId">{c("company")} *</label>
        <select id="companyId" name="companyId" required value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls}>
          <option value="" disabled>{t("chooseCompany")}</option>
          {companies.map((x) => (
            <option key={x.id} value={x.id}>{x.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls} htmlFor="projectId">{c("project")} ({c("optional")})</label>
        <select id="projectId" name="projectId" defaultValue={projectId ?? ""} key={company} className={inputCls}>
          <option value="">{t("noProject")}</option>
          {projects.map((x) => (
            <option key={x.id} value={x.id}>{x.name}</option>
          ))}
        </select>
      </div>
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
  companies,
  locale,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  companies: CompanyOption[];
  locale: string;
}) {
  const t = useTranslations("expenses");
  const c = useTranslations("common");
  const [state, formAction, pending] = useActionState(action, emptyState);
  const qrRef = useRef<HTMLInputElement>(null);

  // Saudi e-invoices carry a ZATCA QR code. When a photo has one, decode it in the browser
  // so the server can use the signed data instead of guessing from the picture.
  async function scanQr(files: FileList | null) {
    if (qrRef.current) qrRef.current.value = "";
    if (!files) return;
    try {
      const { default: jsQR } = await import("jsqr");
      for (const file of Array.from(files)) {
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
        if (code?.data && qrRef.current) {
          qrRef.current.value = code.data;
          return;
        }
      }
    } catch {
      // Scanning is a bonus; the server still reads the invoice.
    }
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="qr" ref={qrRef} />
      <CompanyProject companies={companies} />
      <div>
        <label className={labelCls} htmlFor="files">{t("files")} *</label>
        <input
          id="files"
          name="files"
          type="file"
          multiple
          required
          onChange={(e) => void scanQr(e.target.files)}
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className={`${inputCls} file:me-3 file:rounded file:border-0 file:bg-ocean-10 file:px-3 file:py-1.5 file:text-sm file:text-ocean`}
        />
        <p className={hintCls}>{t("filesHint")}</p>
      </div>
      <div>
        <label className={labelCls} htmlFor="notes">{c("notes")} ({c("optional")})</label>
        <textarea id="notes" name="notes" rows={2} maxLength={500} className={inputCls} />
      </div>
      <Messages state={state} />
      {pending && <Notice tone="info">{t("reading")}</Notice>}
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? t("reading") : t("upload")}
      </button>
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
  companies,
  values,
  locale,
  rejected,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  companies: CompanyOption[];
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
      <CompanyProject companies={companies} companyId={values.companyId} projectId={values.projectId} />
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
