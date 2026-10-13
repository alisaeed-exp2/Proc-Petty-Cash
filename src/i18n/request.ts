import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

// Message files are split by area; each file holds its own top-level namespaces.
const FILES = ["core", "nav", "admin", "money", "expenses", "review", "dash", "reports", "ctx"] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const parts = await Promise.all(
    FILES.map(async (file) => (await import(`../../messages/${locale}/${file}.json`)).default),
  );

  return { locale, messages: Object.assign({}, ...parts) };
});
