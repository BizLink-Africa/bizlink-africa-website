import type { Metadata } from 'next';
import { Geist, Inter } from 'next/font/google';
import { assertRequiredEnvVars } from '@/lib/env';
import { COMPANY } from '@/data/website';
import './globals.css';

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

const BASE_URL = 'https://bizlinkafrica.net';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'BizLink Africa Limited | Next-Gen AI & Payment Infrastructure',
    template: '%s | BizLink Africa Limited',
  },
  description:
    'BizLink Africa Limited helps startups, SMEs, and digital businesses automate customer engagement, social commerce, business workflows, and payment integration support through trusted payment partners.',
  keywords: ['AI automation', 'payment integration', 'social commerce', 'Tanzania', 'East Africa', 'ICT consulting'],
  openGraph: {
    siteName: 'BizLink Africa Limited',
    locale: 'en_TZ',
    type: 'website',
    url: BASE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BizLink Africa Limited',
    description:
      'ICT infrastructure, automation systems, and integration support for startups, SMEs, and digital businesses in Tanzania and East Africa.',
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'BizLink Africa Limited',
  url: BASE_URL,
  logo: `${BASE_URL}/bizlink-logo.jpg`,
  email: 'info@bizlinkafrica.net',
  telephone: COMPANY.phoneLink.replace('tel:', ''),
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Temboni, Ubungo',
    addressLocality: 'Dar es Salaam',
    addressCountry: 'TZ',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  assertRequiredEnvVars();

  return (
    <html lang="en" className={`${geist.variable} ${inter.variable} scroll-smooth`}>
      <body className="min-h-screen flex flex-col bg-[#fbf9f8] text-[#1b1c1c] font-[var(--font-inter),sans-serif] antialiased overflow-x-hidden">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
