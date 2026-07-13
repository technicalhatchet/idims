'use client';

function toneClasses(tone, isMobile) {
  if (tone === 'action') {
    return isMobile
      ? 'border-amber-500/30 bg-amber-500/[0.08] text-amber-100'
      : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100';
  }
  return isMobile
    ? 'border-cyan-500/25 bg-cyan-500/[0.06] text-cyan-100'
    : 'border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-100';
}

export function FieldHelpText({ text, variant = 'mobile' }) {
  if (!text) return null;
  const isMobile = variant === 'mobile';
  return (
    <p className={`text-[11px] leading-snug mb-1.5 ${isMobile ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
      {text}
    </p>
  );
}

export function FieldRecommendationNote({ message, tone = 'tip', variant = 'mobile' }) {
  if (!message) return null;
  const isMobile = variant === 'mobile';
  return (
    <p
      className={`text-[11px] leading-snug mt-2 rounded-lg border px-2.5 py-1.5 ${toneClasses(tone, isMobile)}`}
    >
      {message}
    </p>
  );
}

export function SectionRecommendations({ recommendations = [], variant = 'mobile' }) {
  const sectionLevel = recommendations.filter((rec) => !rec.field);
  if (!sectionLevel.length) return null;
  const isMobile = variant === 'mobile';

  return (
    <div className="space-y-1.5">
      {sectionLevel.map((rec) => (
        <p
          key={rec.id}
          className={`text-[11px] leading-snug rounded-lg border px-2.5 py-1.5 ${toneClasses(rec.tone, isMobile)}`}
        >
          {rec.message}
        </p>
      ))}
    </div>
  );
}
