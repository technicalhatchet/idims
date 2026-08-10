/** Square Web Payments SDK card field styling (iframe inputs). */

export const SQUARE_CARD_STYLE_DARK = {
  '.input-container': {
    borderColor: 'rgba(34, 211, 238, 0.25)',
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
    backgroundColor: '#0a0f1a',
    color: '#f3f4f6',
    fontFamily: 'system-ui, -apple-system, sans-serif',
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
  'input::placeholder': {
    color: '#9ca3af',
  },
};
