import {
  LOGIT_BUTTON_SECONDARY,
  LOGIT_CATEGORY_LABELS,
  LOGIT_FREQUENCY_LABELS,
  LOGIT_GLASS_CARD,
  LOGIT_SEVERITY_LABELS,
  LOGIT_TYPE_EMOJI,
  LOGIT_TYPE_LABELS,
} from './logitUi';

export default function LogitEntryDetail({ entry, project, onBack }) {
  return (
    <div className="max-w-lg mx-auto w-full px-4 py-6">
      <button type="button" className={`mb-6 ${LOGIT_BUTTON_SECONDARY} !min-h-[40px] !px-3 text-sm`} onClick={onBack}>
        ← Back
      </button>

      <div className={`p-5 space-y-4 ${LOGIT_GLASS_CARD}`}>
        <div>
          <p className="text-sm text-white/50">
            {LOGIT_TYPE_EMOJI[entry.type]} {LOGIT_TYPE_LABELS[entry.type]}
          </p>
          <p className="text-xs text-white/40 mt-1">
            {project.name} · {LOGIT_CATEGORY_LABELS[entry.category]}
          </p>
        </div>

        <h1 className="text-lg font-medium">{entry.title}</h1>
        <p className="text-white/80 whitespace-pre-wrap">{entry.description}</p>

        {entry.impact && (
          <div>
            <p className="text-xs text-white/50 mb-1">Impact</p>
            <p className="text-white/75">{entry.impact}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-white/50">Frequency</p>
            <p>{LOGIT_FREQUENCY_LABELS[entry.frequency] || entry.frequency}</p>
          </div>
          <div>
            <p className="text-xs text-white/50">Severity</p>
            <p>{LOGIT_SEVERITY_LABELS[entry.severity] || entry.severity}</p>
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
  );
}
