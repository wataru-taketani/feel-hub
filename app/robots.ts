import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        disallow: ['/api/', '/mypage', '/history', '/settings', '/groups'],
        allow: ['/lessons', '/login'],
      },
    ],
  };
}
