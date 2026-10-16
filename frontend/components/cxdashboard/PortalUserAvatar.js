export default function PortalUserAvatar({ user, className = 'w-11 h-11', textClassName = 'text-sm' }) {
  const initials = user?.initials || 'U';

  if (user?.picture) {
    return (
      <img
        src={user.picture}
        alt=""
        className={`${className} rounded-full object-cover shrink-0 bg-white/10`}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={`${className} rounded-full bg-gradient-to-br from-cyan-500 to-orange-500 flex items-center justify-center text-white font-bold shrink-0 ${textClassName}`}
      aria-hidden
    >
      {initials}
    </div>
  );
}
