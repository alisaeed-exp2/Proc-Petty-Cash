import type { Role } from "@prisma/client";
import { roleAllowed } from "@/lib/access";

export type NavItem = {
  href: string;
  key: string; // nav.<key>
  roles: Role[];
  icon: string; // SVG path data, 24x24 outline
};

const ALL: Role[] = ["MANAGER", "CONTROLLER", "AGENT"];
const WITH_VP: Role[] = ["MANAGER", "CONTROLLER", "AGENT", "GROUP_VP"];

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", key: "dashboard", roles: WITH_VP, icon: "M3 13h8V3H3v10Zm10 8h8V11h-8v10ZM3 21h8v-6H3v6Zm10-12h8V3h-8v6Z" },
  { href: "/expenses/new", key: "newExpense", roles: ["AGENT"], icon: "M12 5v14M5 12h14" },
  { href: "/expenses", key: "myExpenses", roles: ["AGENT"], icon: "M7 3h7l5 5v13H7V3Zm7 0v5h5M10 13h6M10 17h6" },
  { href: "/review", key: "review", roles: ["CONTROLLER", "MANAGER"], icon: "M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3Zm-3 9 2.2 2.2L15.5 10" },
  { href: "/funding", key: "funding", roles: ["MANAGER"], icon: "M3 7h18v12H3V7Zm0 4h18M16 15h2M7 7V5h10v2" },
  { href: "/allocations", key: "allocations", roles: ["MANAGER"], icon: "M4 7h12M4 12h16M4 17h8M18 5l3 2-3 2" },
  { href: "/consumption", key: "consumption", roles: ["MANAGER", "CONTROLLER"], icon: "M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6" },
  { href: "/reports", key: "reports", roles: ALL, icon: "M12 3v12m0 0-4-4m4 4 4-4M4 19h16" },
  { href: "/admin/users", key: "users", roles: ["MANAGER"], icon: "M16 11a3 3 0 1 0-6 0 3 3 0 0 0 6 0ZM6 19c0-3 3-5 7-5s7 2 7 5M5 9a2 2 0 1 0 0-4" },
  { href: "/admin/companies", key: "companies", roles: ["MANAGER"], icon: "M4 21V8l8-4 8 4v13M9 21v-6h6v6M8 11h.01M12 11h.01M16 11h.01" },
  { href: "/admin/invoice-types", key: "invoiceTypes", roles: ["MANAGER"], icon: "M4 6h16M4 12h10M4 18h7M17 15l2 2 3-4" },
  { href: "/admin/settings", key: "settings", roles: ["SYSTEM_ADMIN"], icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7.600 7.600 0 0 0-2-1.2L14.600 3h-4l-.4 2.600a7.600 7.600 0 0 0-2 1.200l-2.300-.9-2 3.400 2 1.500a7.400 7.400 0 0 0 0 2.400l-2 1.500 2 3.400 2.300-.9c.6.500 1.300.9 2 1.200l.4 2.600h4l.4-2.600c.7-.3 1.400-.7 2-1.200l2.300.9 2-3.400-2-1.500c.1-.4.1-.8.1-1.200Z" },
];

export function navFor(role: Role): NavItem[] {
  return NAV_ITEMS.filter((n) => n.roles.some((r) => (role === "SYSTEM_ADMIN" ? roleAllowed(role, [r]) : r === role)));
}
