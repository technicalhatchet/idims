/** Square Web Payments SDK card field styling (iframe inputs).
 *  Do not set fontFamily to a comma-separated stack — Square rejects it.
 *  Font CSP console noise from cash-f.squarecdn.com inside Square’s iframe is a known SDK quirk; payments still work.
 */
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
  '.message-text.is-error': {
    color: '#f87171',
  },
  '.message-icon.is-error': {
    color: '#f87171',
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
    color: '#6b7280',
  },
  'input.is-error': {
    color: '#f87171',
  },
};

export const SQUARE_CARD_STYLE_LIGHT = {
  '.input-container': {
    borderColor: '#d1d5db',
    borderRadius: '8px',
  },
  '.input-container.is-focus': {
    borderColor: '#059669',
  },
  input: {
    backgroundColor: '#ffffff',
    color: '#111827',
    fontSize: '16px',
  },
  'input.is-focus': {
    backgroundColor: '#ffffff',
    color: '#111827',
    fontSize: '16px',
  },
  'input::placeholder': {
    color: '#9ca3af',
  },
};

/** Light card fields with dark text — use inside dark modals when true dark inputs are unreliable. */
export const SQUARE_CARD_STYLE_ON_DARK_PAGE = {
  '.input-container': {
    borderColor: '#9ca3af',
    borderRadius: '8px',
    backgroundColor: '#f3f4f6',
  },
  '.input-container.is-focus': {
    borderColor: '#22d3ee',
    backgroundColor: '#ffffff',
  },
  '.input-container.is-error': {
    borderColor: '#f87171',
  },
  input: {
    backgroundColor: '#f3f4f6',
    color: '#111827',
    fontSize: '16px',
  },
  'input.is-focus': {
    backgroundColor: '#ffffff',
    color: '#111827',
    fontSize: '16px',
  },
  'input::placeholder': {
    color: '#6b7280',
  },
  'input.is-error': {
    color: '#b91c1c',
  },
  '.message-text': {
    color: '#4b5563',
  },
};
