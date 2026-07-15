'use client';

import { useState } from 'react';
import {
  formatTimelineEventLabel,
  formatTimelineEventTime,
} from './intelligence/timeline';

const ACTION_STYLES = {
  entered: { symbol: '→', tone: 'text-cyan-400' },
  completed: { symbol: '✓', tone: 'text-emerald-400' },
  field_updated: { symbol: '✎', tone: 'text-violet-400' },
};

export default function DiagnosticTimeline({
  timeline = [],
  stepKeyLabels = {},
  fieldLabels = {},
  variant = 'mobile',
  title = 'Diagnostic Timeline',
  emptyMessage = 'Timeline events will appear as you work through the diagnostic.',
  maxHeightClass = 'max-h-48',
  defaultExpanded = false,
}) {
  const isMobile = variant === 'mobile';
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!timeline?.length) {
    return (
      <div
        className={`rounded-xl border px-3 py-2.5 text-[11px] ${
          isMobile
            ? 'border-white/10 bg-white/[0.02] text-gray-400'
            : 'border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400'
        }`}
      >
        <p className="font-semibold uppercase tracking-wide opacity-80">{title}</p>
        <p className="mt-1 opacity-70">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border text-[11px] ${
        isMobile
          ? 'border-cyan-500/20 bg-cyan-500/[0.04] text-gray-200'
          : 'border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-200'
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="font-semibold uppercase tracking-wide opacity-90">{title}</span>
        <span className="opacity-60">
          {timeline.length} event{timeline.length === 1 ? '' : 's'} {expanded ? '▾' : '▸'}
        </span>
      </button>

      {expanded && (
        <ul className={`px-3 pb-3 space-y-2 overflow-y-auto ${maxHeightClass}`}>
          {timeline.map((event, index) => {
            const style = ACTION_STYLES[event.action] || ACTION_STYLES.entered;
            const label = formatTimelineEventLabel(event, stepKeyLabels, fieldLabels);
            return (
              <li key={`${event.at}-${event.action}-${index}`} className="flex gap-2">
                <span className={`shrink-0 w-4 text-center ${style.tone}`}>{style.symbol}</span>
                <div className="min-w-0 flex-1">
                  <p className="leading-snug">{label}</p>
                  <p className="opacity-50 text-[10px]">{formatTimelineEventTime(event.at)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
