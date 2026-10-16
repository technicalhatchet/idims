import { useUser } from '@auth0/nextjs-auth0/client';

export default function PortalWelcome({ user: userProp }) {
  const { user: auth0User } = useUser();

  const displayName = userProp?.name
    || (auth0User
      ? `${auth0User.given_name || ''} ${auth0User.family_name || ''}`.trim() || auth0User.name
      : 'Guest');
  const firstName = userProp?.firstName || displayName.split(' ')[0] || 'there';

  return (
    <div className="mb-4 sm:mb-5">
      <h2 className="text-lg sm:text-xl font-semibold text-white">
        Welcome back, {firstName}!
      </h2>
      <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
        Here&apos;s what&apos;s happening with your services.
      </p>
    </div>
  );
}
