import type { MetadataRoute } from 'next';

const BASE_URL = 'https://bizlinkafrica.net';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/solutions', '/partnership', '/merchant-payment-infrastructure', '/contact', '/privacy-policy', '/terms-of-service', '/client-portal'];

  return routes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: route === '' ? 1 : 0.7,
  }));
}
