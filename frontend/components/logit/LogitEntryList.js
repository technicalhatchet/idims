import { useMemo, useState } from 'react';
import {
  LOGIT_CATEGORY_LABELS,
  LOGIT_CATEGORY_OPTIONS,
  LOGIT_GLASS_CARD,
  LOGIT_TYPE_EMOJI,
  logitPriorityMeta,
} from './logitUi';
import LogitHeader from './LogitHeader';

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatDayLabel(iso) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function groupEntriesByDay(entries) {
  const groups = [];
  let currentDay = null;
  entries.forEach((entry) => {
    const day = formatDayLabel(entry.created_at);
    if (day !== currentDay) {
      currentDay = day;
      groups.push({ day, items: [] });
    }
    groups[groups.length - 1].items.push(entry);
  });
  return groups;
}

function EntryPriorityDot({ severity }) {
  const meta = logitPriorityMeta(severity);
  if (!meta) return <span className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />;
  return (
    <span
      className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
      style={{ backgroundColor: meta.color }}
      title={meta.label}
      aria-label={`Priority: ${meta.label}`}
    />
  );
}

function CategoryFilterChip({ active, label, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 min-h-[36px] px-3 py-1.5 rounded-full text-xs border transition ${
        active
          ? 'border-cyan-500/50 bg-cyan-500/15 text-white'
          : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06] hover:text-white/80'
      }`}
    >
      {label}
      {count != null ? ` (${count})` : ''}
    </button>
  );
}

export default function LogitEntryList({
  project,
  entries,
  loading,
  onBack,
  onSelectEntry,
}) {
  const [categoryFilter, setCategoryFilter] = useState('all');

  const categoryCounts = useMemo(() => {
    const counts = { all: entries.length };
    LOGIT_CATEGORY_OPTIONS.forEach((key) => {
      counts[key] = entries.filter((e) => e.category === key).length;
    });
    counts.uncategorized = entries.filter((e) => !e.category).length;
    return counts;
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (categoryFilter === 'all') return entries;
    if (categoryFilter === 'uncategorized') {
      return entries.filter((e) => !e.category);
    }
    return entries.filter((e) => e.category === categoryFilter);
  }, [entries, categoryFilter]);

  const groups = groupEntriesByDay(filteredEntries);
  const draftCount = filteredEntries.filter((e) => e.status === 'draft').length;

  const visibleCategories = LOGIT_CATEGORY_OPTIONS.filter(
    (key) => categoryCounts[key] > 0,
  );

  return (
    <div className="min-h-screen flex flex-col">
      <LogitHeader
        title="Project log"
        subtitle={`${project.icon || '📝'} ${project.name}`}
        leftLabel="← Capture"
        onLeft={onBack}
      />

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-4">
        {!loading && entries.length > 0 && (
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wider text-white/40 mb-2">Category</p>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="group" aria-label="Filter by category">
              <CategoryFilterChip
                active={categoryFilter === 'all'}
                label="All"
                count={categoryCounts.all}
                onClick={() => setCategoryFilter('all')}
              />
              {visibleCategories.map((key) => (
                <CategoryFilterChip
                  key={key}
                  active={categoryFilter === key}
                  label={LOGIT_CATEGORY_LABELS[key]}
                  count={categoryCounts[key]}
                  onClick={() => setCategoryFilter(key)}
                />
              ))}
              {categoryCounts.uncategorized > 0 && (
                <CategoryFilterChip
                  active={categoryFilter === 'uncategorized'}
                  label="Uncategorized"
                  count={categoryCounts.uncategorized}
                  onClick={() => setCategoryFilter('uncategorized')}
                />
              )}
            </div>
          </div>
        )}

        {draftCount > 0 && (
          <p className="text-sm text-amber-300/90 mb-4" role="status">
            {draftCount} unreviewed
            {categoryFilter !== 'all' ? ' in this category' : ''}
            {' '}
            — tap a draft to process or finish logging.
          </p>
        )}

        {loading && <p className="text-white/50 text-sm">Loading…</p>}

        {!loading && entries.length === 0 && (
          <div className={`p-6 text-center ${LOGIT_GLASS_CARD}`}>
            <p className="text-white/60">No observations yet.</p>
          </div>
        )}

        {!loading && entries.length > 0 && filteredEntries.length === 0 && (
          <div className={`p-6 text-center ${LOGIT_GLASS_CARD}`}>
            <p className="text-white/60">No observations in this category.</p>
            <button
              type="button"
              className="mt-3 text-sm text-cyan-400/90 min-h-[44px]"
              onClick={() => setCategoryFilter('all')}
            >
              Show all
            </button>
          </div>
        )}

        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.day}>
              <h2 className="text-xs uppercase tracking-wider text-white/40 mb-3">{group.day}</h2>
              <ul className="space-y-2">
                {group.items.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className={`w-full text-left p-4 ${LOGIT_GLASS_CARD} hover:bg-white/[0.06] min-h-[64px] ${
                        entry.status === 'draft' ? 'border-amber-500/30' : ''
                      }`}
                      onClick={() => onSelectEntry(entry)}
                    >
                      <div className="flex items-start gap-2.5">
                        <EntryPriorityDot severity={entry.severity} />
                        <span className="text-base shrink-0" aria-hidden="true">
                          {LOGIT_TYPE_EMOJI[entry.type] || '📝'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white/50">
                            {LOGIT_CATEGORY_LABELS[entry.category] || entry.category || 'Uncategorized'}
                            {entry.status === 'draft' ? ' · Draft' : ''}
                          </p>
                          <p className="font-medium truncate mt-0.5">
                            {entry.title || entry.original_transcript?.slice(0, 60) || 'Untitled'}
                          </p>
                        </div>
                        <span className="text-xs text-white/40 shrink-0">{formatTime(entry.created_at)}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
