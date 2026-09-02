/**
 * Resolve the name shown in header, greetings, etc.
 * Custom display name (settings) overrides Auth0 profile name.
 */
export function resolveUserDisplayName({ preferences, user } = {}) {
  const custom = String(preferences?.displayName || '').trim();
  if (custom) return custom;

  const authName = String(user?.name || '').trim();
  if (authName) return authName;

  const email = String(user?.email || '').trim();
  if (email) return email.split('@')[0];

  return 'User';
}

export function resolveUserInitial({ preferences, user } = {}) {
  const name = resolveUserDisplayName({ preferences, user });
  return (name.charAt(0) || 'U').toUpperCase();
}
