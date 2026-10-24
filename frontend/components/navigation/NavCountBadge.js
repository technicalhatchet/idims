/** Matches TechDeckNotificationsBell unread count styling. */
export default function NavCountBadge({ count, className = '' }) {
  const n = Number(count) || 0;
  if (n <= 0) return null;
  return (
    <span
      className={`inline-flex min-w-[18px] h-[18px] px-1 items-center justify-center rounded-full text-[10px] font-bold text-white ${className}`}
      style={{ background: '#EF4444' }}
    >
      {n > 9 ? '9+' : n}
    </span>
  );
}
