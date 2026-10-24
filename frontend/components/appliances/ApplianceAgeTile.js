import { useState } from 'react';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export { MONTHS };

export function ApplianceAgeChip({ applianceAge, className = '' }) {
  if (!applianceAge?.age_chip) return null;
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-gray-400 bg-white/5 border border-white/10 ${className}`}
    >
      {applianceAge.age_chip}
    </span>
  );
}

function barColor(applianceAge) {
  if (applianceAge?.lifespan_bar?.past_typical_min) return '#f59e0b';
  return 'rgba(34, 211, 238, 0.55)';
}

export default function ApplianceAgeTile({
  applianceAge,
  variant = 'portal',
  staffOverride,
}) {
  if (!applianceAge) return null;

  const isPortal = variant === 'portal';
  const labelColor = isPortal ? '#6b7280' : 'text-gray-500';
  const valueColor = isPortal ? '#d1d5db' : 'text-gray-200';
  const tileBg = isPortal ? 'rgba(255,255,255,0.04)' : 'bg-gray-50 dark:bg-gray-800/50';

  const inner = (
    <>
      <span
        className={isPortal ? undefined : 'text-[10px] uppercase tracking-wide text-gray-500 block mb-0.5'}
        style={isPortal ? { color: labelColor, fontSize: '0.75rem', display: 'block' } : undefined}
      >
        Age
      </span>
      <span
        className={isPortal ? undefined : 'text-sm font-semibold text-gray-900 dark:text-white block'}
        style={isPortal ? { color: valueColor, fontWeight: 600, display: 'block' } : undefined}
      >
        {applianceAge.age_label}
      </span>
      <span
        className={isPortal ? undefined : 'text-xs text-gray-500 dark:text-gray-400 block mt-0.5'}
        style={isPortal ? { color: '#9ca3af', fontSize: '0.75rem', display: 'block', marginTop: 2 } : undefined}
      >
        {applianceAge.made_label}
      </span>
      {applianceAge.lifespan_bar ? (
        <div
          className={isPortal ? undefined : 'mt-2 h-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden'}
          style={
            isPortal
              ? {
                  marginTop: 8,
                  height: 3,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                }
              : undefined
          }
        >
          <div
            style={{
              width: `${Math.round((applianceAge.lifespan_bar.progress || 0) * 100)}%`,
              height: '100%',
              background: barColor(applianceAge),
              borderRadius: 999,
            }}
          />
        </div>
      ) : null}
      {staffOverride}
    </>
  );

  if (isPortal) {
    return (
      <div style={{ background: tileBg, borderRadius: '8px', padding: '8px 12px', minWidth: 120 }}>
        {inner}
      </div>
    );
  }

  return <div className={`rounded-lg px-3 py-2 ${tileBg}`}>{inner}</div>;
}

export function ManufactureDateOverrideForm({ onSave, saving, initialYear, initialMonth }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(initialYear || currentYear);
  const [month, setMonth] = useState(initialMonth || 1);

  return (
    <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Correct manufacture date</p>
      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-xs text-gray-400">
          Month
          <select
            className="mt-1 block w-full rounded border border-white/15 bg-black/30 text-white text-sm px-2 py-1"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-400">
          Year
          <input
            type="number"
            min={1970}
            max={currentYear + 1}
            className="mt-1 block w-24 rounded border border-white/15 bg-black/30 text-white text-sm px-2 py-1"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave({ manufacture_year: year, manufacture_month: month })}
          className="text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
