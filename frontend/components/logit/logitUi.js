export const LOGIT_TYPE_LABELS = {
  problem: 'Problem',
  idea: 'Idea',
  blocker: 'Blocker',
  positive: 'Good Stuff',
};

export const LOGIT_TYPE_EMOJI = {
  problem: '🐛',
  idea: '💡',
  blocker: '⚠️',
  positive: '❤️',
};

export const LOGIT_OBSERVATION_TYPES = [
  {
    id: 'problem',
    emoji: '🐛',
    label: 'Problem',
    subtitle: "Something isn't working",
    prompt: 'What went wrong?',
  },
  {
    id: 'idea',
    emoji: '💡',
    label: 'Idea',
    subtitle: 'Something should change',
    prompt: 'What are you thinking?',
  },
  {
    id: 'blocker',
    emoji: '⚠️',
    label: 'Blocker',
    subtitle: "Can't complete the task",
    prompt: "What's blocking you?",
  },
  {
    id: 'positive',
    emoji: '❤️',
    label: 'Good Stuff',
    subtitle: 'They nailed it',
    prompt: 'What worked well?',
  },
];

export const LOGIT_PRIORITY_OPTIONS = [
  { id: 'minor', label: 'Minor', color: '#22c55e', emoji: '🟢' },
  { id: 'moderate', label: 'Moderate', color: '#eab308', emoji: '🟡' },
  { id: 'major', label: 'Major', color: '#f97316', emoji: '🟠' },
  { id: 'critical', label: 'Critical', color: '#ef4444', emoji: '🔴' },
];

export function logitPriorityMeta(severity) {
  if (!severity || severity === 'not_applicable') return null;
  return LOGIT_PRIORITY_OPTIONS.find((p) => p.id === severity) || null;
}

export const LOGIT_CATEGORY_LABELS = {
  scheduling: 'Scheduling',
  job_details: 'Job Details',
  diagnostics: 'Diagnostics',
  parts: 'Parts',
  documentation: 'Documentation',
  photos: 'Photos',
  customer: 'Customer',
  performance: 'Performance',
  ui_ux: 'UI/UX',
  other: 'Other',
};

export const LOGIT_CATEGORY_OPTIONS = Object.keys(LOGIT_CATEGORY_LABELS);

export const LOGIT_SEVERITY_LABELS = {
  minor: 'Minor',
  moderate: 'Moderate',
  major: 'Major',
  critical: 'Critical',
  not_applicable: 'Not applicable',
};

export const LOGIT_FREQUENCY_OPTIONS = [
  'every_time',
  'frequent',
  'occasional',
  'once',
  'unknown',
  'not_applicable',
];

export const LOGIT_FREQUENCY_LABELS = {
  every_time: 'Every time',
  frequent: 'Frequent',
  occasional: 'Occasional',
  once: 'Once',
  unknown: 'Unknown',
  not_applicable: 'N/A',
};

export const LOGIT_GLASS_CARD =
  'rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md';

/** Neon green border + glow for resolved log entries (overrides LOGIT_GLASS_CARD border). */
export const LOGIT_RESOLVED_ACCENT =
  '!border-2 !border-[#39ff14] bg-[#39ff14]/[0.06] shadow-[0_0_6px_#39ff14,0_0_18px_rgba(57,255,20,0.85),0_0_36px_rgba(57,255,20,0.45),0_0_64px_rgba(57,255,20,0.2)]';

export const LOGIT_BUTTON_PRIMARY =
  'min-h-[44px] px-5 py-2.5 rounded-xl bg-cyan-500/90 text-white font-medium hover:bg-cyan-400 transition disabled:opacity-50';

export const LOGIT_BUTTON_SECONDARY =
  'min-h-[44px] px-5 py-2.5 rounded-xl border border-white/15 bg-white/[0.04] text-white/90 hover:bg-white/[0.08] transition disabled:opacity-50';

export const LOGIT_INPUT =
  'w-full min-h-[44px] px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-500/50';

export const LOGIT_TEXTAREA =
  'w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-500/50 resize-y';

export const LOGIT_CANVAS = 'min-h-screen bg-[#0A0F1E] text-white';

export const LOGIT_LAST_PROJECT_KEY = 'logit_last_project_id';
export const LOGIT_DRAFTS_KEY = 'logit_drafts';
export const LOGIT_PENDING_SAVES_KEY = 'logit_pending_saves';
