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
  preventClose = false
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

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
        onClick={preventClose ? () => {} : onClose}
        aria-hidden="true"
      />

      <div
        className={`relative z-[1] w-full ${sizeClasses[size]} bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {title && (
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700 sm:px-6 flex justify-between items-center">
            <h3
              id="modal-title"
              className="text-lg leading-6 font-medium text-gray-900 dark:text-white"
            >
              {title}
            </h3>
            {!preventClose && (
              <button
                type="button"
                className="text-gray-400 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300"
                onClick={onClose}
                ref={cancelButtonRef}
                aria-label="Close"
              >
                <FaTimes />
              </button>
            )}
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:p-6 text-gray-900 dark:text-gray-200">
          {children}
        </div>

        {actions && (
          <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-200 dark:border-gray-700">
            {actions}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
