export const SOLOMON_PLATFORM_TITLE = 'Solomon Guided Diagnostic Platform';

export const SOLOMON_PWA_VERSION = 7;

export const SOLOMON_PWA_ICONS = {
  ios: `/solomonicon-ios-180x180.png?v=${SOLOMON_PWA_VERSION}`,
  android192: `/solomonicon-android-192x192.png?v=${SOLOMON_PWA_VERSION}`,
  android512: `/solomonicon-android-512x512.png?v=${SOLOMON_PWA_VERSION}`,
};

export function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function solomonPwaIconSrc() {
  if (typeof navigator === 'undefined') return SOLOMON_PWA_ICONS.android192;
  return isIosDevice() ? SOLOMON_PWA_ICONS.ios : SOLOMON_PWA_ICONS.android192;
}
