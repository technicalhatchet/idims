import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { downloadLogitReportPdf } from '../../utils/logitPdf';
import {
  LOGIT_BUTTON_PRIMARY,
  LOGIT_CATEGORY_LABELS,
  LOGIT_CATEGORY_OPTIONS,
  LOGIT_GLASS_CARD,
  LOGIT_OBSERVATION_TYPES,
  LOGIT_TYPE_EMOJI,
  LOGIT_TYPE_LABELS,
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

function FilterChip({ active, label, count, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 min-h-[36px] px-3 py-1.5 rounded-full text-xs border transition ${
        active
          ? 'border-cyan-500/50 bg-cyan-500/15 text-white'
          : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06] hover:text-white/80'
      } ${className}`}
    >
      {label}
      {count != null ? ` (${count})` : ''}
    </button>
  );
}

function TypeFilterButton({ active, emoji, label, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[52px] px-2 py-2 rounded-xl border text-center transition ${
        active
          ? 'border-cyan-500/50 bg-cyan-500/15 text-white'
          : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06] hover:text-white/80'
      }`}
    >
      <span className="text-lg block" aria-hidden="true">{emoji}</span>
      <span className="text-[11px] font-medium leading-tight block mt-0.5">{label}</span>
      {count != null && (
        <span className="text-[10px] text-white/45 block mt-0.5">{count}</span>
      )}
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
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [includeOriginalTranscripts, setIncludeOriginalTranscripts] = useState(false);

  const loggedCount = useMemo(
    () => entries.filter((entry) => entry.status === 'logged').length,
    [entries],
  );

  const typeCounts = useMemo(() => {
    const counts = { all: entries.length };
    LOGIT_OBSERVATION_TYPES.forEach(({ id }) => {
      counts[id] = entries.filter((e) => e.type === id).length;
    });
    return counts;
  }, [entries]);

  const entriesForCategoryCounts = useMemo(() => {
    if (typeFilter === 'all') return entries;
    return entries.filter((e) => e.type === typeFilter);
  }, [entries, typeFilter]);

  const categoryCounts = useMemo(() => {
    const counts = { all: entriesForCategoryCounts.length };
    LOGIT_CATEGORY_OPTIONS.forEach((key) => {
      counts[key] = entriesForCategoryCounts.filter((e) => e.category === key).length;
    });
    counts.uncategorized = entriesForCategoryCounts.filter((e) => !e.category).length;
    return counts;
  }, [entriesForCategoryCounts]);

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (typeFilter !== 'all') {
      result = result.filter((e) => e.type === typeFilter);
    }
    if (categoryFilter === 'all') return result;
    if (categoryFilter === 'uncategorized') {
      return result.filter((e) => !e.category);
    }
    return result.filter((e) => e.category === categoryFilter);
  }, [entries, typeFilter, categoryFilter]);

  const groups = groupEntriesByDay(filteredEntries);
  const draftCount = filteredEntries.filter((e) => e.status === 'draft').length;

  const activeFilterLabel = useMemo(() => {
    const parts = [];
    if (typeFilter !== 'all') {
      parts.push(LOGIT_TYPE_LABELS[typeFilter] || typeFilter);
    }
    if (categoryFilter !== 'all') {
      parts.push(
        categoryFilter === 'uncategorized'
          ? 'uncategorized'
          : LOGIT_CATEGORY_LABELS[categoryFilter] || categoryFilter,
      );
    }
    return parts.join(' · ');
  }, [typeFilter, categoryFilter]);

  const handleTypeFilter = (nextType) => {
    setTypeFilter(nextType);
    setCategoryFilter('all');
  };

  const clearFilters = () => {
    setTypeFilter('all');
    setCategoryFilter('all');
  };

  const visibleCategories = LOGIT_CATEGORY_OPTIONS.filter(
    (key) => categoryCounts[key] > 0,
  );

  const handleExportPdf = async () => {
    if (!project?.id || loggedCount === 0 || exporting) return;
    setExporting(true);
    const toastId = toast.loading('Building report…');
    try {
      await downloadLogitReportPdf(project.id, {
        includeOriginalTranscripts,
        projectName: project.name,
      });
      toast.success('Report ready', { id: toastId });
    } catch (err) {
      toast.error(err?.message || 'Could not export report', { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <LogitHeader
        title="Project log"
        subtitle={`${project.icon || '📝'} ${project.name}`}
        leftLabel="← Capture"
        onLeft={onBack}
      />

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-4">
        {!loading && loggedCount > 0 && (
          <div className={`mb-4 p-4 ${LOGIT_GLASS_CARD}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Export report</p>
                <p className="text-xs text-white/50 mt-1">
                  PDF summary for {loggedCount} logged observation{loggedCount === 1 ? '' : 's'}.
                  Drafts are excluded.
                </p>
              </div>
              <button
                type="button"
                className={`${LOGIT_BUTTON_PRIMARY} !min-h-[40px] !px-4 text-sm shrink-0`}
                onClick={() => { void handleExportPdf(); }}
                disabled={exporting}
              >
                {exporting ? 'Exporting…' : 'PDF'}
              </button>
            </div>
            <label className="mt-3 flex items-start gap-2 text-xs text-white/60 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={includeOriginalTranscripts}
                onChange={(e) => setIncludeOriginalTranscripts(e.target.checked)}
                disabled={exporting}
              />
              <span>Include original voice notes in the observation log</span>
            </label>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wider text-white/40 mb-2">Type</p>
            <div className="grid grid-cols-2 gap-2 mb-2" role="group" aria-label="Filter by observation type">
              <TypeFilterButton
                active={typeFilter === 'all'}
                emoji="📋"
                label="All"
                count={typeCounts.all}
                onClick={() => handleTypeFilter('all')}
              />
              {LOGIT_OBSERVATION_TYPES.map((item) => (
                <TypeFilterButton
                  key={item.id}
                  active={typeFilter === item.id}
                  emoji={item.emoji}
                  label={item.label}
                  count={typeCounts[item.id]}
                  onClick={() => handleTypeFilter(item.id)}
                />
              ))}
            </div>

            <p className="text-xs uppercase tracking-wider text-white/40 mb-2 mt-4">Category</p>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="group" aria-label="Filter by category">
              <FilterChip
                active={categoryFilter === 'all'}
                label="All"
                count={categoryCounts.all}
                onClick={() => setCategoryFilter('all')}
              />
              {visibleCategories.map((key) => (
                <FilterChip
                  key={key}
                  active={categoryFilter === key}
                  label={LOGIT_CATEGORY_LABELS[key]}
                  count={categoryCounts[key]}
                  onClick={() => setCategoryFilter(key)}
                />
              ))}
              {categoryCounts.uncategorized > 0 && (
                <FilterChip
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
            {activeFilterLabel ? ` in ${activeFilterLabel}` : ''}
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
            <p className="text-white/60">No observations match these filters.</p>
            <button
              type="button"
              className="mt-3 text-sm text-cyan-400/90 min-h-[44px]"
              onClick={clearFilters}
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
