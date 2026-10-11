import { getTranslations, setRequestLocale } from "next-intl/server";
import { signOut } from "@/auth";
import { requireRole } from "@/lib/roles";

// Placeholder: proves auth and role plumbing. Real dashboards come in a later step.
export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(locale);

  const t = await getTranslations("dashboard");
  const common = await getTranslations("common");

  async function logout() {
    "use server";
    await signOut({ redirectTo: `/${locale}/login` });
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-4xl font-medium text-ocean">{t("title")}</h1>
      <p className="mt-3 text-muted">
        {t("signedInAs", { name: user.name ?? user.email ?? "" })} · {t(`roles.${user.role}`)}
      </p>
      <p className="mt-6">{t("soon")}</p>
      <form action={logout} className="mt-8">
        <button className="rounded-control border border-line bg-white px-4 py-2 text-sm hover:bg-offwhite">
          {common("signOut")}
        </button>
      </form>
    </main>
  );
}
