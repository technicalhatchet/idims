import { useEffect, useMemo, useState } from 'react';
import { formatDiagnosticSummary } from '../../../constants/diagnosticTemplates';
import {
  formatAutoNoteForTextarea,
  parseAutoNoteText,
} from '../intelligence/formatAutoNoteSection';
import DiagnosticTimeline from '../DiagnosticTimeline';
import EvidenceSnapshotPanel from '../EvidenceSnapshotPanel';

export default function DiagnosticReviewStep({ context, readOnly, variant }) {
  const isMobile = variant === 'mobile';
  const summary = formatDiagnosticSummary(context?.payload, { workOrder: context?.workOrder });
  const stepKeyLabels = context?.intelligence?.stepKeyLabels || {};
  const fieldLabels = context?.intelligence?.fieldLabels || {};
  const timeline = context?.payload?.timeline || [];
  const evidenceSnapshot = context?.payload?.evidenceSnapshot;

  const bullets = context?.intelligence?.autoNoteBullets || [];
  const autoNoteFormat = context?.intelligence?.autoNoteFormat || 'bullets';
  const isProseNote = autoNoteFormat === 'prose';
  const includeInSummary = context?.intelligence?.includeAutoNoteInSummary !== false;
  const autoNoteEdited = Boolean(context?.intelligence?.autoNoteEdited);
  const canEdit = !readOnly && Boolean(context?.onAutoNoteBulletsChange);

  const bulletText = useMemo(
    () => formatAutoNoteForTextarea(bullets, autoNoteFormat),
    [bullets, autoNoteFormat],
  );
  const [draftText, setDraftText] = useState(bulletText);
  const [copyState, setCopyState] = useState('idle');
  const [generateState, setGenerateState] = useState('idle');
  const [generateMeta, setGenerateMeta] = useState(null);

  useEffect(() => {
    setDraftText(bulletText);
  }, [bulletText]);

  const handleGenerateServiceNotes = async () => {
    if (!context?.onGenerateServiceNotes || generateState === 'loading') return;

    setGenerateState('loading');
    setGenerateMeta(null);
    try {
      const response = await context.onGenerateServiceNotes();
      if (response) {
        setGenerateMeta({
          source: response.source,
          model: response.model,
          fallbackReason: response.fallbackReason,
        });
      }
      setGenerateState('done');
    } catch {
      setGenerateState('error');
    }
  };

  const handleBulletTextChange = (text) => {
    setDraftText(text);
    context?.onAutoNoteBulletsChange?.(
      parseAutoNoteText(text, autoNoteFormat),
      { edited: true, format: autoNoteFormat },
    );
  };

  const handleCopy = async () => {
    const text = formatAutoNoteForTextarea(bullets, autoNoteFormat);
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('failed');
      setTimeout(() => setCopyState('idle'), 2000);
    }
  };

  return (
    <div
      className={`rounded-xl border p-4 space-y-4 ${
        isMobile ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <h4
        className={`text-sm font-semibold ${
          isMobile ? 'text-cyan-300' : 'text-gray-900 dark:text-white'
        }`}
      >
        Review & Save
      </h4>

      {bullets.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p
              className={`text-xs font-semibold uppercase tracking-wide ${
                isMobile ? 'text-emerald-300/90' : 'text-emerald-700 dark:text-emerald-300'
              }`}
            >
              Diagnostic summary
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {canEdit && context?.onGenerateServiceNotes && (
                <button
                  type="button"
                  onClick={handleGenerateServiceNotes}
                  disabled={generateState === 'loading'}
                  className={`text-[11px] px-2 py-1 rounded border ${
                    isMobile
                      ? 'border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-50'
                      : 'border-cyan-300 text-cyan-800 hover:bg-cyan-50 dark:border-cyan-700 dark:text-cyan-200 dark:hover:bg-cyan-950/40 disabled:opacity-50'
                  }`}
                >
                  {generateState === 'loading'
                    ? 'Generating…'
                    : generateState === 'error'
                      ? 'Generate failed — retry'
                      : 'Generate service notes'}
                </button>
              )}
              {canEdit && context?.onRefreshAutoNote && (
                <button
                  type="button"
                  onClick={context.onRefreshAutoNote}
                  className={`text-[11px] px-2 py-1 rounded border ${
                    isMobile
                      ? 'border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/10'
                      : 'border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-950/40'
                  }`}
                >
                  Refresh from evidence
                </button>
              )}
              <button
                type="button"
                onClick={handleCopy}
                className={`text-[11px] px-2 py-1 rounded border ${
                  isMobile
                    ? 'border-white/15 text-gray-300 hover:bg-white/5'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
              </button>
            </div>
          </div>

          {canEdit ? (
            <textarea
              value={draftText}
              onChange={(e) => handleBulletTextChange(e.target.value)}
              rows={Math.min(
                16,
                Math.max(5, isProseNote ? draftText.split('\n').length + 1 : bullets.length + 1),
              )}
              className={`w-full rounded-lg border px-3 py-2 text-sm font-sans ${
                isMobile
                  ? 'border-white/10 bg-black/20 text-gray-100'
                  : 'border-gray-300 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100'
              }`}
              placeholder={isProseNote ? 'Service note text' : 'One bullet per line'}
            />
          ) : isProseNote ? (
            <pre
              className={`whitespace-pre-wrap text-sm font-sans ${
                isMobile ? 'text-gray-200' : 'text-gray-800 dark:text-gray-200'
              }`}
            >
              {formatAutoNoteForTextarea(bullets, autoNoteFormat)}
            </pre>
          ) : (
            <ul
              className={`text-sm space-y-0.5 ${
                isMobile ? 'text-gray-200' : 'text-gray-800 dark:text-gray-200'
              }`}
            >
              {bullets.map((bullet, index) => (
                <li key={index}>• {bullet}</li>
              ))}
            </ul>
          )}

          {canEdit && (
            <label className={`flex items-center gap-2 text-xs ${isMobile ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>
              <input
                type="checkbox"
                checked={includeInSummary}
                onChange={(e) => context?.onIncludeAutoNoteChange?.(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-400"
              />
              Include summary at top of saved note
            </label>
          )}

          {!canEdit && includeInSummary && (
            <p className={`text-[11px] ${isMobile ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
              Included at top of saved note body
            </p>
          )}

          {canEdit && autoNoteEdited && (
            <p className={`text-[11px] ${isMobile ? 'text-amber-400/90' : 'text-amber-700 dark:text-amber-300'}`}>
              Summary edited — use Refresh from evidence to restore live suggestions
            </p>
          )}

          {generateMeta && (
            <p className={`text-[11px] ${isMobile ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
              {generateMeta.source === 'gemini'
                ? `Service notes drafted with AI (${generateMeta.model || 'Gemini'})`
                : 'Service notes drafted locally — AI unavailable'}
              {generateMeta.source !== 'gemini' && generateMeta.fallbackReason && (
                <span className="block mt-0.5 text-amber-600 dark:text-amber-400">
                  {generateMeta.fallbackReason.includes('limit: 0')
                    ? 'Your Gemini project has no free quota for the configured model. Use gemini-flash-latest or enable billing in Google AI Studio.'
                    : generateMeta.fallbackReason.slice(0, 180)}
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {bullets.length === 0 && canEdit && context?.onGenerateServiceNotes && (
        <div className="space-y-2">
          <p
            className={`text-xs ${isMobile ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}
          >
            Record tests and evidence, then generate a polished service note from your findings.
          </p>
          <button
            type="button"
            onClick={handleGenerateServiceNotes}
            disabled={generateState === 'loading'}
            className={`text-[11px] px-2 py-1 rounded border ${
              isMobile
                ? 'border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-50'
                : 'border-cyan-300 text-cyan-800 hover:bg-cyan-50 dark:border-cyan-700 dark:text-cyan-200 dark:hover:bg-cyan-950/40 disabled:opacity-50'
            }`}
          >
            {generateState === 'loading' ? 'Generating…' : 'Generate service notes'}
          </button>
          {generateState === 'error' && (
            <p className={`text-[11px] ${isMobile ? 'text-red-400' : 'text-red-600 dark:text-red-400'}`}>
              Could not generate notes. Check your connection and try again.
            </p>
          )}
        </div>
      )}

      {(evidenceSnapshot || timeline.length > 0) && (
        <div className="space-y-2">
          {evidenceSnapshot && (
            <EvidenceSnapshotPanel
              snapshot={evidenceSnapshot}
              variant={variant}
              stepKeyLabels={stepKeyLabels}
              title="Evidence snapshot"
            />
          )}
          <DiagnosticTimeline
            timeline={timeline}
            stepKeyLabels={stepKeyLabels}
            fieldLabels={fieldLabels}
            variant={variant}
            title="Diagnostic Timeline"
            defaultExpanded
            maxHeightClass="max-h-56"
          />
        </div>
      )}

      <div>
        <p
          className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
            isMobile ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          Full checklist
        </p>
        <pre
          className={`whitespace-pre-wrap text-sm font-sans ${
            isMobile ? 'text-gray-200' : 'text-gray-800 dark:text-gray-200'
          }`}
        >
          {summary}
        </pre>
      </div>

      {readOnly && (
        <p className={`text-xs ${isMobile ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
          Use Previous to walk through each section.
        </p>
      )}
    </div>
  );
}
