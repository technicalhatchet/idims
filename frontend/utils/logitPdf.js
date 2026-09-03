import { getAuthHeaders } from './api-client';

export function getLogitPdfBaseUrl() {
  const rawBase = process.env.NEXT_PUBLIC_API_URL || 'https://idims-production.up.railway.app';
  return rawBase.replace(/\/api\/?$/i, '').replace(/\/$/, '');
}

/**
 * Download a LoGiT project observation report PDF.
 * @param {string} projectId
 * @param {{ includeOriginalTranscripts?: boolean, variant?: 'light'|'dark', projectName?: string }} [options]
 */
export async function downloadLogitReportPdf(projectId, options = {}) {
  const baseUrl = getLogitPdfBaseUrl();
  const qs = new URLSearchParams({
    variant: options.variant || 'light',
    include_original_transcripts: String(Boolean(options.includeOriginalTranscripts)),
  });
  const pdfUrl = `${baseUrl}/api/logit/projects/${projectId}/report.pdf?${qs.toString()}`;
  const slug = (options.projectName || 'logit-report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'logit-report';
  const downloadName = `logit-report-${slug}.pdf`;

  const request = async (forceRefresh) => {
    const headers = await getAuthHeaders({ forceRefresh, required: true });
    return fetch(pdfUrl, { headers, credentials: 'include' });
  };

  let res = await request(false);
  if (res.status === 401) {
    res = await request(true);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail || res.statusText;
    throw new Error(typeof detail === 'string' ? detail : 'PDF request failed');
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    window.open(blobUrl, '_blank');
  }
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
}
