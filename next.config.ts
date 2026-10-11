import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    // Invoice uploads (PDF / photos) go through server actions.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default withNextIntl(nextConfig);
