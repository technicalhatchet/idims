/**
 * Solomon interface style constants and helpers.
 * Visual values live in styles/solomon-theme.css; this module holds IDs and persistence keys.
 */

export const SOLOMON_INTERFACE = {
  SIGNATURE: 'signature',
  PROFESSIONAL: 'professional',
};

export const SOLOMON_INTERFACE_STORAGE_KEY = 'solomon_interface_style';

export const SOLOMON_INTERFACE_OPTIONS = [
  {
    id: SOLOMON_INTERFACE.SIGNATURE,
    label: 'Signature',
    description: "Solomon's signature diagnostic experience",
  },
  {
    id: SOLOMON_INTERFACE.PROFESSIONAL,
    label: 'Professional',
    description: 'Clean, focused, field-service interface',
    adminOnly: true,
  },
];

const VALID_STYLES = new Set(Object.values(SOLOMON_INTERFACE));

export function normalizeSolomonInterfaceStyle(value) {
  if (value === SOLOMON_INTERFACE.PROFESSIONAL || value === SOLOMON_INTERFACE.SIGNATURE) {
    return value;
  }
  return SOLOMON_INTERFACE.SIGNATURE;
}

export function readStoredSolomonInterfaceStyle() {
  if (typeof window === 'undefined') return SOLOMON_INTERFACE.SIGNATURE;
  try {
    return normalizeSolomonInterfaceStyle(
      window.localStorage.getItem(SOLOMON_INTERFACE_STORAGE_KEY),
    );
  } catch {
    return SOLOMON_INTERFACE.SIGNATURE;
  }
}

export function writeStoredSolomonInterfaceStyle(style) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      SOLOMON_INTERFACE_STORAGE_KEY,
      normalizeSolomonInterfaceStyle(style),
    );
  } catch {
    // ignore quota / private mode
  }
}

export function resolveSolomonInterfaceStyle(storedStyle, { canUseProfessional } = {}) {
  const normalized = normalizeSolomonInterfaceStyle(storedStyle);
  if (normalized === SOLOMON_INTERFACE.PROFESSIONAL && !canUseProfessional) {
    return SOLOMON_INTERFACE.SIGNATURE;
  }
  return normalized;
}

export function isValidSolomonInterfaceStyle(value) {
  return VALID_STYLES.has(value);
}

/** DOM attribute applied to documentElement on Solomon routes */
export const SOLOMON_INTERFACE_ATTR = 'data-solomon-interface';
