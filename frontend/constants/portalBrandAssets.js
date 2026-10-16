/** Client portal brand assets under /public/arportal-brand */
export const PORTAL_BRAND_VERSION = 2;

const v = `?v=${PORTAL_BRAND_VERSION}`;

/** Trimmed copy of atomic-portal-split-flat.png (transparent padding removed). */
export const PORTAL_LOGO_SRC = `/arportal-brand/atomic-portal-logo.png${v}`;

/** @deprecated Use PORTAL_LOGO_SRC — source art with padding kept for reference. */
export const PORTAL_SPLIT_FLAT_SRC = `/arportal-brand/atomic-portal-split-flat.png${v}`;

export const PORTAL_HEADER_LOGO_SRC = PORTAL_LOGO_SRC;

export const PORTAL_FAVICON_ICO = `/arportal-brand/favicon.ico${v}`;
export const PORTAL_FAVICON_16 = `/arportal-brand/png/favicon-16.png${v}`;
export const PORTAL_FAVICON_32 = `/arportal-brand/png/favicon-32.png${v}`;
export const PORTAL_APPLE_TOUCH_ICON = `/arportal-brand/png/apple-touch-icon.png${v}`;
export const PORTAL_ICON_192 = `/arportal-brand/png/icon-192.png${v}`;
export const PORTAL_ICON_512 = `/arportal-brand/png/icon-512.png${v}`;
export const PORTAL_ICON_MASKABLE_192 = `/arportal-brand/png/icon-maskable-192.png${v}`;
export const PORTAL_ICON_MASKABLE_512 = `/arportal-brand/png/icon-maskable-512.png${v}`;
