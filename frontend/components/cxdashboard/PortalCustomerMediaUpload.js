import { useCallback, useEffect, useRef, useState } from 'react';
import { FaCamera, FaTimes, FaVideo } from 'react-icons/fa';
import { buildPortalDirectApiUrl, getPortalPreviewUnlockHeaders } from '../../utils/portalPreview';
import { getPortalSessionToken, portalFetch } from '../../utils/portalFetch';

const ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime';
const MAX_FILES = 6;
const LIMIT_MESSAGE = 'You can add up to 6 photos or videos per repair';

function isVideoFile(fileOrMime) {
  const mime = typeof fileOrMime === 'string' ? fileOrMime : (fileOrMime?.type || '');
  return mime.startsWith('video/');
}

export default function PortalCustomerMediaUpload({ workOrderId, onUploaded }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState(null);
  const [previews, setPreviews] = useState([]);
  const [customerItems, setCustomerItems] = useState([]);
  const [usedCount, setUsedCount] = useState(0);

  const loadMedia = useCallback(async () => {
    if (!workOrderId) return;
    try {
      const token = await getPortalSessionToken();
      const data = await portalFetch(`work-orders/${workOrderId}/photos`, token);
      const items = (data?.items || []).filter((p) => p.source === 'customer');
      setCustomerItems(items);
      setUsedCount(
        typeof data?.customer_media_count === 'number' ? data.customer_media_count : items.length,
      );
    } catch {
      /* non-fatal */
    }
  }, [workOrderId]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

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
    if (!uploading && usedCount < MAX_FILES) inputRef.current?.click();
  };

  const onChange = async (e) => {
    const fileList = Array.from(e.target.files || []);
    if (!fileList.length || !workOrderId) return;

    const remaining = MAX_FILES - usedCount;
    if (remaining <= 0) {
      setError(LIMIT_MESSAGE);
      e.target.value = '';
      return;
    }

    const slice = fileList.slice(0, Math.min(remaining, MAX_FILES));
    setPreviewFiles(slice);

    setUploading(true);
    setError(null);
    try {
      const token = await getPortalSessionToken();
      const form = new FormData();
      slice.forEach((f) => form.append('files', f));
      const url = buildPortalDirectApiUrl(`work-orders/${workOrderId}/photos`);
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
      await loadMedia();
      clearPreviews();
      e.target.value = '';
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onRemove = async (photoId) => {
    if (!workOrderId || removingId) return;
    setRemovingId(photoId);
    setError(null);
    try {
      const token = await getPortalSessionToken();
      const url = buildPortalDirectApiUrl(`work-orders/${workOrderId}/photos/${photoId}`);
      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          ...getPortalPreviewUnlockHeaders(),
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Could not remove file');
      }
      await loadMedia();
      onUploaded?.();
    } catch (err) {
      setError(err.message || 'Could not remove file');
    } finally {
      setRemovingId(null);
    }
  };

  if (!workOrderId) return null;

  const atLimit = usedCount >= MAX_FILES;

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <p style={{ color: '#9ca3af', fontSize: '0.75rem', margin: '0 0 0.5rem' }}>
        {LIMIT_MESSAGE}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        disabled={uploading || atLimit}
        onChange={onChange}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />

      <button
        type="button"
        onClick={onPick}
        disabled={uploading || atLimit}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          borderRadius: '10px',
          border: '1px solid rgba(34,211,238,0.25)',
          background: 'rgba(34,211,238,0.1)',
          color: atLimit ? '#6b7280' : '#22d3ee',
          fontSize: '0.8125rem',
          fontWeight: 600,
          cursor: uploading || atLimit ? 'not-allowed' : 'pointer',
        }}
      >
        <FaCamera style={{ fontSize: '14px' }} />
        {uploading ? 'Uploading…' : 'Add photos or video'}
      </button>

      <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '0.5rem 0 0' }}>
        {usedCount} of {MAX_FILES} used
      </p>

      {(customerItems.length > 0 || previews.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
          {customerItems.map((item) => (
            <div
              key={item.id}
              style={{
                position: 'relative',
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
              {isVideoFile(item.mime_type) ? (
                <FaVideo style={{ color: '#9ca3af', fontSize: '1.25rem' }} />
              ) : item.drive_web_view_link ? (
                <img
                  src={item.drive_web_view_link}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <FaCamera style={{ color: '#9ca3af', fontSize: '1.25rem' }} />
              )}
              <button
                type="button"
                aria-label="Remove"
                disabled={removingId === item.id}
                onClick={() => onRemove(item.id)}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  border: 'none',
                  background: 'rgba(0,0,0,0.65)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: removingId === item.id ? 'wait' : 'pointer',
                  padding: 0,
                }}
              >
                <FaTimes style={{ fontSize: '10px' }} />
              </button>
            </div>
          ))}
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
                opacity: 0.7,
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
