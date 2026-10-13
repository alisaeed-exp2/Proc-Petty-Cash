import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/session";
import { SETTING_GROUPS, settingsForUi } from "@/lib/settings";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Notice, PageHeader, btnSecondary, inputCls, labelCls } from "@/components/ui";
import { saveSettingsAction, testStorageAction } from "./actions";

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireUser(locale, ["SYSTEM_ADMIN"]);
  const t = await getTranslations("admin.settings");
  const c = await getTranslations("common");
  const views = new Map((await settingsForUi()).map((v) => [v.key, v]));
  const authSecretOk = !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {!authSecretOk && <div className="mb-4"><Notice tone="bad">{t("errors.noAuthSecret")}</Notice></div>}
      <div className="mb-4"><Notice tone="info">{t("precedence")}</Notice></div>

      <ActionForm action={saveSettingsAction} namespace="admin.settings" submit={c("save")} className="space-y-6">
        {SETTING_GROUPS.map((g) => (
          <Card key={g.id} title={t(`groups.${g.id}.title`)}>
            <p className="mb-4 text-sm text-muted">{t(`groups.${g.id}.hint`)}</p>
            <div className="grid gap-4 md:grid-cols-2">
              {g.items.map((d) => {
                const v = views.get(d.key)!;
                const id = `s-${d.key}`;
                return (
                  <div key={d.key}>
                    <div className="flex items-center justify-between gap-2">
                      <label className={labelCls} htmlFor={id}>{t(`fields.${d.key}`)}</label>
                      <Badge tone={v.source === "db" ? "APPROVED" : v.source === "env" ? "SUBMITTED" : "DRAFT"}>
                        {t(`source.${v.source}`)}
                      </Badge>
                    </div>
                    {v.type === "bool" ? (
                      <select id={id} name={d.key} defaultValue={v.value} dir="ltr" className={inputCls}>
                        <option value="">{t("bool.default")}</option>
                        <option value="true">{t("bool.yes")}</option>
                        <option value="false">{t("bool.no")}</option>
                      </select>
                    ) : v.secret ? (
                      <>
                        <input
                          id={id}
                          name={d.key}
                          type="password"
                          autoComplete="new-password"
                          dir="ltr"
                          placeholder={v.source === "none" ? "" : t("secretSaved")}
                          className={`${inputCls} text-start`}
                        />
                        {v.source === "db" && (
                          <label className="mt-1 flex items-center gap-2 text-xs text-muted">
                            <input type="checkbox" name={`clear:${d.key}`} /> {t("clear")}
                          </label>
                        )}
                      </>
                    ) : (
                      <input id={id} name={d.key} defaultValue={v.value} dir="ltr" className={`${inputCls} text-start`} />
                    )}
                    <p className="mt-1 text-xs text-muted">{t(`help.${d.key}`)}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </ActionForm>

      <Card title={t("test.title")} className="mt-6">
        <p className="mb-3 text-sm text-muted">{t("test.hint")}</p>
        <ActionForm action={testStorageAction} namespace="admin.settings" submit={t("test.run")} buttonClassName={btnSecondary} />
      </Card>
    </>
  );
}
