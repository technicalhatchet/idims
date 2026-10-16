import { useUser } from '@auth0/nextjs-auth0/client';

export default function PortalWelcome({ user: userProp }) {
  const { user: auth0User } = useUser();

  const displayName = userProp?.name
    || (auth0User
      ? `${auth0User.given_name || ''} ${auth0User.family_name || ''}`.trim() || auth0User.name
      : 'Guest');
  const firstName = userProp?.firstName || displayName.split(' ')[0] || 'there';

  return (
    <div className="mb-6 sm:mb-8">
      <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">
        Welcome back, {firstName}!
      </h1>
      <p className="text-gray-500 text-sm sm:text-base mt-1">
        Here&apos;s what&apos;s happening with your services.
      </p>
    </div>
  );
}
