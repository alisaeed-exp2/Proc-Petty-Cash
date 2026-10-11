import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);
  const t = await getTranslations("dash");

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("welcome", { name: user.name })} />
      <Card>{t("soon")}</Card>
    </>
  );
}
