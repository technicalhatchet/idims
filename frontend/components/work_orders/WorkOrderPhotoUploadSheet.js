import { useEffect, useRef, useState } from 'react';
import { FaCamera, FaImages, FaTimes } from 'react-icons/fa';
import { uploadWorkOrderPhoto } from '../../services/api/workOrderPhotosApi';

export const MODEL_SN_TAG_LABEL = 'Model SN tag';

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

  const [step, setStep] = useState('pick');
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [description, setDescription] = useState('');
  const [isModelSnTag, setIsModelSnTag] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

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
  };

  useEffect(() => {
    if (!open) {
      reset();
      return undefined;
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  if (!open) return null;

  const handleFileSelected = (selected) => {
    if (!selected || !selected.type.startsWith('image/')) {
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

  const shellClass = isMobile
    ? 'bg-[#0D1525] border border-cyan-500/20'
    : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700';

  const inputClass = isMobile
    ? 'w-full rounded-lg border border-cyan-500/20 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500'
    : 'w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm';

  return (
    <div className="fixed inset-0 z-[9998] flex flex-col justify-end md:justify-center md:items-center">
      <button
        type="button"
        aria-label="Close photo upload"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div
        className={`relative z-10 w-full max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden ${shellClass}`}
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <div className={`flex items-center justify-between px-4 py-3 border-b ${isMobile ? 'border-cyan-500/15' : 'border-gray-200 dark:border-gray-700'}`}>
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

        <div className="px-4 py-4 space-y-4">
          {error && <p className="text-sm text-red-400">{error}</p>}

          {step === 'pick' && (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
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
                onClick={() => galleryInputRef.current?.click()}
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
            <form onSubmit={handleSubmit} className="space-y-4">
              {previewUrl && (
                <div className="rounded-xl overflow-hidden border border-white/10 bg-black/30">
                  <img src={previewUrl} alt="Preview" className="w-full max-h-56 object-contain" />
                </div>
              )}
              <div>
                <label className={`block text-xs mb-1 ${isMobile ? 'text-gray-400' : 'text-gray-500'}`}>
                  Brief description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this photo show?"
                  className={inputClass}
                  maxLength={500}
                />
              </div>
              <label className={`flex items-center gap-2 text-sm cursor-pointer ${isMobile ? 'text-gray-300' : 'text-gray-700 dark:text-gray-200'}`}>
                <input
                  type="checkbox"
                  checked={isModelSnTag}
                  onChange={(e) => handleModelSnTagChange(e.target.checked)}
                  className="rounded border-gray-500"
                />
                {MODEL_SN_TAG_LABEL}
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep('pick');
                    setFile(null);
                    if (previewUrlRef.current) {
                      URL.revokeObjectURL(previewUrlRef.current);
                      previewUrlRef.current = null;
                    }
                    setPreviewUrl(null);
                  }}
                  className={`flex-1 h-10 rounded-xl border text-xs font-semibold uppercase tracking-wide ${
                    isMobile ? 'border-white/15 text-gray-300' : 'border-gray-300 text-gray-700'
                  }`}
                >
                  Retake
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-cyan-700 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save photo'}
                </button>
              </div>
            </form>
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
          />
        </div>
      </div>
    </div>
  );
}
