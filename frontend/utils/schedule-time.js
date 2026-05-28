/** Field service operates in Eastern time; naive API timestamps use this zone. */
export const FIELD_SERVICE_TIMEZONE = 'America/New_York';

function getLocalPartsInZone(date, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    dtf
      .formatToParts(date)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function zonedLocalToUtcMs(year, month, day, hour, minute, second, timeZone) {
  let utc = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 4; i += 1) {
    const local = getLocalPartsInZone(new Date(utc), timeZone);
    const diff =
      Date.UTC(year, month - 1, day, hour, minute, second) -
      Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    if (diff === 0) break;
    utc += diff;
  }
  return utc;
}

/**
 * Parse combined-schedule timestamps to UTC epoch ms.
 * Timezone-aware strings parse normally; naive strings are Eastern local wall time.
 */
export function parseScheduleUtcMs(raw) {
  const s = String(raw || '').trim();
  if (!s) return NaN;

  const hasExplicitZone =
    /z$/i.test(s)
    || /[+-]\d{2}:\d{2}$/.test(s)
    || /[+-]\d{4}$/.test(s);

  if (hasExplicitZone) {
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : NaN;
  }

  const normalized = s.replace(' ', 'T').replace(/\.\d+$/, '');
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : NaN;
  }

  return zonedLocalToUtcMs(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] || 0),
    FIELD_SERVICE_TIMEZONE,
  );
}

export function formatScheduleTime(raw, options = {}) {
  const ms = parseScheduleUtcMs(raw);
  if (!Number.isFinite(ms)) return '';
  return new Date(ms).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: FIELD_SERVICE_TIMEZONE,
    ...options,
  });
}

export function appointmentStartMs(apptOrStartField) {
  const raw =
    typeof apptOrStartField === 'string'
      ? apptOrStartField
      : apptOrStartField?.scheduled_start || apptOrStartField?.start || '';
  return parseScheduleUtcMs(raw);
}
