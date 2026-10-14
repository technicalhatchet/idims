/** Public marketing / app brand paths (files live in frontend/public). */
export const BRAND_WORDMARK_SRC = '/arneonpano800.webp';
export const BRAND_ICON_SRC = '/icon-512.png';
export const BRAND_SOCIAL_SHARE_SRC = '/social-share-1200x630.jpg';

export const BRAND_MARKETING_SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://atomicrepair419.com'
).replace(/\/$/, '');

/** Absolute URL for Open Graph / Twitter (crawlers require https). */
export function brandPublicUrl(path) {
  if (!path) return BRAND_MARKETING_SITE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  return `${BRAND_MARKETING_SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
