import Image from "next/image";

/**
 * Temporary logo: the gold monogram supplied by the client plus a text wordmark.
 * Swap /public/logo-monogram.png (or this component) once the official files arrive.
 */
export function BrandLogo({
  company,
  product,
  size = 56,
}: {
  company: string;
  product: string;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-4">
      <Image src="/logo-monogram.png" alt="" width={size} height={Math.round(size * 1.05)} priority />
      <div className="leading-tight">
        <div className="font-display text-2xl font-medium tracking-wide text-cream-50">{company}</div>
        <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.22em] text-gold-400">
          {product}
        </div>
      </div>
    </div>
  );
}
