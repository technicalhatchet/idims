import {
  LOGIT_CATEGORY_LABELS,
  LOGIT_FREQUENCY_LABELS,
  LOGIT_GLASS_CARD,
  LOGIT_SEVERITY_LABELS,
  LOGIT_TYPE_EMOJI,
  LOGIT_TYPE_LABELS,
  logitPriorityMeta,
} from './logitUi';
import LogitHeader from './LogitHeader';

function isEntryResolved(entry) {
  return Boolean(entry?.resolved_at);
}

export default function LogitEntryDetail({
  entry,
  project,
  onBack,
  onProcessDraft,
  onContinueReview,
  onToggleResolved,
  onDelete,
  deleting,
  resolving,
}) {
  const isDraft = entry.status === 'draft';
  const isResolved = isEntryResolved(entry);
  const priority = logitPriorityMeta(entry.severity);
  const canResolve = !isDraft && entry.status === 'logged';

  return (
    <div className="min-h-screen flex flex-col">
      <LogitHeader
        title={entry.title || 'Observation'}
        subtitle={project.name}
        leftLabel="← Log"
        onLeft={onBack}
      />

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-4 space-y-4">
        {isDraft && (
          <div className={`p-4 ${LOGIT_GLASS_CARD} border-amber-500/30`}>
            <p className="text-sm text-amber-200/90 mb-3">This observation is unreviewed.</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 min-h-[44px] rounded-xl bg-cyan-500/90 text-white text-sm font-medium"
                onClick={onProcessDraft}
              >
                Process with AI
              </button>
              {entry.title && (
                <button
                  type="button"
                  className="flex-1 min-h-[44px] rounded-xl border border-white/15 text-sm"
                  onClick={onContinueReview}
                >
                  Review & log
                </button>
              )}
            </div>
          </div>
        )}

        {canResolve && (
          <div
            className={`p-4 ${LOGIT_GLASS_CARD} ${
              isResolved ? 'border-emerald-500/50 shadow-[0_0_18px_rgba(16,185,129,0.22)]' : ''
            }`}
          >
            <p className="text-sm text-white/70 mb-3">
              {isResolved
                ? 'This observation has been marked resolved.'
                : 'Mark this observation resolved when it has been addressed.'}
            </p>
            <button
              type="button"
              className={`w-full min-h-[44px] rounded-xl text-sm font-medium transition ${
                isResolved
                  ? 'border border-white/15 text-white/80 hover:bg-white/[0.04]'
                  : 'bg-emerald-500/90 text-white hover:bg-emerald-500'
              }`}
              onClick={() => onToggleResolved(!isResolved)}
              disabled={resolving}
            >
              {resolving
                ? 'Saving…'
                : isResolved
                  ? 'Mark unresolved'
                  : 'Mark resolved'}
            </button>
          </div>
        )}

        <div
          className={`p-5 space-y-4 ${LOGIT_GLASS_CARD} ${
            isResolved ? 'border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.18)]' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            {priority && (
              <span
                className="w-3 h-3 rounded-full border border-white/20"
                style={{ backgroundColor: priority.color }}
                aria-label={`Priority ${priority.label}`}
              />
            )}
            <p className="text-sm text-white/50">
              {LOGIT_TYPE_EMOJI[entry.type]} {LOGIT_TYPE_LABELS[entry.type]}
              {isResolved ? ' · Resolved' : ''}
            </p>
          </div>
          <p className="text-xs text-white/40">
            {LOGIT_CATEGORY_LABELS[entry.category] || entry.category}
          </p>

          {entry.title && <h1 className="text-lg font-medium">{entry.title}</h1>}
          {entry.description && (
            <p className="text-white/80 whitespace-pre-wrap">{entry.description}</p>
          )}

          {entry.impact && (
            <div>
              <p className="text-xs text-white/50 mb-1">Impact</p>
              <p className="text-white/75">{entry.impact}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-white/50">Frequency</p>
              <p>{LOGIT_FREQUENCY_LABELS[entry.frequency] || entry.frequency || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-white/50">Priority</p>
              <p>{LOGIT_SEVERITY_LABELS[entry.severity] || entry.severity || '—'}</p>
            </div>
          </div>

          {entry.suggested_fix && (
            <div>
              <p className="text-xs text-white/50 mb-1">Suggested fix</p>
              <p className="text-white/75">{entry.suggested_fix}</p>
            </div>
          )}

          <div className="border-t border-white/10 pt-4">
            <p className="text-xs text-white/50 mb-2">Original note</p>
            <p className="text-sm text-white/60 italic">&ldquo;{entry.original_transcript}&rdquo;</p>
          </div>
        </div>

        <div className="pt-10 pb-8 text-center">
          <button
            type="button"
            className="text-[11px] text-white/20 hover:text-red-400/70 transition min-h-[44px] px-3"
            onClick={onDelete}
            disabled={deleting}
            aria-label="Delete this observation"
          >
            {deleting ? 'Deleting…' : 'Delete observation'}
          </button>
        </div>
      </div>
    </div>
  );
}
