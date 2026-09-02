import { LOGIT_BUTTON_SECONDARY } from './logitUi';

export default function LogitHeader({
  leftLabel = '← Projects',
  onLeft,
  title = 'LoGiT',
  subtitle,
  rightLabel,
  onRight,
  rightBadge,
}) {
  return (
    <header
      className="sticky top-0 z-20 border-b border-white/10 bg-[#0A0F1E]/90 backdrop-blur-md"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
    >
      <div className="max-w-lg mx-auto px-4 pb-3 flex items-center justify-between gap-2 min-h-[52px]">
        <button
          type="button"
          className={`${LOGIT_BUTTON_SECONDARY} !min-h-[40px] !px-3 text-sm shrink-0`}
          onClick={onLeft}
        >
          {leftLabel}
        </button>

        <div className="flex-1 text-center min-w-0 px-1">
          <p className="text-xs uppercase tracking-[0.18em] text-white/40 truncate">{title}</p>
          {subtitle && (
            <p className="text-sm text-white/70 truncate mt-0.5">{subtitle}</p>
          )}
        </div>

        {onRight ? (
          <button
            type="button"
            className={`${LOGIT_BUTTON_SECONDARY} !min-h-[40px] !px-3 text-sm shrink-0 relative`}
            onClick={onRight}
          >
            {rightLabel}
            {rightBadge > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-[10px] font-semibold text-black flex items-center justify-center">
                {rightBadge > 99 ? '99+' : rightBadge}
              </span>
            )}
          </button>
        ) : (
          <div className="w-[88px] shrink-0" aria-hidden="true" />
        )}
      </div>
    </header>
  );
}
