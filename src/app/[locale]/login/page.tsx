import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { BrandLogo } from "@/components/brand-logo";
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
      {/* Brand panel: sits on the start side, so it flips right in Arabic. */}
      <section className="relative flex flex-col overflow-hidden bg-brand-800 px-8 py-10 text-cream-50 sm:px-12 lg:py-12">
        <Image
          src="/logo-monogram.png"
          alt=""
          width={520}
          height={546}
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -end-24 hidden w-[34rem] opacity-[0.06] lg:block"
        />

        <BrandLogo company={brand("company")} product={brand("product")} />

        <div className="relative my-12 lg:my-auto">
          <div className="mb-8 h-px w-16 bg-gold-400/70" />
          <h1 className="max-w-xl font-display text-4xl font-medium leading-tight sm:text-5xl rtl:leading-snug">
            {t("headline")}
          </h1>
          <p className="mt-5 max-w-lg text-lg text-brand-100/90">{t("subheadline")}</p>

          <ul className="mt-10 max-w-xl space-y-6">
            {features.map((key) => (
              <li key={key} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-control border border-white/10 bg-brand-700/60 text-gold-400">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {icons[key]}
                  </svg>
                </span>
                <div>
                  <h2 className="font-semibold">{t(`features.${key}.title`)}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-brand-100/80">{t(`features.${key}.body`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="relative flex flex-col bg-cream-100 px-8 py-8 sm:px-12">
        <div className="flex justify-end">
          <LanguageToggle />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <h2 className="font-display text-4xl font-medium text-brand-900">{t("welcome")}</h2>
          <p className="mt-2 text-muted">{t("welcomeBody")}</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
