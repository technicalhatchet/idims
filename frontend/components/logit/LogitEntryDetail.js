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

export default function LogitEntryDetail({
  entry,
  project,
  onBack,
  onProcessDraft,
  onContinueReview,
}) {
  const isDraft = entry.status === 'draft';
  const priority = logitPriorityMeta(entry.severity);

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

        <div className={`p-5 space-y-4 ${LOGIT_GLASS_CARD}`}>
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
      </div>
    </div>
  );
}
