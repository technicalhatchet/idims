import { useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';

export default function ReceiptViewerModal({
  open,
  onClose,
  filename,
  blobUrl,
  mimeType,
  driveLink,
  loading,
  error,
  isMobile = false,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isPdf = mimeType?.includes('pdf');
  const isImage = mimeType?.startsWith('image/');

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col">
      <button
        type="button"
        aria-label="Close receipt viewer"
        className="absolute inset-0 bg-black/85"
        onClick={onClose}
      />
      <div className="relative z-10 flex flex-col max-h-full min-h-0 m-auto w-full max-w-4xl p-3 pointer-events-none">
        <div
          className={`pointer-events-auto flex flex-col max-h-[92vh] rounded-xl overflow-hidden shadow-2xl ${
            isMobile ? 'bg-[#0D1525] border border-cyan-500/20' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700'
          }`}
        >
          <div className={`flex items-center justify-between gap-2 px-3 py-2 border-b ${isMobile ? 'border-cyan-500/15' : 'border-gray-200 dark:border-gray-700'}`}>
            <p className={`text-xs truncate ${isMobile ? 'text-gray-300' : 'text-gray-700 dark:text-gray-200'}`}>
              {filename || 'Receipt'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-lg shrink-0 ${isMobile ? 'text-cyan-300 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              aria-label="Close"
            >
              <FaTimes />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-2 bg-black/40">
            {loading && <p className="text-sm text-gray-300 p-8">Loading receipt…</p>}
            {error && !loading && <p className="text-sm text-red-400 p-8 text-center">{error}</p>}
            {!loading && !error && blobUrl && isImage && (
              <img
                src={blobUrl}
                alt={filename || 'Receipt'}
                className="max-w-full max-h-[75vh] object-contain rounded"
              />
            )}
            {!loading && !error && blobUrl && isPdf && (
              <iframe
                title={filename || 'Receipt PDF'}
                src={blobUrl}
                className="w-full h-[75vh] rounded bg-white"
              />
            )}
            {!loading && !error && blobUrl && !isImage && !isPdf && (
              <p className="text-sm text-gray-300 p-6 text-center">
                Preview not available for this file type.
              </p>
            )}
          </div>

          {driveLink && !loading && (
            <div className={`px-3 py-2 border-t text-center ${isMobile ? 'border-cyan-500/15' : 'border-gray-200 dark:border-gray-700'}`}>
              <a
                href={driveLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-cyan-400 hover:underline"
              >
                Open in Google Drive
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
