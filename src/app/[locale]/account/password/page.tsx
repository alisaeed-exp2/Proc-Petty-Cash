import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/session";
import { BrandEmblem } from "@/components/brand-logo";
import { Link } from "@/i18n/navigation";
import { PasswordForm } from "./password-form";

export default async function PasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, undefined, { allowForcedChange: true });
  const t = await getTranslations("account");

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-10">
      <div className="w-full max-w-md rounded-card border border-line bg-white p-8 shadow-sm">
        <BrandEmblem size={44} />
        <h1 className="mt-4 font-display text-3xl font-semibold text-ocean">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted">{user.email}</p>
        <PasswordForm forced={user.mustChangePassword} />
        {!user.mustChangePassword && (
          <Link href="/dashboard" className="mt-6 inline-block text-sm text-ocean-75 underline underline-offset-4">
            {t("back")}
          </Link>
        )}
      </div>
    </main>
  );
}
