import { useState } from 'react';
import {
  LOGIT_BUTTON_PRIMARY,
  LOGIT_BUTTON_SECONDARY,
  LOGIT_CATEGORY_LABELS,
  LOGIT_FREQUENCY_LABELS,
  LOGIT_GLASS_CARD,
  LOGIT_INPUT,
  LOGIT_SEVERITY_LABELS,
  LOGIT_TEXTAREA,
  LOGIT_TYPE_EMOJI,
  LOGIT_TYPE_LABELS,
} from './logitUi';

const TYPE_OPTIONS = ['problem', 'idea', 'blocker', 'positive'];
const CATEGORY_OPTIONS = Object.keys(LOGIT_CATEGORY_LABELS);
const SEVERITY_OPTIONS = Object.keys(LOGIT_SEVERITY_LABELS);
const FREQUENCY_OPTIONS = Object.keys(LOGIT_FREQUENCY_LABELS);

export default function LogitReview({
  project,
  transcript,
  classification,
  onChange,
  onLogIt,
  onEdit,
  onSaveDraft,
  saving,
  saveError,
}) {
  const [showOriginal, setShowOriginal] = useState(false);

  const typeLabel = LOGIT_TYPE_LABELS[classification.type] || classification.type;
  const emoji = LOGIT_TYPE_EMOJI[classification.type] || '📝';

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-6 pb-24">
      <div className={`p-5 space-y-4 ${LOGIT_GLASS_CARD}`}>
        <div>
          <p className="text-sm text-white/50">{emoji} {typeLabel.toUpperCase()}</p>
          <p className="text-xs text-white/40 mt-1">
            {project.name} · {LOGIT_CATEGORY_LABELS[classification.category]}
          </p>
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1" htmlFor="logit-title">Title</label>
          <input
            id="logit-title"
            className={LOGIT_INPUT}
            value={classification.title}
            onChange={(e) => onChange({ ...classification, title: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1" htmlFor="logit-description">Description</label>
          <textarea
            id="logit-description"
            className={LOGIT_TEXTAREA}
            rows={3}
            value={classification.description}
            onChange={(e) => onChange({ ...classification, description: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1" htmlFor="logit-impact">Impact</label>
          <textarea
            id="logit-impact"
            className={LOGIT_TEXTAREA}
            rows={2}
            value={classification.impact}
            onChange={(e) => onChange({ ...classification, impact: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/50 mb-1" htmlFor="logit-frequency">Frequency</label>
            <select
              id="logit-frequency"
              className={LOGIT_INPUT}
              value={classification.frequency}
              onChange={(e) => onChange({ ...classification, frequency: e.target.value })}
            >
              {FREQUENCY_OPTIONS.map((key) => (
                <option key={key} value={key} className="bg-[#0A0F1E]">
                  {LOGIT_FREQUENCY_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1" htmlFor="logit-severity">Severity</label>
            <select
              id="logit-severity"
              className={LOGIT_INPUT}
              value={classification.severity}
              onChange={(e) => onChange({ ...classification, severity: e.target.value })}
            >
              {SEVERITY_OPTIONS.map((key) => (
                <option key={key} value={key} className="bg-[#0A0F1E]">
                  {LOGIT_SEVERITY_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-white/50 mb-1" htmlFor="logit-fix">Suggested fix</label>
          <textarea
            id="logit-fix"
            className={LOGIT_TEXTAREA}
            rows={2}
            value={classification.suggested_fix}
            onChange={(e) => onChange({ ...classification, suggested_fix: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/50 mb-1" htmlFor="logit-type">Type</label>
            <select
              id="logit-type"
              className={LOGIT_INPUT}
              value={classification.type}
              onChange={(e) => onChange({ ...classification, type: e.target.value })}
            >
              {TYPE_OPTIONS.map((key) => (
                <option key={key} value={key} className="bg-[#0A0F1E]">
                  {LOGIT_TYPE_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/50 mb-1" htmlFor="logit-category">Category</label>
            <select
              id="logit-category"
              className={LOGIT_INPUT}
              value={classification.category}
              onChange={(e) => onChange({ ...classification, category: e.target.value })}
            >
              {CATEGORY_OPTIONS.map((key) => (
                <option key={key} value={key} className="bg-[#0A0F1E]">
                  {LOGIT_CATEGORY_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          className="text-sm text-white/50 hover:text-white/80 min-h-[44px]"
          onClick={() => setShowOriginal((v) => !v)}
          aria-expanded={showOriginal}
        >
          {showOriginal ? 'Hide original note' : 'Original note'}
        </button>
        {showOriginal && (
          <p className="text-sm text-white/60 italic border-t border-white/10 pt-3">
            &ldquo;{transcript}&rdquo;
          </p>
        )}
      </div>

      {saveError && (
        <p className="text-amber-300/90 text-sm mt-4" role="alert">{saveError}</p>
      )}

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0A0F1E]/95 border-t border-white/10 backdrop-blur-md">
        <div className="max-w-lg mx-auto flex gap-3">
          <button type="button" className={`flex-1 ${LOGIT_BUTTON_SECONDARY}`} onClick={onEdit} disabled={saving}>
            Edit
          </button>
          <button type="button" className={`flex-1 ${LOGIT_BUTTON_SECONDARY}`} onClick={onSaveDraft} disabled={saving}>
            Draft
          </button>
          <button type="button" className={`flex-1 ${LOGIT_BUTTON_PRIMARY}`} onClick={onLogIt} disabled={saving}>
            {saving ? 'Saving…' : '✓ LOG IT'}
          </button>
        </div>
      </div>
    </div>
  );
}
