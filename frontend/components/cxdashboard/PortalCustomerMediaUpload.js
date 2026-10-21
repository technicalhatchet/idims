import { useState } from 'react';
import { buildPortalApiUrl } from '../../utils/portalPreview';
import { getPortalPreviewUnlockHeaders } from '../../utils/portalPreview';
import { getPortalSessionToken } from '../../utils/portalFetch';

const ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime';

export default function PortalCustomerMediaUpload({ workOrderId, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const onChange = async (e) => {
    const fileList = Array.from(e.target.files || []);
    if (!fileList.length || !workOrderId) return;
    setUploading(true);
    setError(null);
    try {
      const token = await getPortalSessionToken();
      const form = new FormData();
      fileList.slice(0, 6).forEach((f) => form.append('files', f));
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
      <p style={{ color: '#9ca3af', fontSize: '0.75rem', margin: '0 0 0.35rem' }}>
        Add photos or a short video (about 15 seconds)
      </p>
      <input
        type="file"
        accept={ACCEPT}
        multiple
        disabled={uploading}
        onChange={onChange}
        style={{ fontSize: '0.75rem', color: '#d1d5db' }}
      />
      {uploading && <p style={{ color: '#22d3ee', fontSize: '0.75rem' }}>Uploading…</p>}
      {error && <p style={{ color: '#ef4444', fontSize: '0.75rem' }}>{error}</p>}
    </div>
  );
}
