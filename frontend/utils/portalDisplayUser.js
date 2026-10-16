export function portalUserInitials(name) {
  if (!name || name === 'Guest') return 'U';
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'U';
}

/**
 * Merge portal API profile, admin preview name, and Auth0 session for header/sidebar UI.
 */
export function resolvePortalDisplayUser({ profileUser, auth0User, impersonateName }) {
  const previewClean = impersonateName?.replace(/\s*\([^)]*\)\s*$/, '').trim() || '';
  const auth0Name = auth0User
    ? (`${auth0User.given_name || ''} ${auth0User.family_name || ''}`.trim() || auth0User.name || '')
    : '';

  const name = profileUser?.name || previewClean || auth0Name || 'Guest';
  const firstName = profileUser?.firstName
    || previewClean.split(' ').filter(Boolean)[0]
    || auth0User?.given_name
    || (name !== 'Guest' ? name.split(' ')[0] : 'there');

  return {
    name,
    firstName,
    email: profileUser?.email || auth0User?.email || '',
    picture: auth0User?.picture || null,
    initials: profileUser?.initials || portalUserInitials(name !== 'Guest' ? name : auth0Name),
  };
}
