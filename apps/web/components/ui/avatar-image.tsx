/**
 * <AvatarImage> — schlanker next/image-Wrapper fuer Avatare und Screenshots.
 *
 * Quelle: PRD §32 (Performance-Budgets) — Auto-AVIF/WebP + Lazy-Loading +
 * srcSet ueber das Next-Image-CDN sparen Initial-Bytes auf Werke-Listen
 * und Builder-Profil-Seiten signifikant.
 *
 * Designentscheidung:
 * - Server Component (kein 'use client'), reine Render-Logik.
 * - Wenn `src` als data:-URL kommt (Tests, Vorschau im Uploader), wird das
 *   Bild mit `unoptimized` durchgereicht — Next-Image-Optimizer kann data:
 *   nicht servieren.
 * - Default: lazy loading, decoding='async'.
 */

import Image from 'next/image';

export type AvatarImageProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Inline-Styles werden weitergereicht (z.B. borderRadius:'50%'). */
  style?: React.CSSProperties;
  /** `true` = sofort laden (above-the-fold). Default: lazy. */
  priority?: boolean;
  className?: string;
};

export function AvatarImage({
  src,
  alt,
  width,
  height,
  style,
  priority,
  className,
}: AvatarImageProps) {
  // data: und blob: URLs koennen vom Next-Optimizer nicht serviert werden.
  const isNonOptimizable = src.startsWith('data:') || src.startsWith('blob:');
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      style={style}
      className={className}
      unoptimized={isNonOptimizable}
      // Avatare/Screenshots sind in der Regel below-the-fold ausser dem
      // Header-Avatar — Default = lazy.
      loading={priority ? 'eager' : 'lazy'}
      priority={priority}
    />
  );
}
