import { useState } from 'react';
import {
  LOGIT_BUTTON_PRIMARY,
  LOGIT_BUTTON_SECONDARY,
  LOGIT_GLASS_CARD,
  LOGIT_INPUT,
  LOGIT_TEXTAREA,
} from './logitUi';

function formatElapsed(ms) {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function LogitCapture({
  project,
  unreviewedCount,
  speech,
  onOpenLog,
  onSwitchProject,
  onTranscriptReady,
}) {
  const [typedMode, setTypedMode] = useState(false);
  const [typedText, setTypedText] = useState('');

  const displayText = typedMode
    ? typedText
    : `${speech.transcript}${speech.interimTranscript ? ` ${speech.interimTranscript}` : ''}`.trim();

  const handleHoldStart = () => {
    if (typedMode) return;
    speech.resetTranscript();
    speech.startListening();
  };

  const handleHoldEnd = () => {
    if (!speech.listening) return;
    speech.stopListening();
    const text = `${speech.transcript}${speech.interimTranscript ? ` ${speech.interimTranscript}` : ''}`.trim();
    if (text) onTranscriptReady(text);
  };

  const handleTypedSubmit = () => {
    const text = typedText.trim();
    if (!text) return;
    onTranscriptReady(text);
  };

  return (
    <div className="max-w-lg mx-auto w-full px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <button type="button" className={`${LOGIT_BUTTON_SECONDARY} !min-h-[40px] !px-3 text-sm`} onClick={onSwitchProject}>
          ← Projects
        </button>
        <button type="button" className={`${LOGIT_BUTTON_SECONDARY} !min-h-[40px] !px-3 text-sm`} onClick={onOpenLog}>
          Log
        </button>
      </div>

      <header className="text-center mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">LoGiT</p>
        <p className="text-white/70 mt-2">{project.icon} {project.name}</p>
        <h1 className="text-xl font-medium mt-6">What did you notice?</h1>
      </header>

      {!typedMode && (
        <div className="flex flex-col items-center gap-4">
          {!speech.supported && (
            <p className="text-sm text-amber-300/90 text-center" role="status">
              Speech recognition isn&apos;t available here. Use typed input instead.
            </p>
          )}
          {speech.error && (
            <p className="text-sm text-amber-300/90 text-center" role="alert">{speech.error}</p>
          )}

          <button
            type="button"
            className={`w-36 h-36 rounded-full flex flex-col items-center justify-center gap-2 border-2 transition select-none touch-none ${
              speech.listening
                ? 'border-cyan-400 bg-cyan-500/20 scale-105'
                : 'border-white/20 bg-white/[0.04] hover:bg-white/[0.08]'
            }`}
            aria-label={speech.listening ? 'Recording — release to stop' : 'Hold to talk'}
            aria-pressed={speech.listening}
            disabled={!speech.supported}
            onMouseDown={handleHoldStart}
            onMouseUp={handleHoldEnd}
            onMouseLeave={speech.listening ? handleHoldEnd : undefined}
            onTouchStart={(e) => {
              e.preventDefault();
              handleHoldStart();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleHoldEnd();
            }}
          >
            <span className="text-4xl" aria-hidden="true">🎙️</span>
            <span className="text-xs uppercase tracking-wide text-white/70">
              {speech.listening ? 'Listening…' : 'Hold to talk'}
            </span>
            {speech.listening && (
              <span className="text-xs text-cyan-300" aria-live="polite">
                {formatElapsed(speech.elapsedMs)}
              </span>
            )}
          </button>

          {displayText && !speech.listening && (
            <p className="text-sm text-white/60 text-center px-4">{displayText}</p>
          )}

          <button
            type="button"
            className="text-sm text-cyan-400/90 underline-offset-2 hover:underline min-h-[44px]"
            onClick={() => setTypedMode(true)}
          >
            Type instead
          </button>
        </div>
      )}

      {typedMode && (
        <div className={`p-4 space-y-3 ${LOGIT_GLASS_CARD}`}>
          <textarea
            className={LOGIT_TEXTAREA}
            rows={6}
            value={typedText}
            onChange={(e) => setTypedText(e.target.value)}
            placeholder="What did you notice?"
            aria-label="Observation text"
            autoFocus
          />
          <div className="flex gap-2">
            <button type="button" className={`flex-1 ${LOGIT_BUTTON_SECONDARY}`} onClick={() => setTypedMode(false)}>
              Back
            </button>
            <button
              type="button"
              className={`flex-1 ${LOGIT_BUTTON_PRIMARY}`}
              disabled={!typedText.trim()}
              onClick={handleTypedSubmit}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      <div className="mt-10 pt-6 border-t border-white/10 text-center">
        <button type="button" className="text-sm text-white/50 hover:text-white/80 min-h-[44px]" onClick={onOpenLog}>
          {unreviewedCount > 0 ? `${unreviewedCount} unreviewed` : 'View log'}
        </button>
      </div>
    </div>
  );
}
