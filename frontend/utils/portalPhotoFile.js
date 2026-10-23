import { buildPortalDirectApiUrl, getPortalPreviewUnlockHeaders } from './portalPreview';

/**
 * Fetch work-order photo bytes from Railway (not the JSON proxy).
 * @param {string} workOrderId
 * @param {string} photoId
 * @param {string} accessToken
 * @param {{ thumbnail?: number }} [options]
 */
export async function fetchPortalWorkOrderPhotoBlob(
  workOrderId,
  photoId,
  accessToken,
  { thumbnail = 0 } = {},
) {
  const params = thumbnail > 0 ? `?thumbnail=${thumbnail}` : '';
  const url = buildPortalDirectApiUrl(
    `work-orders/${workOrderId}/photos/${photoId}/file${params}`,
  );
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...getPortalPreviewUnlockHeaders(),
    },
  });
  if (!res.ok) {
    let detail = 'Could not load media';
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === 'string' ? detail : detail);
  }
  const blob = await res.blob();
  return {
    blobUrl: URL.createObjectURL(blob),
    mimeType: blob.type || res.headers.get('content-type') || '',
  };
}
