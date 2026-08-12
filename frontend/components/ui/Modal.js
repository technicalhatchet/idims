import { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes } from 'react-icons/fa';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  actions,
  size = 'md',
  preventClose = false,
  /** 'default' = bottom sheet on mobile; 'center' = vertically centered on all breakpoints */
  placement = 'default',
  /** When true, modal body does not scroll — children manage their own scroll regions */
  containScroll = false,
}) {
  const cancelButtonRef = useRef(null);

  const sizeClasses = {
    sm: 'max-w-lg',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-full max-h-full',
  };

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const isCentered = placement === 'center';
  const shellAlign = isCentered
    ? 'items-center justify-center p-4 sm:p-6'
    : 'items-end sm:items-center justify-center p-0 sm:p-6';

  return createPortal(
    <div className={`fixed inset-0 z-[9999] flex ${shellAlign} touch-manipulation`}>
      <div
        className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity touch-none"
        onClick={preventClose ? () => {} : onClose}
        aria-hidden="true"
      />

      <div
        className={`relative z-[1] w-full ${sizeClasses[size]} bg-white dark:bg-gray-800 text-left overflow-hidden shadow-xl max-h-[min(90vh,640px)] flex flex-col ${
          isCentered ? 'rounded-2xl sm:rounded-lg' : 'rounded-t-2xl sm:rounded-lg'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {title && (
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700 sm:px-6 flex justify-between items-center">
            <h3
              id="modal-title"
              className="text-lg leading-6 font-medium text-gray-900 dark:text-white pr-2"
            >
              {title}
            </h3>
            {!preventClose && (
              <button
                type="button"
                className="touch-target inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300 shrink-0"
                onClick={onClose}
                ref={cancelButtonRef}
                aria-label="Close"
              >
                <FaTimes className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        <div
          className={`bg-white dark:bg-gray-800 px-4 py-5 sm:p-6 text-gray-900 dark:text-gray-200 flex-1 min-h-0 ${
            containScroll ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain'
          }`}
        >
          {children}
        </div>

        {actions && (
          <div className="shrink-0 bg-gray-50 dark:bg-gray-900 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-200 dark:border-gray-700">
            {actions}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
