import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

const ADMIN_HOST = 'admin.bizlinkafrica.net';

// Calling headers() opts this route into per-request dynamic rendering
// (rather than being generated once at build time) specifically so the
// admin host gets its own fully-disallowing robots.txt instead of the
// public site's rules — the two hostnames share this one Next.js app (see
// src/proxy.ts), so the file itself has to make the distinction.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get('host')?.split(':')[0].toLowerCase();

  if (host === ADMIN_HOST) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/admin',
    },
    sitemap: 'https://bizlinkafrica.net/sitemap.xml',
  };
}
