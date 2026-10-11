import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/** Records who did what. Failures never block the main action. */
export async function audit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  details?: Prisma.InputJsonValue,
  db: Db = prisma,
) {
  try {
    await db.auditLog.create({
      data: { actorId, action, entity, entityId: entityId ?? null, details: details ?? undefined },
    });
  } catch (err) {
    console.error("audit log failed", err);
  }
}
