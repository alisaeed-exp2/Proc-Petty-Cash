import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getObject, storageConfigured } from "@/lib/storage";
import { getAllowedCompanies } from "@/lib/company";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const allowed = await getAllowedCompanies(user.id, user.role);
  const isAdmin = user.role === "MANAGER" || user.role === "SYSTEM_ADMIN";
  if (!isAdmin && !allowed.some((c) => c.id === id)) return new Response("Forbidden", { status: 403 });
  const company = await prisma.company.findUnique({ where: { id }, select: { logoKey: true, logoMime: true } });
  if (!company?.logoKey || !(await storageConfigured())) return new Response("Not found", { status: 404 });
  try {
    const obj = await getObject(company.logoKey);
    return new Response(obj.stream, {
      headers: {
        "Content-Type": company.logoMime ?? obj.contentType,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Logo unavailable", { status: 502 });
  }
}
