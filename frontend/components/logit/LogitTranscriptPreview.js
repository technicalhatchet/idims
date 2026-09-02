import { LOGIT_BUTTON_PRIMARY, LOGIT_BUTTON_SECONDARY, LOGIT_GLASS_CARD, LOGIT_TEXTAREA } from './logitUi';

export default function LogitTranscriptPreview({
  transcript,
  onTranscriptChange,
  onProcess,
  onCancel,
  onSaveDraft,
  processing,
  saveError,
}) {
  return (
    <div className="max-w-lg mx-auto w-full px-4 py-8">
      <h2 className="text-lg font-medium mb-4">I heard:</h2>
      <div className={`p-4 mb-6 ${LOGIT_GLASS_CARD}`}>
        <textarea
          className={LOGIT_TEXTAREA}
          rows={6}
          value={transcript}
          onChange={(e) => onTranscriptChange(e.target.value)}
          aria-label="Edit transcript before processing"
        />
      </div>
      {saveError && (
        <p className="text-amber-300/90 text-sm mb-4" role="alert">{saveError}</p>
      )}
      <div className="flex gap-3">
        <button type="button" className={`flex-1 ${LOGIT_BUTTON_SECONDARY}`} onClick={onCancel} disabled={processing}>
          Cancel
        </button>
        {onSaveDraft && (
          <button
            type="button"
            className={`flex-1 ${LOGIT_BUTTON_SECONDARY}`}
            onClick={onSaveDraft}
            disabled={processing || !transcript.trim()}
          >
            Save draft
          </button>
        )}
        <button
          type="button"
          className={`flex-1 ${LOGIT_BUTTON_PRIMARY}`}
          onClick={onProcess}
          disabled={processing || !transcript.trim()}
        >
          {processing ? 'Processing…' : 'Process'}
        </button>
      </div>
    </div>
  );
}
