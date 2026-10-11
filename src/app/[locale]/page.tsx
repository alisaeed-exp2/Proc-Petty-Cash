import { redirect } from "@/i18n/navigation";

// The dashboard guard sends signed-out visitors on to /login.
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: "/dashboard", locale });
}
