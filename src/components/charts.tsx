import { formatHalalas } from "@/lib/ledger/money";

/** Horizontal bars for a short ranked list. Values are halalas. */
export function BarList({ items, unit }: { items: { label: string; value: number; sub?: string }[]; unit: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium">{i.label}</span>
            <span className="num shrink-0 text-xs text-muted">
              {formatHalalas(i.value)} {unit}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-ocean-10">
            <div className="h-full rounded-full bg-ocean" style={{ width: `${Math.max(2, (i.value / max) * 100)}%` }} />
          </div>
          {i.sub && <div className="mt-0.5 text-xs text-muted">{i.sub}</div>}
        </li>
      ))}
    </ul>
  );
}

/** Vertical bars over time. Values are halalas. */
export function MonthBars({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="flex h-48 items-end gap-3" dir="ltr">
      {items.map((i) => (
        <div key={i.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          <span className="num text-[11px] text-muted">{i.value > 0 ? formatHalalas(i.value) : ""}</span>
          <div className="w-full rounded-t bg-gold" style={{ height: `${Math.max(i.value > 0 ? 3 : 0, (i.value / max) * 75)}%` }} />
          <span className="num text-xs text-ink">{i.label}</span>
        </div>
      ))}
    </div>
  );
}
