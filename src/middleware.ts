import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Locale detection and /ar, /en prefixes. Authentication is enforced in the
// server layouts (see src/app/[locale]/dashboard) so role checks stay in one place.
export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
