import {
  LOGIT_BUTTON_SECONDARY,
  LOGIT_CATEGORY_LABELS,
  LOGIT_GLASS_CARD,
  LOGIT_TYPE_EMOJI,
} from './logitUi';

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

export default function LogitEntryList({
  project,
  entries,
  loading,
  onBack,
  onSelectEntry,
}) {
  const groups = groupEntriesByDay(entries);

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <button type="button" className={`${LOGIT_BUTTON_SECONDARY} !min-h-[40px] !px-3 text-sm`} onClick={onBack}>
          ← Capture
        </button>
      </div>

      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Project log</p>
        <h1 className="text-xl font-medium mt-1">{project.icon} {project.name}</h1>
      </header>

      {loading && <p className="text-white/50 text-sm">Loading…</p>}

      {!loading && entries.length === 0 && (
        <div className={`p-6 text-center ${LOGIT_GLASS_CARD}`}>
          <p className="text-white/60">No observations yet.</p>
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
                    className={`w-full text-left p-4 ${LOGIT_GLASS_CARD} hover:bg-white/[0.06] min-h-[64px]`}
                    onClick={() => onSelectEntry(entry)}
                  >
                    <div className="flex items-start gap-3">
                      <span aria-hidden="true">{LOGIT_TYPE_EMOJI[entry.type] || '📝'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white/50">
                          {LOGIT_CATEGORY_LABELS[entry.category] || entry.category}
                          {entry.status === 'draft' ? ' · Draft' : ''}
                        </p>
                        <p className="font-medium truncate mt-0.5">{entry.title || 'Untitled'}</p>
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
  );
}
