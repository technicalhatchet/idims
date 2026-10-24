/**
 * iOS Safari: text inside backdrop-filter layers can paint stale digits until touch/scroll.
 * — Foreground content gets its own compositing layer (translateZ(0)).
 * — Live numbers remount via React key when the value changes.
 */

import { forwardRef } from 'react';

export const FROSTED_CARD_CONTENT_CLASS = 'tech-frosted-card-content';

export const FROSTED_CARD_CONTENT_LAYER_STYLE = {
  transform: 'translateZ(0)',
  WebkitTransform: 'translateZ(0)',
};

export const FrostedCardContent = forwardRef(function FrostedCardContent(
  { className = '', style, children, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={`${FROSTED_CARD_CONTENT_CLASS} relative z-10 ${className}`.trim()}
      style={{ ...FROSTED_CARD_CONTENT_LAYER_STYLE, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
});

/** Absolute blur layer — keep text out of this node. */
export function FrostedCardBackdrop({ className = '', style }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 rounded-[inherit] z-0 ${className}`.trim()}
      style={{
        background: 'rgba(13, 21, 37, 0.25)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        ...style,
      }}
      aria-hidden
    />
  );
}

export function repaintValueKey(value) {
  if (value == null) return '__empty';
  return String(value);
}

/**
 * Remounts when `value` changes so Safari repaints digits inside frosted cards.
 */
export function LiveRepaintValue({ value, as = 'span', className, style, children }) {
  const Tag = as;
  const key = repaintValueKey(value);
  const content = children != null ? children : value;
  return (
    <Tag key={key} className={className} style={style}>
      {content}
    </Tag>
  );
}

export function LiveRepaintMoney({ amount, className, style, negative = false }) {
  const n = Number(amount);
  const safe = Number.isFinite(n) ? n : 0;
  const text = `${negative ? '-' : ''}$${Math.abs(safe).toFixed(2)}`;
  return (
    <LiveRepaintValue value={text} className={className} style={style}>
      {text}
    </LiveRepaintValue>
  );
}
