import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getObject, storageConfigured } from "@/lib/storage";
import { canSeeRecords } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Unauthorized", { status: 401 });

  if (!canSeeRecords(user.role)) return new Response("Forbidden", { status: 403 });

  const { id } = await params;
  const file = await prisma.expenseFile.findUnique({
    where: { id },
    include: { expense: { select: { agentId: true } } },
  });
  if (!file) return new Response("Not found", { status: 404 });
  if (user.role === "AGENT" && file.expense.agentId !== user.id) return new Response("Forbidden", { status: 403 });
  if (!storageConfigured()) return new Response("Storage not configured", { status: 503 });

  try {
    const obj = await getObject(file.storageKey);
    return new Response(obj.stream, {
      headers: {
        "Content-Type": file.mimeType,
        ...(obj.length ? { "Content-Length": String(obj.length) } : {}),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("file fetch failed", err);
    return new Response("File unavailable", { status: 502 });
  }
}
