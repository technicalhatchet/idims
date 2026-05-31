import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaCamera, FaImages, FaTimes } from 'react-icons/fa';
import { uploadWorkOrderPhoto } from '../../services/api/workOrderPhotosApi';

export const MODEL_SN_TAG_LABEL = 'Model SN tag';

function isImageFile(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name || '');
}

export default function WorkOrderPhotoUploadSheet({
  open,
  onClose,
  workOrderId,
  onSuccess,
  variant = 'mobile',
}) {
  const isMobile = variant === 'mobile';
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const previewUrlRef = useRef(null);
  const pickingRef = useRef(false);

  const [step, setStep] = useState('pick');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [description, setDescription] = useState('');
  const [isModelSnTag, setIsModelSnTag] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const reset = () => {
    setStep('pick');
    setFile(null);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
    setDescription('');
    setIsModelSnTag(false);
    setError(null);
    setSaving(false);
    pickingRef.current = false;
  };

  useEffect(() => {
    if (!open) {
      if (!pickingRef.current) {
        reset();
      }
      return undefined;
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const handleFileSelected = (selected) => {
    pickingRef.current = false;
    if (!selected || !isImageFile(selected)) {
      setError('Please choose an image file.');
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(selected);
    previewUrlRef.current = url;
    setFile(selected);
    setPreviewUrl(url);
    setStep('details');
    setError(null);
  };

  const openPicker = (inputRef) => {
    pickingRef.current = true;
    inputRef.current?.click();
  };

  const handleModelSnTagChange = (checked) => {
    setIsModelSnTag(checked);
    if (checked) {
      setDescription(MODEL_SN_TAG_LABEL);
    } else if (description === MODEL_SN_TAG_LABEL) {
      setDescription('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !workOrderId) return;
    setSaving(true);
    setError(null);
    try {
      await uploadWorkOrderPhoto(workOrderId, file, {
        description: description.trim() || undefined,
        isModelSnTag,
      });
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message || 'Photo upload failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRetake = () => {
    setStep('pick');
    setFile(null);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
    setDescription('');
    setIsModelSnTag(false);
    setError(null);
  };

  if (!open || !mounted) return null;

  const inputClass = isMobile
    ? 'w-full rounded-lg border border-cyan-500/30 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-gray-500'
    : 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm';

  const panelClass = isMobile
    ? 'w-full max-w-lg rounded-t-2xl border border-cyan-500/20 bg-[#0D1525] shadow-2xl flex flex-col max-h-[92vh]'
    : 'w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl flex flex-col max-h-[90vh]';

  const content = (
    <div
      className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={panelClass}
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: isMobile ? 'max(12px, env(safe-area-inset-bottom))' : undefined }}
      >
        <div className={`flex shrink-0 items-center justify-between px-4 py-3 border-b ${isMobile ? 'border-cyan-500/15' : 'border-gray-200 dark:border-gray-700'}`}>
          <h3 className={`text-sm font-semibold ${isMobile ? 'text-cyan-300' : 'text-gray-900 dark:text-white'}`}>
            {step === 'pick' ? 'Add photo' : 'Photo details'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-lg ${isMobile ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            aria-label="Close"
          >
            <FaTimes />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
          {error && <p className="text-sm text-red-400">{error}</p>}

          {step === 'pick' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => openPicker(cameraInputRef)}
                className={`flex flex-col items-center gap-2 rounded-xl border px-4 py-6 transition active:scale-[0.98] ${
                  isMobile
                    ? 'border-cyan-500/30 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-950/50'
                    : 'border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100'
                }`}
              >
                <FaCamera className="h-6 w-6" />
                <span className="text-xs font-semibold uppercase tracking-wide">Camera</span>
              </button>
              <button
                type="button"
                onClick={() => openPicker(galleryInputRef)}
                className={`flex flex-col items-center gap-2 rounded-xl border px-4 py-6 transition active:scale-[0.98] ${
                  isMobile
                    ? 'border-cyan-500/30 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-950/50'
                    : 'border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100'
                }`}
              >
                <FaImages className="h-6 w-6" />
                <span className="text-xs font-semibold uppercase tracking-wide">Photos</span>
              </button>
            </div>
          )}

          {step === 'details' && (
            <>
              {previewUrl && (
                <div className="rounded-xl overflow-hidden border border-white/10 bg-black/30">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full max-h-40 sm:max-h-52 object-contain mx-auto"
                  />
                </div>
              )}
              <div>
                <label
                  htmlFor="wo-photo-description"
                  className={`block text-xs font-medium mb-1.5 ${isMobile ? 'text-gray-300' : 'text-gray-600 dark:text-gray-400'}`}
                >
                  Brief description
                </label>
                <input
                  id="wo-photo-description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this photo show?"
                  className={inputClass}
                  maxLength={500}
                  autoComplete="off"
                />
              </div>
              <label className={`flex items-center gap-2.5 text-sm cursor-pointer select-none ${isMobile ? 'text-gray-200' : 'text-gray-700 dark:text-gray-200'}`}>
                <input
                  type="checkbox"
                  checked={isModelSnTag}
                  onChange={(e) => handleModelSnTagChange(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-500 accent-cyan-500"
                />
                {MODEL_SN_TAG_LABEL}
              </label>
            </>
          )}
        </div>

        {step === 'details' && (
          <div
            className={`shrink-0 px-4 pt-2 pb-3 border-t flex gap-2 ${isMobile ? 'border-cyan-500/15 bg-[#0B1120]/80' : 'border-gray-200 dark:border-gray-700'}`}
          >
            <button
              type="button"
              onClick={handleRetake}
              className={`flex-1 h-11 rounded-xl border text-xs font-semibold uppercase tracking-wide ${
                isMobile ? 'border-white/20 text-gray-200' : 'border-gray-300 text-gray-700'
              }`}
            >
              Retake
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSubmit}
              className="flex-1 h-11 rounded-xl bg-gradient-to-br from-cyan-600 to-cyan-700 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50 shadow-[0_0_16px_rgba(34,211,238,0.25)]"
            >
              {saving ? 'Saving…' : 'Save photo'}
            </button>
          </div>
        )}

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFileSelected(e.target.files?.[0]);
            e.target.value = '';
          }}
          onCancel={() => {
            pickingRef.current = false;
          }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFileSelected(e.target.files?.[0]);
            e.target.value = '';
          }}
          onCancel={() => {
            pickingRef.current = false;
          }}
        />
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
