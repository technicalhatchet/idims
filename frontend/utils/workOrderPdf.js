import { getAuthHeaders } from './api-client';

export function getWorkOrderPdfBaseUrl() {
  const rawBase = process.env.NEXT_PUBLIC_API_URL || 'https://idims-production.up.railway.app';
  return rawBase.replace(/\/api\/?$/i, '').replace(/\/$/, '');
}

/**
 * Fetch a work-order PDF with auth and open or download it.
 * @param {string} workOrderId
 * @param {string} orderNumber
 * @param {string} endpoint - e.g. "invoice-v2.pdf"
 * @param {Record<string, string>} [queryParams] - variant, show_payments, show_payment_message, show_technician, etc.
 */
export async function openWorkOrderPdf(workOrderId, orderNumber, endpoint, queryParams = {}) {
  const headers = await getAuthHeaders();
  const baseUrl = getWorkOrderPdfBaseUrl();
  const qs = new URLSearchParams({
    variant: queryParams.variant || 'light',
    ...queryParams,
  });
  const pdfUrl = `${baseUrl}/api/work-orders/${workOrderId}/${endpoint}?${qs.toString()}`;
  const res = await fetch(pdfUrl, { headers, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail || res.statusText;
    throw new Error(typeof detail === 'string' ? detail : 'PDF request failed');
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const fileStem = endpoint.replace('.pdf', '');
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobile) {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${fileStem}-${orderNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    window.open(blobUrl, '_blank');
  }
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
}

function buildDocumentQueryParams({
  docType = 'invoice',
  variant = 'light',
  showPayments = true,
  showPaymentMessage = true,
  showTechnician = true,
} = {}) {
  return {
    doc_type: docType,
    variant,
    show_payments: String(showPayments),
    show_payment_message: String(showPaymentMessage),
    show_technician: String(showTechnician),
  };
}

/**
 * Email a work-order invoice or estimate PDF v2 to the client.
 */
export async function emailWorkOrderDocument(workOrderId, options = {}) {
  const headers = await getAuthHeaders();
  const baseUrl = getWorkOrderPdfBaseUrl();
  const qs = new URLSearchParams(buildDocumentQueryParams(options));
  const url = `${baseUrl}/api/work-orders/${workOrderId}/email-document-v2?${qs.toString()}`;
  const res = await fetch(url, { method: 'POST', headers, credentials: 'include' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail || res.statusText;
    throw new Error(typeof detail === 'string' ? detail : 'Email request failed');
  }
  return data;
}

export const WORK_ORDER_PDF_ACTIONS = [
  { id: 'estimate', label: 'Estimate', endpoint: 'estimate.pdf', mobileLabel: 'Estimate' },
  {
    id: 'estimate-v2',
    label: 'Estimate v2',
    endpoint: 'estimate-v2.pdf',
    mobileLabel: 'Est v2',
    queryParams: { show_payments: 'true' },
    test: true,
  },
  { id: 'invoice', label: 'Invoice', endpoint: 'invoice.pdf', mobileLabel: 'Invoice' },
  {
    id: 'invoice-v2',
    label: 'Invoice v2',
    endpoint: 'invoice-v2.pdf',
    mobileLabel: 'Inv v2',
    queryParams: { show_payments: 'true' },
    test: true,
  },
];
