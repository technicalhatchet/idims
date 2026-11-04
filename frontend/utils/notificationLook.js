/**
 * Icon + tone for a TechDeck notification, from its link type and title.
 * Cyan: jobs, scheduling, customer messages. Orange: money and estimates.
 */
export function notificationLook(n) {
  const title = String(n?.title || '').toLowerCase();
  const type = String(n?.related_type || '').toLowerCase();
  if (type === 'invoice' || /invoice|payment|paid|refund/.test(title)) return { icon: 'card', tone: 'orange' };
  if (/estimate/.test(title)) return { icon: 'doc', tone: 'orange' };
  if (/schedul|booking|appointment|today'?s schedule|reschedul/.test(title)) return { icon: 'calendar', tone: 'cyan' };
  if (/media|photo|video/.test(title)) return { icon: 'photo', tone: 'cyan' };
  if (/review|how did we do/.test(title)) return { icon: 'star', tone: 'cyan' };
  if (/request|message|reply/.test(title)) return { icon: 'chat', tone: 'cyan' };
  if (type === 'work_order' || /job|work order|assignment|tap in/.test(title)) return { icon: 'job', tone: 'cyan' };
  return { icon: 'bell', tone: 'cyan' };
}
