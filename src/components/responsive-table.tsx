"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Scrolls sideways on tablets and desktops. On phones the CSS in globals.css (.rtable) turns every row
 * into a small card, using each cell's data-label. The labels are copied from the header cells here,
 * so no page has to repeat them.
 */
export function ResponsiveTable({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLTableElement>(null);

  useEffect(() => {
    const table = ref.current;
    if (!table) return;
    const heads = Array.from(table.querySelectorAll("thead th")).map((th) => (th.textContent ?? "").trim());
    table.querySelectorAll("tbody tr").forEach((tr) => {
      Array.from(tr.children).forEach((cell, i) => cell.setAttribute("data-label", heads[i] ?? ""));
    });
  });

  return (
    <div className="overflow-x-auto">
      <table ref={ref} className="rtable w-full min-w-[32rem] border-collapse text-sm">
        {children}
      </table>
    </div>
  );
}
