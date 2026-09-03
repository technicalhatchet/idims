import { useCallback, useEffect, useRef, useState } from 'react';
import { isIosDevice, isLogitStandalone } from '../components/logit/logitPwaIcons';

export { isIosDevice };
export function isStandalonePwa() {
  return isLogitStandalone();
}

const MIC_GRANTED_KEY = 'logit_mic_granted';

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function micDeniedMessage() {
  if (isLogitStandalone()) {
    return (
      'Microphone is off for LoGiT. Open Settings → LoGiT → Microphone, allow access, then reload. '
      + 'Or use Type instead.'
    );
  }
  if (isIosDevice()) {
    return (
      'Microphone is off. Install LoGiT to your home screen first (Share → Add to Home Screen), '
      + 'then allow the mic when prompted. Or use Type instead.'
    );
  }
  return 'Microphone is off for this site. Check browser site permissions, then reload. Or use Type instead.';
}

async function requestMicrophoneAccess() {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, reason: 'unsupported' };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return { ok: true };
  } catch (err) {
    const name = err?.name || '';
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return { ok: false, reason: 'denied' };
    }
    return { ok: false, reason: 'error' };
  }
}

export function useLogitSpeech() {
  const recognitionRef = useRef(null);
  const wantsListeningRef = useRef(false);
  const [supported, setSupported] = useState(false);
  const [micAccess, setMicAccess] = useState('unknown');
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef(null);
  const startTimeRef = useRef(0);

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognition()));
    try {
      if (localStorage.getItem(MIC_GRANTED_KEY) === '1') {
        setMicAccess('granted');
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!navigator.permissions?.query) return undefined;
    let cancelled = false;
    navigator.permissions
      .query({ name: 'microphone' })
      .then((status) => {
        if (cancelled) return;
        if (status.state === 'granted') setMicAccess('granted');
        if (status.state === 'denied') setMicAccess('denied');
        status.onchange = () => {
          if (status.state === 'granted') setMicAccess('granted');
          if (status.state === 'denied') setMicAccess('denied');
        };
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    wantsListeningRef.current = false;
    stopTimer();
    setListening(false);
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
  }, [stopTimer]);

  const prepareMicrophone = useCallback(async () => {
    setError(null);
    const result = await requestMicrophoneAccess();
    if (result.ok) {
      setMicAccess('granted');
      try {
        localStorage.setItem(MIC_GRANTED_KEY, '1');
      } catch {
        // ignore
      }
      return true;
    }
    if (result.reason === 'denied') {
      setMicAccess('denied');
      setError(micDeniedMessage());
    } else {
      setError('Microphone is not available on this device. Use Type instead.');
    }
    return false;
  }, []);

  const beginRecognition = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = !isIosDevice();
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const chunk = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) {
          finalText += chunk;
        } else {
          interim += chunk;
        }
      }
      if (finalText) {
        setTranscript((prev) => `${(prev ? `${prev} ` : '')}${finalText}`.trim());
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setMicAccess('denied');
        setError(micDeniedMessage());
      } else if (event.error !== 'aborted') {
        setError('Could not capture speech. Try typing instead.');
      }
      if (event.error !== 'aborted') {
        wantsListeningRef.current = false;
        stopTimer();
        setListening(false);
      }
    };

    recognition.onend = () => {
      if (wantsListeningRef.current && isIosDevice()) {
        try {
          recognition.start();
          return;
        } catch {
          // fall through
        }
      }
      stopTimer();
      setListening(false);
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setListening(true);
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setElapsedMs(Date.now() - startTimeRef.current);
        }, 200);
      }
    } catch {
      wantsListeningRef.current = false;
      setError('Could not start microphone. Use Type instead.');
      stopListening();
    }
  }, [stopListening, stopTimer]);

  const startListening = useCallback(async () => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser.');
      return false;
    }

    if (micAccess !== 'granted') {
      const micReady = await prepareMicrophone();
      if (!micReady) return false;
    }

    setError(null);
    setInterimTranscript('');
    wantsListeningRef.current = true;
    startTimeRef.current = Date.now();
    setElapsedMs(0);
    beginRecognition();
    return true;
  }, [beginRecognition, micAccess, prepareMicrophone]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
    setElapsedMs(0);
    startTimeRef.current = 0;
  }, []);

  useEffect(() => () => {
    wantsListeningRef.current = false;
    stopTimer();
    try {
      recognitionRef.current?.abort();
    } catch {
      // ignore
    }
  }, [stopTimer]);

  const micReady = micAccess === 'granted';
  const voiceReady = supported && micReady;

  return {
    supported,
    micAccess,
    micReady,
    voiceReady,
    isIos: isIosDevice(),
    isStandalonePwa: isStandalonePwa(),
    listening,
    transcript,
    interimTranscript,
    error,
    elapsedMs,
    setTranscript,
    prepareMicrophone,
    startListening,
    stopListening,
    resetTranscript,
  };
}
