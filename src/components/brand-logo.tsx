import Image from "next/image";

/**
 * Official Al Khalejiah logo (vectors extracted from the brand guidelines PDF).
 * Per the guide: the English logo is used in English screens and the Arabic logo in
 * Arabic screens, and the logo is never recoloured, rotated, shadowed or stretched.
 * Allowed colourways: "color" (gold emblem + ocean wordmark) on light backgrounds,
 * "white" on Ocean backgrounds, "ocean" (single colour) when the main version
 * cannot be used.
 */
export type LogoTone = "color" | "white" | "ocean";

// Intrinsic aspect ratio of the stacked English / Arabic signature (362 x 289).
const RATIO = 289 / 362;

export function BrandLogo({
  locale,
  alt,
  tone = "color",
  width = 160,
  priority = false,
  className,
}: {
  locale: string;
  alt: string;
  tone?: LogoTone;
  width?: number;
  priority?: boolean;
  className?: string;
}) {
  const lang = locale === "ar" ? "ar" : "en";
  const suffix = tone === "color" ? "" : `-${tone}`;
  return (
    <Image
      src={`/brand/logo-${lang}${suffix}.svg`}
      alt={alt}
      width={width}
      height={Math.round(width * RATIO)}
      priority={priority}
      className={className}
    />
  );
}

/** The emblem on its own: favicon, watermark, compact headers. */
export function BrandEmblem({
  tone = "color",
  size = 48,
  className,
  alt = "",
}: {
  tone?: LogoTone;
  size?: number;
  className?: string;
  alt?: string;
}) {
  const suffix = tone === "color" ? "" : `-${tone}`;
  return (
    <Image
      src={`/brand/emblem${suffix}.svg`}
      alt={alt}
      width={size}
      height={Math.round(size * (208 / 213))}
      className={className}
      aria-hidden={alt === "" ? true : undefined}
    />
  );
}
