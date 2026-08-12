import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Full-screen bottom sheet portaled to document.body.
 * Bypasses hud-grid-content pointer-events:none (used for tactical grid double-tap).
 */
export default function MobileActionSheet({
  open,
  onClose,
  title,
  children,
  zIndex = 20000,
}) {
  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 flex flex-col justify-end touch-manipulation"
      style={{ zIndex }}
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-label="Close"
      />
      <div
        className="relative z-[1] w-full max-h-[88vh] overflow-y-auto overscroll-contain rounded-t-2xl border-t border-white/10 bg-[#0D1525] px-4 pt-5 shadow-2xl"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'mobile-action-sheet-title' : undefined}
      >
        {title ? (
          <h2 id="mobile-action-sheet-title" className="text-lg font-semibold text-white mb-4 pr-2">
            {title}
          </h2>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function MobileActionSheetGridTile({
  icon,
  label,
  onClick,
  disabled = false,
  ...props
}) {
  return (
    <button
      type="button"
      className="flex flex-col items-center justify-center gap-1.5 min-h-[92px] rounded-xl border border-white/10 bg-white/[0.06] px-2 py-3 touch-manipulation active:scale-[0.98] transition-transform disabled:opacity-40 disabled:pointer-events-none"
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      <span className="flex h-11 w-11 items-center justify-center text-cyan-400/90 [&>svg]:h-6 [&>svg]:w-6">
        {icon}
      </span>
      <span className="text-[11px] font-medium text-gray-300 leading-tight text-center">
        {label}
      </span>
    </button>
  );
}

export function MobileActionSheetButton({
  children,
  onClick,
  variant = 'default',
  disabled = false,
  href,
  as: Component = 'button',
  ...props
}) {
  const base =
    'flex w-full min-h-[52px] items-center gap-3 rounded-xl px-4 text-base font-medium touch-manipulation active:scale-[0.99] transition-transform';
  const styles = {
    default: `${base} text-gray-100 bg-white/[0.06] border border-white/10 active:bg-white/10`,
    danger: `${base} text-red-300 bg-red-500/10 border border-red-500/35 active:bg-red-500/20`,
    primary: `${base} text-cyan-300 bg-cyan-500/10 border border-cyan-500/35 active:bg-cyan-500/20`,
  };

  const className = styles[variant] || styles.default;

  if (href) {
    return (
      <a href={href} className={className} onClick={onClick} {...props}>
        {children}
      </a>
    );
  }

  return (
    <Component
      type="button"
      className={className}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </Component>
  );
}
