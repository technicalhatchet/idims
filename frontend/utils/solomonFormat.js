import { format, isValid } from 'date-fns';

export function formatSolomonDateTime(value, pattern = 'MMM d, h:mm a') {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (!isValid(date)) return '';
  try {
    return format(date, pattern);
  } catch {
    return '';
  }
}
