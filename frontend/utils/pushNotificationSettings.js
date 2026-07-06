/** Defaults and helpers for staff push notification settings. */

export const DEFAULT_PUSH_NOTIFICATIONS = {
  morning_briefing: {
    enabled: true,
    hour: 7,
    minute: 0,
    recipients: { admin: true, manager: true, technician: true },
    technicians_see_own_jobs_only: true,
  },
  pending_work_order: {
    enabled: true,
    recipients: { admin: true, manager: true, technician: false },
    include_assigned_technician: false,
  },
  portal_self_schedule: {
    enabled: true,
    recipients: { admin: true, manager: true, technician: true },
    include_assigned_technician: true,
  },
  portal_update_request: {
    enabled: true,
    recipients: { admin: true, manager: true, technician: true },
    include_assigned_technician: false,
  },
  deploy_reminder: {
    enabled: true,
    recipients: { admin: false, manager: false, technician: true },
    include_assigned_technician: false,
  },
};

export const PUSH_NOTIFICATION_LABELS = {
  morning_briefing: {
    title: 'Morning schedule summary',
    description: 'Daily push with job count and first appointment time (shop-local).',
  },
  pending_work_order: {
    title: 'New pending work order',
    description: 'When a work order needs scheduling.',
  },
  portal_self_schedule: {
    title: 'Portal booking confirmed',
    description: 'When a client self-schedules through the portal.',
  },
  portal_update_request: {
    title: 'Portal update request',
    description: 'When a client messages about an open order.',
  },
  deploy_reminder: {
    title: 'Deploy / tap-in reminder',
    description: 'Nudge to mark en-route visits in progress.',
  },
};

export const MORNING_BRIEFING_HOURS = [5, 6, 7, 8, 9, 10, 11];
export const MORNING_BRIEFING_MINUTES = [0, 15, 30, 45];

function mergeRecipients(defaults, incoming) {
  return {
    admin: incoming?.admin ?? defaults.admin,
    manager: incoming?.manager ?? defaults.manager,
    technician: incoming?.technician ?? defaults.technician,
  };
}

export function normalizePushNotifications(data) {
  const base = DEFAULT_PUSH_NOTIFICATIONS;
  const src = data || {};
  const out = {};
  Object.keys(base).forEach((key) => {
    const def = base[key];
    const row = src[key] || {};
    out[key] = {
      ...def,
      ...row,
      recipients: mergeRecipients(def.recipients, row.recipients),
    };
  });
  return out;
}
