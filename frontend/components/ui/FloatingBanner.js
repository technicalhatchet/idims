import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaCheckCircle, FaExclamationCircle, FaTimes } from 'react-icons/fa';

const VARIANT_STYLES = {
  error: {
    container: 'bg-red-50 dark:bg-red-900/90 border-red-200 dark:border-red-700',
    icon: 'text-red-400 dark:text-red-300',
    text: 'text-red-800 dark:text-red-200',
    dismiss: 'text-red-500 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/50',
  },
  success: {
    container: 'bg-green-50 dark:bg-green-900/90 border-green-200 dark:border-green-700',
    icon: 'text-green-400 dark:text-green-300',
    text: 'text-green-800 dark:text-green-200',
    dismiss: 'text-green-500 hover:bg-green-100 dark:text-green-300 dark:hover:bg-green-900/50',
  },
  warning: {
    container: 'bg-amber-50 dark:bg-amber-900/90 border-amber-200 dark:border-amber-700',
    icon: 'text-amber-400 dark:text-amber-300',
    text: 'text-amber-800 dark:text-amber-200',
    dismiss: 'text-amber-500 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/50',
  },
};

const VARIANT_ICONS = {
  error: FaExclamationCircle,
  success: FaCheckCircle,
  warning: FaExclamationCircle,
};

export default function FloatingBanner({
  message,
  variant = 'error',
  onDismiss,
  autoDismissMs = null,
}) {
  useEffect(() => {
    if (!message || !autoDismissMs || !onDismiss) return undefined;

    const timer = window.setTimeout(onDismiss, autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [message, autoDismissMs, onDismiss]);

  if (!message || typeof document === 'undefined') return null;

  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.error;
  const Icon = VARIANT_ICONS[variant] || FaExclamationCircle;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[10050] flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]"
      role="alert"
      aria-live="assertive"
    >
      <div
        className={`pointer-events-auto w-full max-w-lg rounded-lg border p-4 shadow-lg backdrop-blur-sm ${styles.container}`}
      >
        <div className="flex items-start gap-3">
          <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${styles.icon}`} aria-hidden />
          <p className={`flex-1 text-sm font-medium ${styles.text}`}>{message}</p>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${styles.dismiss}`}
              aria-label="Dismiss"
            >
              <FaTimes className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
