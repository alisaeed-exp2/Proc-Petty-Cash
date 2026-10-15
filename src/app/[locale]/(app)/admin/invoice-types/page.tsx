import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Empty, PageHeader, btnSecondary, inputCls, labelCls } from "@/components/ui";
import { createInvoiceTypeAction, toggleInvoiceTypeAction, updateInvoiceTypeAction } from "./actions";

export default async function InvoiceTypesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale, ["MANAGER"]);
  const t = await getTranslations("admin");
  const c = await getTranslations("common");

  const types = await prisma.invoiceType.findMany({
    orderBy: [{ active: "desc" }, { code: "asc" }],
    include: { _count: { select: { expenses: true } } },
  });
  const small = `${btnSecondary} !px-3 !py-1.5 !text-xs`;

  return (
    <>
      <PageHeader title={t("invoiceTypes.title")} subtitle={t("invoiceTypes.subtitle")} />

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card>
          {types.length === 0 ? (
            <Empty>{t("invoiceTypes.empty")}</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {types.map((it) => (
                <li key={it.id} className="flex flex-col gap-3 py-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-center gap-3 lg:w-40">
                    <Badge tone={it.active ? "APPROVED" : "DRAFT"}>{it.active ? c("active") : c("inactive")}</Badge>
                    <span className="num text-xs text-muted">{it._count.expenses}</span>
                  </div>
                  <ActionForm
                    action={updateInvoiceTypeAction.bind(null, it.id)}
                    namespace="admin.invoiceTypes"
                    submit={c("save")}
                    className="grid flex-1 gap-3 sm:grid-cols-[8rem_1fr_1fr_auto] sm:items-end"
                    buttonClassName={small}
                  >
                    <div>
                      <label className="text-xs text-muted" htmlFor={`ic-${it.id}`}>{t("invoiceTypes.code")}</label>
                      <input id={`ic-${it.id}`} name="code" required maxLength={20} defaultValue={it.code} dir="ltr" className={`${inputCls} text-start`} />
                    </div>
                    <div>
                      <label className="text-xs text-muted" htmlFor={`ie-${it.id}`}>{t("invoiceTypes.nameEn")}</label>
                      <input id={`ie-${it.id}`} name="nameEn" required defaultValue={it.nameEn} dir="ltr" className={`${inputCls} text-start`} />
                    </div>
                    <div>
                      <label className="text-xs text-muted" htmlFor={`ia-${it.id}`}>{t("invoiceTypes.nameAr")}</label>
                      <input id={`ia-${it.id}`} name="nameAr" required defaultValue={it.nameAr} dir="rtl" className={inputCls} />
                    </div>
                  </ActionForm>
                  <ActionForm
                    action={toggleInvoiceTypeAction.bind(null, it.id)}
                    namespace="admin.invoiceTypes"
                    submit={it.active ? t("companies.deactivate") : t("companies.activate")}
                    className="space-y-0"
                    buttonClassName={small}
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted">{t("invoiceTypes.note")}</p>
        </Card>

        <Card title={t("invoiceTypes.new")}>
          <ActionForm action={createInvoiceTypeAction} namespace="admin.invoiceTypes" submit={c("create")} resetOnSuccess>
            <div>
              <label className={labelCls} htmlFor="n-code">{t("invoiceTypes.code")}</label>
              <input id="n-code" name="code" required maxLength={20} dir="ltr" className={`${inputCls} text-start`} />
            </div>
            <div>
              <label className={labelCls} htmlFor="n-en">{t("invoiceTypes.nameEn")}</label>
              <input id="n-en" name="nameEn" required dir="ltr" className={`${inputCls} text-start`} />
            </div>
            <div>
              <label className={labelCls} htmlFor="n-ar">{t("invoiceTypes.nameAr")}</label>
              <input id="n-ar" name="nameAr" required dir="rtl" className={inputCls} />
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
