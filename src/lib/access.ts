import type { Role } from "@prisma/client";

/**
 * Does a user with this role pass a guard that lists the allowed roles?
 * A system administrator has every right except acting as a purchase agent
 * (agents spend their own allocation, so admins never submit expenses).
 */
export function roleAllowed(userRole: Role, allowed: Role[] | undefined): boolean {
  if (!allowed) return true;
  if (allowed.includes(userRole)) return true;
  return userRole === "SYSTEM_ADMIN" && allowed.some((r) => r !== "AGENT");
}

/** Roles that may open invoice files and reports. */
export function canSeeRecords(role: Role): boolean {
  return role !== "GROUP_VP";
}
