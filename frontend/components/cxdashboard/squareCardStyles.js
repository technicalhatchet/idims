/** Square Web Payments SDK card field styling.
 *  Allowed on `.input-container`: borderColor, borderRadius, borderWidth only.
 *  Allowed on `input` / `input.is-focus` / placeholders: color, fontSize, fontFamily (single name), fontWeight, backgroundColor.
 *  Do not use comma-separated fontFamily stacks.
 */
export const SQUARE_CARD_STYLE_LIGHT = {
  '.input-container': {
    borderColor: '#d1d5db',
    borderRadius: '8px',
  },
  '.input-container.is-focus': {
    borderColor: '#059669',
  },
  input: {
    color: '#111827',
    fontSize: '16px',
  },
  'input.is-focus': {
    color: '#111827',
    fontSize: '16px',
  },
  'input::placeholder': {
    color: '#9ca3af',
  },
};

/** Readable fields on dark portal / tech billing modals (dark text on Square’s default light inputs). */
export const SQUARE_CARD_STYLE_ON_DARK_PAGE = {
  '.input-container': {
    borderColor: '#9ca3af',
    borderRadius: '8px',
  },
  '.input-container.is-focus': {
    borderColor: '#22d3ee',
  },
  '.input-container.is-error': {
    borderColor: '#f87171',
  },
  '.message-text': {
    color: '#4b5563',
  },
  '.message-icon': {
    color: '#6b7280',
  },
  '.message-text.is-error': {
    color: '#b91c1c',
  },
  '.message-icon.is-error': {
    color: '#b91c1c',
  },
  input: {
    color: '#111827',
    fontSize: '16px',
  },
  'input.is-focus': {
    color: '#111827',
    fontSize: '16px',
  },
  'input::placeholder': {
    color: '#6b7280',
  },
  'input.is-error': {
    color: '#b91c1c',
  },
};

/** Optional true-dark attempt — only used when preferDarkCardFields is set. */
export const SQUARE_CARD_STYLE_DARK = {
  '.input-container': {
    borderColor: '#2d4a52',
    borderRadius: '8px',
  },
  '.input-container.is-focus': {
    borderColor: '#22d3ee',
  },
  '.input-container.is-error': {
    borderColor: '#f87171',
  },
  '.message-text': {
    color: '#9ca3af',
  },
  '.message-icon': {
    color: '#9ca3af',
  },
  input: {
    backgroundColor: '#2d2d2d',
    color: '#ffffff',
    fontSize: '16px',
  },
  'input.is-focus': {
    backgroundColor: '#2d2d2d',
    color: '#ffffff',
    fontSize: '16px',
  },
  'input::placeholder': {
    color: '#9ca3af',
  },
  'input.is-error': {
    color: '#f87171',
  },
};
