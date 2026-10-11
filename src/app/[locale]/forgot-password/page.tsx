import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("forgot");

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-md">
        <h1 className="font-display text-4xl font-medium text-ocean">{t("title")}</h1>
        <p className="mt-3 text-muted">{t("body")}</p>
        <Link href="/login" className="mt-8 inline-block text-sm text-ocean-75 underline underline-offset-4">
          {t("back")}
        </Link>
      </div>
    </main>
  );
}
