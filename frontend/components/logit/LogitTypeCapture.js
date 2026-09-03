import { useState } from 'react';
import {
  LOGIT_BUTTON_PRIMARY,
  LOGIT_BUTTON_SECONDARY,
  LOGIT_GLASS_CARD,
  LOGIT_OBSERVATION_TYPES,
  LOGIT_TEXTAREA,
  LOGIT_TYPE_LABELS,
} from './logitUi';
import LogitHeader from './LogitHeader';

function formatElapsed(ms) {
  const seconds = Math.floor(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function getTypeMeta(observationType) {
  return LOGIT_OBSERVATION_TYPES.find((t) => t.id === observationType) || {
    id: observationType,
    emoji: '📝',
    label: LOGIT_TYPE_LABELS[observationType] || 'Observation',
    subtitle: 'What did you notice?',
    prompt: 'What did you notice?',
  };
}

export default function LogitTypeCapture({
  project,
  observationType,
  speech,
  onBack,
  onTranscriptReady,
}) {
  const [typedMode, setTypedMode] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [enablingMic, setEnablingMic] = useState(false);
  const typeMeta = getTypeMeta(observationType);

  const displayText = typedMode
    ? typedText
    : `${speech.transcript}${speech.interimTranscript ? ` ${speech.interimTranscript}` : ''}`.trim();

  const handleEnableMic = async () => {
    setEnablingMic(true);
    await speech.prepareMicrophone();
    setEnablingMic(false);
  };

  const handleHoldStart = async () => {
    if (typedMode || speech.listening) return;
    speech.resetTranscript();
    await speech.startListening();
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

  const showEnableMic = speech.supported && !speech.micReady;

  return (
    <div className="min-h-screen flex flex-col">
      <LogitHeader
        title={`${typeMeta.emoji} ${typeMeta.label.toUpperCase()}`}
        subtitle={project.name}
        leftLabel="← Back"
        onLeft={onBack}
      />

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-8 flex flex-col items-center">
        <h1 className="text-lg font-medium text-center mb-6">
          {typeMeta.prompt || 'What are you thinking?'}
        </h1>

        {!typedMode && (
          <div className="flex flex-col items-center gap-5 w-full">
            {!speech.supported && (
              <p className="text-sm text-amber-300/90 text-center" role="status">
                Voice capture isn&apos;t supported in this browser. Use Type instead.
              </p>
            )}

            {speech.isIos && speech.supported && (
              <p className="text-xs text-white/45 text-center leading-relaxed px-2">
                On iPhone, tap Enable Microphone once. iOS may not show &ldquo;While Using&rdquo; — use
                {' '}
                <span className="text-white/60">Settings → LoGiT → Microphone</span>
                {' '}
                if voice still fails.
              </p>
            )}

            {showEnableMic && (
              <button
                type="button"
                className={`w-full max-w-xs ${LOGIT_BUTTON_PRIMARY}`}
                onClick={handleEnableMic}
                disabled={enablingMic}
              >
                {enablingMic ? 'Checking microphone…' : 'Enable microphone'}
              </button>
            )}

            {speech.error && (
              <p className="text-sm text-amber-300/90 text-center" role="alert">{speech.error}</p>
            )}

            {speech.voiceReady && (
              <button
                type="button"
                className={`w-40 h-40 rounded-full flex flex-col items-center justify-center gap-2 border-2 transition select-none touch-none ${
                  speech.listening
                    ? 'border-cyan-400 bg-cyan-500/20 scale-105'
                    : 'border-white/20 bg-white/[0.04] hover:bg-white/[0.08]'
                }`}
                aria-label={speech.listening ? 'Recording — release to stop' : 'Hold to talk'}
                aria-pressed={speech.listening}
                onMouseDown={handleHoldStart}
                onMouseUp={handleHoldEnd}
                onMouseLeave={speech.listening ? handleHoldEnd : undefined}
                onTouchStart={(e) => {
                  e.preventDefault();
                  void handleHoldStart();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleHoldEnd();
                }}
              >
                <span className="text-5xl" aria-hidden="true">🎙️</span>
                <span className="text-xs uppercase tracking-wide text-white/70">
                  {speech.listening ? 'Listening…' : 'Hold to talk'}
                </span>
                {speech.listening && (
                  <span className="text-xs text-cyan-300" aria-live="polite">
                    {formatElapsed(speech.elapsedMs)}
                  </span>
                )}
              </button>
            )}

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
          <div className={`p-4 space-y-3 w-full ${LOGIT_GLASS_CARD}`}>
            <textarea
              className={LOGIT_TEXTAREA}
              rows={6}
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder={typeMeta.prompt || 'What did you notice?'}
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
      </div>
    </div>
  );
}
