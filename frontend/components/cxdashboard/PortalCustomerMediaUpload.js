import { useRef, useState } from 'react';
import { FaCamera, FaVideo } from 'react-icons/fa';
import { buildPortalApiUrl } from '../../utils/portalPreview';
import { getPortalPreviewUnlockHeaders } from '../../utils/portalPreview';
import { getPortalSessionToken } from '../../utils/portalFetch';

const ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime';
const MAX_FILES = 6;

function isVideoFile(file) {
  return (file.type || '').startsWith('video/');
}

export default function PortalCustomerMediaUpload({ workOrderId, onUploaded }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [previews, setPreviews] = useState([]);

  const clearPreviews = () => {
    setPreviews((prev) => {
      prev.forEach((p) => {
        if (p.url) URL.revokeObjectURL(p.url);
      });
      return [];
    });
  };

  const setPreviewFiles = (slice) => {
    setPreviews((prev) => {
      prev.forEach((p) => {
        if (p.url) URL.revokeObjectURL(p.url);
      });
      return slice.map((file) => ({
        file,
        url: isVideoFile(file) ? null : URL.createObjectURL(file),
        isVideo: isVideoFile(file),
      }));
    });
  };

  const onPick = () => {
    if (!uploading) inputRef.current?.click();
  };

  const onChange = async (e) => {
    const fileList = Array.from(e.target.files || []);
    if (!fileList.length || !workOrderId) return;

    const slice = fileList.slice(0, MAX_FILES);
    setPreviewFiles(slice);

    setUploading(true);
    setError(null);
    try {
      const token = await getPortalSessionToken();
      const form = new FormData();
      slice.forEach((f) => form.append('files', f));
      const url = buildPortalApiUrl(`work-orders/${workOrderId}/photos`);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          ...getPortalPreviewUnlockHeaders(),
        },
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Upload failed');
      }
      onUploaded?.();
      clearPreviews();
      e.target.value = '';
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (!workOrderId) return null;

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <p style={{ color: '#9ca3af', fontSize: '0.75rem', margin: '0 0 0.5rem' }}>
        Add photos or a short video (about 15 seconds)
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        disabled={uploading}
        onChange={onChange}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />

      <button
        type="button"
        onClick={onPick}
        disabled={uploading}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          borderRadius: '10px',
          border: '1px solid rgba(34,211,238,0.25)',
          background: 'rgba(34,211,238,0.1)',
          color: '#22d3ee',
          fontSize: '0.8125rem',
          fontWeight: 600,
          cursor: uploading ? 'wait' : 'pointer',
        }}
      >
        <FaCamera style={{ fontSize: '14px' }} />
        {uploading ? 'Uploading…' : 'Add photos or video'}
      </button>

      {previews.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
          {previews.map((item, i) => (
            <div
              key={`${item.file.name}-${i}`}
              style={{
                width: 72,
                height: 72,
                borderRadius: 8,
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {item.isVideo ? (
                <FaVideo style={{ color: '#9ca3af', fontSize: '1.25rem' }} />
              ) : (
                <img
                  src={item.url}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '0.5rem' }}>{error}</p>}
    </div>
  );
}
