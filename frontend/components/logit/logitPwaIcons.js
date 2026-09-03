export const LOGIT_PWA_VERSION = 4;

export const LOGIT_LOGO_SRC = `/logitlogo.png?v=${LOGIT_PWA_VERSION}`;

export const LOGIT_PWA_ICONS = {
  ios: `/logiticon-ios-180x180.png?v=${LOGIT_PWA_VERSION}`,
  android192: `/logiticon-android-192x192.png?v=${LOGIT_PWA_VERSION}`,
  android512: `/logiticon-android-512x512.png?v=${LOGIT_PWA_VERSION}`,
};

export function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isLogitStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
  );
}

export function logitPwaIconSrc() {
  if (typeof navigator === 'undefined') return LOGIT_PWA_ICONS.android192;
  return isIosDevice() ? LOGIT_PWA_ICONS.ios : LOGIT_PWA_ICONS.android192;
}
