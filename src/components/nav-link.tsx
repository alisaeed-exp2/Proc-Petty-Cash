"use client";

import { Link, usePathname } from "@/i18n/navigation";

export function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  const pathname = usePathname();
  // "/expenses" must not stay active on "/expenses/new".
  const active =
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/") && !isMoreSpecificSibling(href, pathname));

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 whitespace-nowrap rounded-control px-3 py-2 text-sm transition ${
        active ? "bg-white/12 font-semibold text-white" : "text-ocean-25 hover:bg-white/8 hover:text-white"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
        <path d={icon} />
      </svg>
      <span>{label}</span>
    </Link>
  );
}

function isMoreSpecificSibling(href: string, pathname: string) {
  return href === "/expenses" && pathname.startsWith("/expenses/new");
}
