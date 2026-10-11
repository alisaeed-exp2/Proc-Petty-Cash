import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { BrandEmblem, BrandLogo } from "@/components/brand-logo";
import { LanguageToggle } from "@/components/language-toggle";
import { LoginForm } from "./login-form";

const icons: Record<string, React.ReactNode> = {
  files: <path d="M7 3h7l5 5v13H7V3Zm7 0v5h5M10 13h6M10 17h6" />,
  balance: <path d="M3 7h18v12H3V7Zm0 4h18M16 15h2M7 7V5h10v2" />,
  approval: <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3Zm-3 9 2.2 2.2L15.5 10" />,
};

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (session?.user) redirect({ href: "/dashboard", locale });

  const t = await getTranslations("login");
  const brand = await getTranslations("brand");
  const features = ["files", "balance", "approval"] as const;

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel (Ocean). It sits on the start side, so it flips to the right in Arabic.
          The guide keeps the English logo in the left corner and the Arabic logo in the right. */}
      <section className="relative flex flex-col overflow-hidden bg-ocean px-8 py-10 text-white sm:px-14 lg:py-14">
        <BrandEmblem
          tone="white"
          size={560}
          className="pointer-events-none absolute -bottom-32 -end-32 hidden w-[36rem] opacity-[0.05] lg:block"
        />

        <BrandLogo locale={locale} tone="white" alt={brand("company")} width={150} priority />

        <div className="relative my-12 lg:my-auto">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-gold">{brand("product")}</p>
          <div className="my-6 h-px w-16 bg-gold/70" />
          <h1 className="max-w-xl font-display text-4xl font-semibold leading-tight sm:text-[2.75rem]">
            {t("headline")}
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-ocean-25">{t("subheadline")}</p>

          <ul className="mt-10 max-w-xl space-y-6">
            {features.map((key) => (
              <li key={key} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-control border border-white/15 bg-white/5 text-gold">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {icons[key]}
                  </svg>
                </span>
                <div>
                  <h2 className="font-semibold">{t(`features.${key}.title`)}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-ocean-25">{t(`features.${key}.body`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="relative flex flex-col bg-offwhite-50 px-8 py-8 sm:px-14">
        <div className="flex justify-end">
          <LanguageToggle />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h2 className="font-display text-4xl font-semibold text-ocean">{t("welcome")}</h2>
          <p className="mt-2 text-muted">{t("welcomeBody")}</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
