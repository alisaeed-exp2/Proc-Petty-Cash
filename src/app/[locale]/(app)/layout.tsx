import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/session";
import { companyName, getActiveCompany, getAllowedCompanies } from "@/lib/company";
import { CompanySwitcher } from "@/components/company-switcher";
import { navFor } from "@/lib/nav";
import { BrandLogo } from "@/components/brand-logo";
import { LanguageToggle } from "@/components/language-toggle";
import { NavLink } from "@/components/nav-link";
import { Link } from "@/i18n/navigation";
import { logoutAction } from "./actions";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale);

  const [allowed, active] = await Promise.all([getAllowedCompanies(user.id, user.role), getActiveCompany(user.id, user.role)]);

  const t = await getTranslations("nav");
  const roles = await getTranslations("roles");
  const brand = await getTranslations("brand");
  const common = await getTranslations("common");

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16.5rem_1fr]">
      {/* Phones: the menu is a slide-in drawer driven by this checkbox (no JavaScript needed to open it). */}
      <input type="checkbox" id="nav-toggle" className="peer sr-only" aria-label={t("menu")} />
      <label htmlFor="nav-toggle" aria-hidden className="fixed inset-0 z-30 hidden bg-black/40 peer-checked:block lg:hidden!" />
      <aside className="fixed inset-y-0 start-0 z-40 flex w-72 max-w-[85vw] -translate-x-full flex-col overflow-y-auto bg-ocean text-white transition-transform duration-200 peer-checked:translate-x-0 rtl:translate-x-full rtl:peer-checked:translate-x-0 lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-auto lg:max-w-none lg:translate-x-0 lg:overflow-visible rtl:lg:translate-x-0">
        <div className="px-5 pb-3 pt-5">
          <BrandLogo locale={locale} tone="white" alt={brand("company")} width={112} priority />
          <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.2em] text-gold">{brand("product")}</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3" aria-label={t("menu")}>
          {navFor(user.role).map((item) => (
            <NavLink key={item.href} href={item.href} label={t(item.key)} icon={item.icon} />
          ))}
        </nav>

        <div className="border-t border-white/10 px-5 py-4 text-sm">
          <div className="font-semibold">{user.name}</div>
          <div className="text-xs text-ocean-25">{roles(user.role)}</div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/account/password" className="text-xs text-ocean-25 underline-offset-4 hover:text-white hover:underline">
              {t("account")}
            </Link>
            <LanguageToggle className="text-xs text-ocean-25! hover:text-white!" />
            <form action={logoutAction.bind(null, locale)}>
              <button className="text-xs text-ocean-25 underline-offset-4 hover:text-white hover:underline">
                {common("signOut")}
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="min-w-0 lg:col-start-2">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-white/95 px-4 py-2.5 backdrop-blur sm:px-8">
          <label htmlFor="nav-toggle" className="-ms-1 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-control text-ocean hover:bg-ocean-10 lg:hidden" aria-label={t("menu")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </label>
          <CompanySwitcher
            locale={locale}
            companies={allowed.map((c) => ({ id: c.id, name: companyName(c, locale) }))}
            currentId={active?.id ?? null}
            currentName={active ? companyName(active, locale) : null}
          />
          <span className="hidden shrink-0 text-xs text-muted sm:inline">{user.name}</span>
        </header>
        <main className="px-4 py-6 sm:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
