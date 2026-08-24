const SOLOMON_RETURN = '/solomon';
export const SOLOMON_DIY_ENROLL_RETURN = '/solomon?diy_enroll=1';

export const SOLOMON_DIY_SIGNUP_KEY = 'solomon_diy_signup';
export const SOLOMON_DIYER_SESSION_KEY = 'solomon_is_diyer';

export function markSolomonDiyerSession() {
  try {
    sessionStorage.setItem(SOLOMON_DIYER_SESSION_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function hasSolomonDiyerSession() {
  try {
    return sessionStorage.getItem(SOLOMON_DIYER_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function markSolomonDiySignupIntent() {
  try {
    sessionStorage.setItem(SOLOMON_DIY_SIGNUP_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearSolomonDiySignupIntent() {
  try {
    sessionStorage.removeItem(SOLOMON_DIY_SIGNUP_KEY);
  } catch {
    /* ignore */
  }
}

export function hasSolomonDiySignupIntent() {
  try {
    return sessionStorage.getItem(SOLOMON_DIY_SIGNUP_KEY) === '1';
  } catch {
    return false;
  }
}

export function solomonLoginUrl(returnTo = SOLOMON_RETURN) {
  const params = new URLSearchParams({ returnTo });
  return `/api/auth/login?${params.toString()}`;
}

export function solomonDiySignupUrl() {
  markSolomonDiySignupIntent();
  const params = new URLSearchParams({
    returnTo: SOLOMON_DIY_ENROLL_RETURN,
    screen_hint: 'signup',
  });
  return `/api/auth/login?${params.toString()}`;
}
