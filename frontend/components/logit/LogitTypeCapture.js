import { useCallback, useRef, useState } from 'react';
import {
  LOGIT_BUTTON_PRIMARY,
  LOGIT_BUTTON_SECONDARY,
  LOGIT_GLASS_CARD,
  LOGIT_OBSERVATION_TYPES,
  LOGIT_TEXTAREA,
  LOGIT_TYPE_LABELS,
} from './logitUi';
import LogitHeader from './LogitHeader';

const LOCK_SLIDE_THRESHOLD_PX = 80;

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
  const [recState, setRecState] = useState('idle'); // idle | holding | locked
  const [slideOffset, setSlideOffset] = useState(0);
  const pointerStartYRef = useRef(0);
  const micButtonRef = useRef(null);
  const typeMeta = getTypeMeta(observationType);

  const getTranscriptText = useCallback(() => {
    return `${speech.transcript}${speech.interimTranscript ? ` ${speech.interimTranscript}` : ''}`.trim();
  }, [speech.transcript, speech.interimTranscript]);

  const displayText = typedMode ? typedText : getTranscriptText();

  const finishRecording = useCallback(() => {
    const text = getTranscriptText();
    speech.stopListening();
    setRecState('idle');
    setSlideOffset(0);
    if (text) onTranscriptReady(text);
  }, [getTranscriptText, onTranscriptReady, speech]);

  const handleEnableMic = async () => {
    setEnablingMic(true);
    await speech.prepareMicrophone();
    setEnablingMic(false);
  };

  const handlePointerDown = async (e) => {
    if (typedMode || recState === 'locked' || !speech.voiceReady) return;
    e.preventDefault();
    micButtonRef.current?.setPointerCapture(e.pointerId);
    pointerStartYRef.current = e.clientY;
    setSlideOffset(0);
    speech.resetTranscript();
    const started = await speech.startListening();
    if (!started) {
      setRecState('idle');
      return;
    }
    setRecState('holding');
  };

  const handlePointerMove = (e) => {
    if (recState !== 'holding') return;
    const delta = e.clientY - pointerStartYRef.current;
    if (delta <= 0) {
      setSlideOffset(0);
      return;
    }
    const offset = Math.min(delta, LOCK_SLIDE_THRESHOLD_PX + 24);
    setSlideOffset(offset);
    if (delta >= LOCK_SLIDE_THRESHOLD_PX) {
      setRecState('locked');
      setSlideOffset(0);
      try {
        micButtonRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const handlePointerUp = (e) => {
    if (recState === 'locked') return;
    if (recState === 'holding') {
      try {
        micButtonRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      finishRecording();
    }
  };

  const handlePointerCancel = () => {
    if (recState === 'holding') {
      finishRecording();
    }
  };

  const handleTypedSubmit = () => {
    const text = typedText.trim();
    if (!text) return;
    onTranscriptReady(text);
  };

  const showEnableMic = speech.supported && !speech.micReady;
  const slideProgress = Math.min(slideOffset / LOCK_SLIDE_THRESHOLD_PX, 1);
  const lockZoneActive = slideProgress >= 0.65;

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

            {speech.isIos && speech.supported && recState === 'idle' && (
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

            {speech.voiceReady && recState !== 'locked' && (
              <div className="flex flex-col items-center gap-4">
                {recState === 'holding' && (
                  <p className="text-xs text-white/50 text-center" aria-live="polite">
                    Slide down to keep recording
                  </p>
                )}

                <button
                  ref={micButtonRef}
                  type="button"
                  className={`w-40 h-40 rounded-full flex flex-col items-center justify-center gap-2 border-2 transition select-none touch-none ${
                    recState === 'holding'
                      ? 'border-cyan-400 bg-cyan-500/20 scale-105'
                      : 'border-white/20 bg-white/[0.04] hover:bg-white/[0.08]'
                  }`}
                  style={recState === 'holding' ? { transform: `translateY(${slideOffset * 0.35}px) scale(1.05)` } : undefined}
                  aria-label={recState === 'holding' ? 'Recording — release to send or slide down to lock' : 'Hold to talk'}
                  aria-pressed={recState === 'holding'}
                  onPointerDown={(e) => { void handlePointerDown(e); }}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerCancel}
                >
                  <span className="text-5xl" aria-hidden="true">🎙️</span>
                  <span className="text-xs uppercase tracking-wide text-white/70">
                    {recState === 'holding' ? 'Listening…' : 'Hold to talk'}
                  </span>
                  {recState === 'holding' && (
                    <span className="text-xs text-cyan-300" aria-live="polite">
                      {formatElapsed(speech.elapsedMs)}
                    </span>
                  )}
                </button>

                {recState === 'holding' && (
                  <div
                    className={`flex flex-col items-center gap-1 transition-opacity ${
                      lockZoneActive ? 'opacity-100' : 'opacity-70'
                    }`}
                    aria-hidden="true"
                  >
                    <span className="text-lg text-white/40">↓</span>
                    <div
                      className={`w-11 h-11 rounded-full border-2 flex items-center justify-center text-lg transition ${
                        lockZoneActive
                          ? 'border-cyan-400 bg-cyan-500/25 scale-110'
                          : 'border-white/15 bg-white/[0.03]'
                      }`}
                    >
                      🔒
                    </div>
                  </div>
                )}
              </div>
            )}

            {speech.voiceReady && recState === 'locked' && (
              <div className="flex flex-col items-center gap-5 w-full" role="status" aria-live="polite">
                <div className="w-40 h-40 rounded-full flex flex-col items-center justify-center gap-2 border-2 border-cyan-400 bg-cyan-500/20">
                  <span className="text-5xl" aria-hidden="true">🎙️</span>
                  <span className="text-xs uppercase tracking-wide text-cyan-200">Recording</span>
                  <span className="text-xs text-cyan-300">{formatElapsed(speech.elapsedMs)}</span>
                </div>

                {displayText && (
                  <p className="text-sm text-white/60 text-center px-4 max-h-32 overflow-y-auto">
                    {displayText}
                  </p>
                )}

                <button
                  type="button"
                  className={`w-full max-w-xs min-h-[52px] rounded-xl bg-red-500/90 hover:bg-red-400 text-white font-semibold text-base shadow-lg shadow-red-900/30`}
                  onClick={finishRecording}
                  aria-label="Stop recording"
                >
                  ■ Stop
                </button>
                <p className="text-xs text-white/40">Tap stop when you&apos;re done</p>
              </div>
            )}

            {displayText && recState === 'idle' && (
              <p className="text-sm text-white/60 text-center px-4">{displayText}</p>
            )}

            <button
              type="button"
              className="text-sm text-cyan-400/90 underline-offset-2 hover:underline min-h-[44px]"
              onClick={() => setTypedMode(true)}
              disabled={recState !== 'idle'}
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
