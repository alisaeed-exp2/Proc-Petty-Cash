import { prisma } from "@/lib/prisma";
import { formatHalalas } from "@/lib/ledger/money";
import { getSetting } from "@/lib/settings";

type Lang = "en" | "ar";

const APP_URL = async () => ((await getSetting("APP_URL")) || "").replace(/\/$/, "");

const TEXT = {
  en: {
    brand: "AKCC Petty Cash Management",
    submittedSubject: (agent: string, total: string) => `New invoice to review: ${agent}, ${total} SAR`,
    submittedBody: (agent: string, vendor: string, total: string, company: string) =>
      `${agent} submitted an invoice from ${vendor} for ${total} SAR (${company}). It is waiting for your review.`,
    overspendSubject: (agent: string, total: string) => `Over-limit invoice: ${agent}, ${total} SAR`,
    overspendBody: (agent: string, vendor: string, total: string) =>
      `${agent} submitted an invoice from ${vendor} for ${total} SAR that is more than their available balance. The controller will decide whether to approve it.`,
    approvedSubject: (total: string) => `Your invoice was approved (${total} SAR)`,
    approvedBody: (vendor: string, total: string) => `Your invoice from ${vendor} for ${total} SAR was approved and recorded in your consumption.`,
    rejectedSubject: (total: string) => `Your invoice was rejected (${total} SAR)`,
    rejectedBody: (vendor: string, total: string, reason: string) =>
      `Your invoice from ${vendor} for ${total} SAR was rejected. Reason: ${reason}. Please correct it and resubmit; the amount stays unresolved with you until then.`,
    awaitingSubject: (agent: string, total: string) => `Waiting for your approval: ${agent}, ${total} SAR`,
    awaitingBody: (agent: string, vendor: string, total: string) =>
      `The expense controller approved an invoice from ${vendor} for ${total} SAR submitted by ${agent}. It now needs your final approval.`,
    open: "Open in the app",
  },
  ar: {
    brand: "إدارة العهدة النقدية - AKCC",
    submittedSubject: (agent: string, total: string) => `فاتورة جديدة للمراجعة: ${agent}، ${total} ريال`,
    submittedBody: (agent: string, vendor: string, total: string, company: string) =>
      `أرسل ${agent} فاتورة من ${vendor} بمبلغ ${total} ريال (${company}). وهي بانتظار مراجعتك.`,
    overspendSubject: (agent: string, total: string) => `فاتورة متجاوزة للحد: ${agent}، ${total} ريال`,
    overspendBody: (agent: string, vendor: string, total: string) =>
      `أرسل ${agent} فاتورة من ${vendor} بمبلغ ${total} ريال تتجاوز رصيده المتاح. سيقرر المراقب اعتمادها من عدمه.`,
    approvedSubject: (total: string) => `تم اعتماد فاتورتك (${total} ريال)`,
    approvedBody: (vendor: string, total: string) => `تم اعتماد فاتورتك من ${vendor} بمبلغ ${total} ريال وتسجيلها في استهلاكك.`,
    rejectedSubject: (total: string) => `تم رفض فاتورتك (${total} ريال)`,
    rejectedBody: (vendor: string, total: string, reason: string) =>
      `تم رفض فاتورتك من ${vendor} بمبلغ ${total} ريال. السبب: ${reason}. يرجى تصحيحها وإعادة إرسالها؛ يبقى المبلغ غير مسوّى عليك حتى ذلك الحين.`,
    awaitingSubject: (agent: string, total: string) => `بانتظار اعتمادك: ${agent}، ${total} ريال`,
    awaitingBody: (agent: string, vendor: string, total: string) =>
      `اعتمد مراقب المصروفات فاتورة من ${vendor} بمبلغ ${total} ريال أرسلها ${agent}. وهي الآن بحاجة إلى اعتمادك النهائي.`,
    open: "فتح في التطبيق",
  },
} as const;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function html(lang: Lang, body: string, link: string | null) {
  const t = TEXT[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";
  return `<!doctype html><html lang="${lang}" dir="${dir}"><body style="margin:0;background:#E9E3DB;font-family:Arial,Tahoma,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:8px;overflow:hidden;">
<tr><td style="background:#043E50;color:#fff;padding:16px 24px;font-size:16px;font-weight:bold;">${esc(t.brand)}</td></tr>
<tr><td style="padding:24px;color:#2F3645;font-size:15px;line-height:1.7;text-align:${lang === "ar" ? "right" : "left"};">
<p style="margin:0 0 20px;">${esc(body)}</p>
${link ? `<a href="${esc(link)}" style="display:inline-block;background:#043E50;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;">${esc(t.open)}</a>` : ""}
</td></tr></table></td></tr></table></body></html>`;
}

async function send(to: string, subject: string, lang: Lang, body: string, path: string) {
  const key = await getSetting("RESEND_API_KEY");
  if (!key) return; // email is optional until a key is configured
  const base = await APP_URL();
  const link = base ? `${base}/${lang}${path}` : null;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: (await getSetting("EMAIL_FROM")) || "AKCC Petty Cash <onboarding@resend.dev>",
      to: [to],
      subject,
      html: html(lang, body, link),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) console.error("email send failed", res.status, (await res.text().catch(() => "")).slice(0, 200));
}

const lang = (l: string): Lang => (l === "ar" ? "ar" : "en");

/** Agent submitted: tell the controllers; if over limit also tell the manager. */
export async function notifySubmitted(expenseId: string): Promise<void> {
  if (!(await getSetting("RESEND_API_KEY"))) return;
  const e = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { agent: { select: { name: true } }, company: true },
  });
  if (!e) return;
  const total = formatHalalas(e.total ?? 0);
  const vendor = e.vendorName ?? "-";

  const controllers = await prisma.user.findMany({ where: { role: "CONTROLLER", active: true, companies: { some: { companyId: e.companyId } } }, select: { email: true, locale: true } });
  await Promise.all(
    controllers.map((u) => {
      const l = lang(u.locale);
      const t = TEXT[l];
      const company = l === "ar" ? e.company.nameAr : e.company.nameEn;
      return send(u.email, t.submittedSubject(e.agent.name, total), l, t.submittedBody(e.agent.name, vendor, total, company), `/review/${e.id}`);
    }),
  );

  if (e.overspendFlag) {
    const managers = await prisma.user.findMany({ where: { role: "MANAGER", active: true, companies: { some: { companyId: e.companyId } } }, select: { email: true, locale: true } });
    await Promise.all(
      managers.map((u) => {
        const l = lang(u.locale);
        const t = TEXT[l];
        return send(u.email, t.overspendSubject(e.agent.name, total), l, t.overspendBody(e.agent.name, vendor, total), "/dashboard");
      }),
    );
  }
}

/**
 * A reviewer decided. Controller approval -> tell the managers it is waiting for them.
 * Manager approval or any rejection -> tell the agent.
 */
export async function notifyReviewed(expenseId: string): Promise<void> {
  if (!(await getSetting("RESEND_API_KEY"))) return;
  const e = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      agent: { select: { name: true, email: true, locale: true } },
      reviews: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const review = e?.reviews[0];
  if (!e || !review) return;
  const total = formatHalalas(e.total ?? 0);
  const vendor = e.vendorName ?? "-";

  if (review.decision === "APPROVED" && review.stage === "CONTROLLER") {
    const managers = await prisma.user.findMany({ where: { role: "MANAGER", active: true, companies: { some: { companyId: e.companyId } } }, select: { email: true, locale: true } });
    await Promise.all(
      managers.map((u) => {
        const l = lang(u.locale);
        const t = TEXT[l];
        return send(u.email, t.awaitingSubject(e.agent.name, total), l, t.awaitingBody(e.agent.name, vendor, total), `/review/${e.id}`);
      }),
    );
    return;
  }

  const l = lang(e.agent.locale);
  const t = TEXT[l];
  if (review.decision === "APPROVED") {
    await send(e.agent.email, t.approvedSubject(total), l, t.approvedBody(vendor, total), `/expenses/${e.id}`);
  } else {
    await send(e.agent.email, t.rejectedSubject(total), l, t.rejectedBody(vendor, total, review.reason ?? "-"), `/expenses/${e.id}`);
  }
}
