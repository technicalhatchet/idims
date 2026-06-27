const BACKEND = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000';

/** Portal documents: full v2 layout (no line presets / toggles exposed to clients). */
export async function getPortalAccessToken() {
  const sessionRes = await fetch('/api/auth/session');
  const session = await sessionRes.json();
  return session.accessToken;
}

export function getPortalImpersonateId() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('portal_impersonate_client_id');
}

async function fetchPortalDocumentPdfBlob(workOrderId, docType, variant = 'light') {
  const token = await getPortalAccessToken();
  const impersonateId = getPortalImpersonateId();
  const params = new URLSearchParams();
  params.set('variant', variant);
  if (impersonateId) params.set('admin_client_id', impersonateId);
  const endpoint = docType === 'estimate' ? 'estimate.pdf' : 'invoice.pdf';
  const url = `${BACKEND}/api/portal/work-orders/${workOrderId}/${endpoint}?${params.toString()}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || 'Failed to generate PDF');
  }
  return res.blob();
}

export async function fetchPortalInvoicePdfBlob(workOrderId, variant = 'light') {
  return fetchPortalDocumentPdfBlob(workOrderId, 'invoice', variant);
}

export async function fetchPortalEstimatePdfBlob(workOrderId, variant = 'light') {
  return fetchPortalDocumentPdfBlob(workOrderId, 'estimate', variant);
}

/** Chrome/Edge hide built-in PDF toolbar via fragment flags. */
export function pdfViewerSrc(blobUrl) {
  return `${blobUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;
}

export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function emailPortalInvoice(workOrderId) {
  return emailPortalDocument(workOrderId, 'invoice');
}

export async function emailPortalEstimate(workOrderId) {
  return emailPortalDocument(workOrderId, 'estimate');
}

async function emailPortalDocument(workOrderId, docType) {
  const token = await getPortalAccessToken();
  const impersonateId = getPortalImpersonateId();
  const params = new URLSearchParams();
  if (impersonateId) params.set('admin_client_id', impersonateId);
  const qs = params.toString();
  const endpoint = docType === 'estimate' ? 'email-estimate' : 'email-invoice';
  const url = `${BACKEND}/api/portal/work-orders/${workOrderId}/${endpoint}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to send email');
  return data;
}

export async function printPortalInvoicePdf(workOrderId) {
  return printPortalDocumentPdf(workOrderId, 'invoice');
}

export async function printPortalEstimatePdf(workOrderId) {
  return printPortalDocumentPdf(workOrderId, 'estimate');
}

async function printPortalDocumentPdf(workOrderId, docType) {
  const fetchBlob = docType === 'estimate' ? fetchPortalEstimatePdfBlob : fetchPortalInvoicePdfBlob;
  const blob = await fetchBlob(workOrderId, 'light');
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  iframe.src = pdfViewerSrc(url);
  document.body.appendChild(iframe);
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 1500);
    }
  };
}
