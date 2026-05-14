import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  // Output 'standalone' für Docker-Container — produziert .next/standalone mit allen Deps
  output: 'standalone',
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    // Avatare und Screenshots koennen als data: URLs aus Tests/Seeds kommen
    // (R2-Upload nicht konfiguriert) — `dangerouslyAllowSVG` brauchen wir nicht.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'media.werkzirkel.de',
      },
      // R2-Public-URL: Subdomain-Variante (z.B. *.r2.cloudflarestorage.com).
      {
        protocol: 'https',
        hostname: '**.r2.cloudflarestorage.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
