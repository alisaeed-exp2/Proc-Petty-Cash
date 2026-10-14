// Small, dependency-free UI building blocks (server-safe: no hooks).
import type { ReactNode } from "react";
import { ResponsiveTable } from "@/components/responsive-table";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-control bg-ocean px-4 py-2.5 min-h-11 text-sm sm:min-h-0 font-semibold text-white transition hover:bg-slate disabled:cursor-not-allowed disabled:opacity-60";
export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-control border border-line bg-white px-4 py-2.5 min-h-11 text-sm font-semibold text-ocean sm:min-h-0 transition hover:bg-offwhite disabled:cursor-not-allowed disabled:opacity-60";
export const btnDanger =
  "inline-flex items-center justify-center gap-2 rounded-control bg-status-rejected px-4 py-2.5 min-h-11 text-sm sm:min-h-0 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";
export const inputCls =
  "mt-1.5 block w-full rounded-control border border-line bg-white px-3.5 py-2.5 text-base text-ink shadow-sm sm:text-sm outline-none transition focus:border-ocean focus:ring-2 focus:ring-ocean/20 disabled:bg-gray";
export const labelCls = "block text-sm font-medium text-ink";
export const hintCls = "mt-1 text-xs text-muted";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold text-ocean sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  children,
  className = "",
  actions,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={`rounded-card border border-line bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="font-display text-lg font-semibold text-ocean">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

type Tone = "default" | "good" | "warn" | "bad" | "gold";

const toneText: Record<Tone, string> = {
  default: "text-ocean",
  good: "text-status-approved",
  warn: "text-status-pending",
  bad: "text-status-rejected",
  gold: "text-copper",
};

export function Stat({
  label,
  value,
  unit,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-card border border-line bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-2 flex items-baseline gap-1.5 ${toneText[tone]}`}>
        <span className="num font-display text-xl font-semibold sm:text-2xl">{value}</span>
        {unit && <span className="text-xs font-medium text-muted">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function ProgressBar({ percent, tone }: { percent: number; tone?: "auto" | "default" }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const color =
    tone === "default" ? "bg-ocean" : percent > 100 ? "bg-status-rejected" : percent >= 80 ? "bg-status-pending" : "bg-ocean";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ocean-10" role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

const badgeTone: Record<string, string> = {
  APPROVED: "bg-status-approved/10 text-status-approved",
  SUBMITTED: "bg-status-pending/10 text-status-pending",
  CONTROLLER_APPROVED: "bg-gold-25 text-copper",
  REJECTED: "bg-status-rejected/10 text-status-rejected",
  DRAFT: "bg-gray text-muted",
  FLAG: "bg-status-flag/10 text-status-flag",
  INFO: "bg-ocean-10 text-ocean",
};

export function Badge({ tone, children }: { tone: keyof typeof badgeTone | string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeTone[tone] ?? badgeTone.INFO}`}>
      {children}
    </span>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return <ResponsiveTable>{children}</ResponsiveTable>;
}

export const th = "border-b border-line px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-muted";
export const td = "border-b border-line/70 px-3 py-2.5 align-middle";
export const tdNum = "border-b border-line/70 px-3 py-2.5 align-middle text-end num";
export const thNum = "border-b border-line px-3 py-2 text-end text-xs font-semibold uppercase tracking-wide text-muted";

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-control border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{children}</p>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "good" | "bad" | "warn"; children: ReactNode }) {
  const cls = {
    info: "border-ocean/20 bg-ocean-10 text-ocean",
    good: "border-status-approved/30 bg-status-approved/5 text-status-approved",
    bad: "border-status-rejected/30 bg-status-rejected/5 text-status-rejected",
    warn: "border-status-pending/30 bg-status-pending/5 text-status-pending",
  }[tone];
  return (
    <p role={tone === "bad" ? "alert" : "status"} className={`rounded-control border px-3.5 py-2.5 text-sm ${cls}`}>
      {children}
    </p>
  );
}
