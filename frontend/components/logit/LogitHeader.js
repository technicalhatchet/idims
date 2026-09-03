import { LOGIT_LOGO_SRC } from './logitPwaIcons';
import { LOGIT_BUTTON_SECONDARY } from './logitUi';

export function LogitCenteredLogo({ className = '' }) {
  return (
    <img
      src={LOGIT_LOGO_SRC}
      alt="LoGiT"
      className={`w-auto max-w-full object-contain object-center drop-shadow-[0_0_12px_rgba(0,180,255,0.2)] ${className}`}
      decoding="async"
    />
  );
}

export default function LogitHeader({
  leftLabel = '← Projects',
  onLeft,
  title = 'LoGiT',
  subtitle,
  rightLabel,
  onRight,
  rightBadge,
}) {
  const contextTitle = title && title !== 'LoGiT' ? title : null;
  const hasContextBelow = Boolean(contextTitle || subtitle);

  return (
    <header
      className="sticky top-0 z-20 border-b border-white/10 bg-[#0A0F1E]/90 backdrop-blur-md"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
    >
      <div className="max-w-lg mx-auto px-4 pb-3">
        <div
          className={`relative flex items-center justify-between gap-2 ${
            hasContextBelow ? 'min-h-[64px]' : 'min-h-[52px]'
          }`}
        >
          <button
            type="button"
            className={`${LOGIT_BUTTON_SECONDARY} !min-h-[40px] !px-3 text-sm shrink-0 relative z-10`}
            onClick={onLeft}
          >
            {leftLabel}
          </button>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[5.5rem] py-0.5">
            <LogitCenteredLogo
              className={hasContextBelow ? 'h-7 sm:h-8' : 'h-9 sm:h-10'}
            />
            {contextTitle && (
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/45 truncate mt-1 max-w-full px-1">
                {contextTitle}
              </p>
            )}
            {subtitle && (
              <p
                className={`text-sm text-white/70 truncate max-w-full px-1 ${
                  contextTitle ? 'mt-0.5' : 'mt-1'
                }`}
              >
                {subtitle}
              </p>
            )}
          </div>

          {onRight ? (
            <button
              type="button"
              className={`${LOGIT_BUTTON_SECONDARY} !min-h-[40px] !px-3 text-sm shrink-0 relative z-10`}
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
            <div className="w-[88px] shrink-0 relative z-10" aria-hidden="true" />
          )}
        </div>
      </div>
    </header>
  );
}
