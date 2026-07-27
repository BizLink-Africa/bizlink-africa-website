import type { NextConfig } from "next";

// Applied to every response (public site and admin alike — see
// src/proxy.ts for the one header that genuinely needs to vary by host,
// X-Robots-Tag, which next.config.ts's static headers() can't do since it
// has no access to the request at build time).
//
// script-src still carries 'unsafe-inline' 'unsafe-eval'. Removing them
// requires a nonce/hash strategy verified against an actual deployed build
// (Next.js's own inline bootstrap scripts and, in dev, React Refresh both
// rely on this) — that verification can only happen against a real Vercel
// deployment, which isn't available in this environment. Documented as an
// unresolved follow-up in docs/PRODUCTION_SECURITY_CHECKLIST.md rather than
// changed blind.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co",
      "connect-src 'self' https://*.supabase.co",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  /* config options here */
  poweredByHeader: false,
  // Required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
  allowedDevOrigins: ['192.168.1.185'],
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/array/:path*',
        destination: 'https://us-assets.i.posthog.com/array/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  // Canonical host is the apex domain — www is a legacy/common-typo entry
  // point only. This is a fixed, hardcoded destination (never derived from
  // request input), so there's no open-redirect surface here.
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.bizlinkafrica.net' }],
        destination: 'https://bizlinkafrica.net/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
