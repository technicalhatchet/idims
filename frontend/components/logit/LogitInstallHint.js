import { useEffect, useState } from 'react';
import { LOGIT_GLASS_CARD } from './logitUi';
import {
  isIosDevice,
  isLogitStandalone,
  logitPwaIconSrc,
} from './logitPwaIcons';

const DISMISS_KEY = 'logit_pwa_install_dismissed';

export function useLogitInstallHint() {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isLogitStandalone()) return undefined;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return undefined;
    } catch {
      // ignore
    }

    setVisible(true);

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
    setVisible(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      dismiss();
    } finally {
      setInstalling(false);
    }
  };

  return {
    visible,
    deferredPrompt,
    installing,
    dismiss,
    handleInstall,
  };
}

export default function LogitInstallHint({ installHint }) {
  const {
    visible,
    deferredPrompt,
    installing,
    dismiss,
    handleInstall,
  } = installHint;

  if (!visible) return null;

  return (
    <div className={`mb-6 p-4 border border-cyan-500/25 bg-cyan-500/10 ${LOGIT_GLASS_CARD}`}>
      <div className="flex items-start gap-3">
        <img
          src={logitPwaIconSrc()}
          alt=""
          className="h-14 w-14 rounded-2xl shadow-lg shadow-cyan-500/20 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Install LoGiT</p>
          {isIosDevice() ? (
            <p className="text-xs text-white/50 mt-1 leading-relaxed">
              In Safari, tap <span className="text-white/70">Share</span>
              {' → '}
              <span className="text-white/70">Add to Home Screen</span>
              . Open LoGiT from that icon so it appears in
              {' '}
              <span className="text-white/70">Settings → LoGiT</span>
              {' '}
              with its own microphone permission.
            </p>
          ) : deferredPrompt ? (
            <p className="text-xs text-white/50 mt-1">
              Add LoGiT to your home screen for full-screen capture and persistent permissions.
            </p>
          ) : (
            <p className="text-xs text-white/50 mt-1">
              Use your browser menu to install this app, or open in Chrome for one-tap install.
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            {deferredPrompt && !isIosDevice() ? (
              <button
                type="button"
                onClick={() => { void handleInstall(); }}
                disabled={installing}
                className="rounded-lg bg-cyan-500/90 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60 min-h-[36px]"
              >
                {installing ? 'Installing…' : 'Install app'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/50 min-h-[36px]"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
