/** En-route SMS helpers for techboard (iOS-friendly sms: links, no +1 prefix). */

export function phoneForSms(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
}

/** Drive seconds → minute window (center ± 5, minimum 1). */
export function driveMinutesWindow(driveSeconds) {
  const mid = driveSeconds > 0 ? Math.round(driveSeconds / 60) : 20;
  const low = Math.max(1, mid - 5);
  const high = Math.max(low + 1, mid + 5);
  return { low, high };
}

export function clientFirstName(clientName) {
  const name = (clientName || '').trim();
  if (!name) return 'there';
  return name.split(/\s+/)[0];
}

export function buildEnRouteSmsBody({ clientName, techName, driveSeconds }) {
  const { low, high } = driveMinutesWindow(driveSeconds);
  const client = clientFirstName(clientName);
  const tech = (techName || 'your technician').trim();
  return (
    `Hi ${client}, this is ${tech} with Atomic Repair. I'm en route to your appointment ` +
    `and expect to arrive in about ${low}-${high} minutes. Please reply if you need anything. ` +
    `Thank you, and see you soon!`
  );
}

export function buildSmsUrl(phone, body) {
  const num = phoneForSms(phone);
  if (!num) return null;
  return `sms:${num}?body=${encodeURIComponent(body)}`;
}

/** Tenant first, then client (per techboard en-route text rules). */
export function pickEnRouteSmsPhone(job) {
  if (job?.tenant_phone) return job.tenant_phone;
  if (job?.client_phone) return job.client_phone;
  return null;
}
