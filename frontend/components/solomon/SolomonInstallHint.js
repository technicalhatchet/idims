import { useEffect, useState } from 'react';

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
  );
}

function isIos() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

const DISMISS_KEY = 'solomon_pwa_install_dismissed';

/**
 * Hint to install Solomon as a home-screen app (iOS Share sheet or Chrome install).
 */
export default function SolomonInstallHint() {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isStandaloneDisplay()) return undefined;
    if (localStorage.getItem(DISMISS_KEY)) return undefined;

    setVisible(true);

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
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

  if (!visible) return null;

  return (
    <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-4 mb-6">
      <div className="flex items-start gap-3">
        <img
          src="/solomoniosnewer.png?v=3"
          alt=""
          className="h-14 w-14 rounded-2xl shadow-lg shadow-cyan-500/20 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">Install Solomon</p>
          {isIos() ? (
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              Tap <span className="text-gray-300">Share</span> →{' '}
              <span className="text-gray-300">Add to Home Screen</span> to use your Solomon icon.
            </p>
          ) : deferredPrompt ? (
            <p className="text-xs text-gray-400 mt-1">
              Add Solomon to your home screen for full-screen diagnostics.
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-1">
              Use your browser menu to install this app, or open in Chrome for one-tap install.
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            {deferredPrompt && !isIos() ? (
              <button
                type="button"
                onClick={handleInstall}
                disabled={installing}
                className="rounded-lg bg-[#0089B9] px-3 py-1.5 text-xs font-medium disabled:opacity-60"
              >
                {installing ? 'Installing…' : 'Install app'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-gray-400"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
