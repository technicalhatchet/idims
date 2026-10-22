import { buildSmsUrl } from './enRouteSms';

export function buildPortalInviteSmsBody({ inviteeName, inviteUrl }) {
  const first = (inviteeName || '').trim().split(/\s+/)[0] || 'there';
  return (
    `Hi ${first}, Atomic Repair invited you to our customer portal. `
    + `Create your login here: ${inviteUrl}`
  );
}

export function buildPortalInviteSmsUrl(phone, body) {
  return buildSmsUrl(phone, body);
}
