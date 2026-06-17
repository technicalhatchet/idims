const BACKEND = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000';

export async function getPortalAccessToken() {
  const sessionRes = await fetch('/api/auth/session');
  const session = await sessionRes.json();
  return session.accessToken;
}

export function getPortalImpersonateId() {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('portal_impersonate_client_id');
}

export async function fetchPortalInvoicePdfBlob(workOrderId, variant = 'light') {
  const token = await getPortalAccessToken();
  const impersonateId = getPortalImpersonateId();
  const params = new URLSearchParams();
  params.set('variant', variant);
  if (impersonateId) params.set('admin_client_id', impersonateId);
  const url = `${BACKEND}/api/portal/work-orders/${workOrderId}/invoice.pdf?${params.toString()}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Failed to generate PDF');
  return res.blob();
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
  const token = await getPortalAccessToken();
  const impersonateId = getPortalImpersonateId();
  const params = new URLSearchParams();
  if (impersonateId) params.set('admin_client_id', impersonateId);
  const qs = params.toString();
  const url = `${BACKEND}/api/portal/work-orders/${workOrderId}/email-invoice${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'Failed to send email');
  return data;
}

export async function printPortalInvoicePdf(workOrderId) {
  const blob = await fetchPortalInvoicePdfBlob(workOrderId, 'light');
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
