import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import { portalHostRedirects } from './lib/server/portal-host-routing';
import { selectBuildRevision } from './lib/server/build-revision';

// Baseline response headers for every page and BFF route. Scripts are not
// restricted here (a nonce-based script policy is tracked separately); these
// stop framing by other sites, MIME sniffing, referrer leaks and access to
// devices the app does not use. Camera and microphone stay available to this
// origin for video consultations.
export const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()' },
]

const nextConfig: NextConfig = {
  headers: async () => [{ source: '/:path*', headers: SECURITY_HEADERS }],
  devIndicators: false,
  // Next substitutes this value into the built server bundle. A later runtime
  // environment change must not relabel an already-built release.
  env: { QAREVO_BUILD_REVISION: selectBuildRevision(process.env) ?? '' },
  redirects: () => portalHostRedirects(process.env),

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },

};

// German first, English parity (ADR-0002); the locale is resolved per request in i18n/request.ts.
export default createNextIntlPlugin('./i18n/request.ts')(nextConfig);
