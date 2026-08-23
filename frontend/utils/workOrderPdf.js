import { getAuthHeaders } from './api-client';

export function getWorkOrderPdfBaseUrl() {
  const rawBase = process.env.NEXT_PUBLIC_API_URL || 'https://idims-production.up.railway.app';
  return rawBase.replace(/\/api\/?$/i, '').replace(/\/$/, '');
}

async function fetchAuthorizedPdf(pdfUrl, downloadName) {
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

/**
 * Fetch a work-order PDF with auth and open or download it.
 * @param {string} workOrderId
 * @param {string} orderNumber
 * @param {string} endpoint - e.g. "invoice-v2.pdf"
 * @param {Record<string, string>} [queryParams] - variant, show_payments, show_payment_message, show_technician, etc.
 */
export async function openWorkOrderPdf(workOrderId, orderNumber, endpoint, queryParams = {}) {
  const baseUrl = getWorkOrderPdfBaseUrl();
  const qs = new URLSearchParams({
    variant: queryParams.variant || 'light',
    ...queryParams,
  });
  const pdfUrl = `${baseUrl}/api/work-orders/${workOrderId}/${endpoint}?${qs.toString()}`;
  const fileStem = endpoint.replace('.pdf', '');
  return fetchAuthorizedPdf(pdfUrl, `${fileStem}-${orderNumber}.pdf`);
}

/**
 * Open a diagnostic report PDF v2 for a work order.
 */
export async function openDiagnosticPdf(workOrderId, orderNumber, options = {}) {
  const queryParams = {
    variant: options.variant || 'light',
    show_technician: String(options.showTechnician !== false),
    show_photos: String(Boolean(options.showPhotos)),
  };
  if (options.noteId) {
    queryParams.note_id = String(options.noteId);
  }
  return openWorkOrderPdf(workOrderId, orderNumber, 'diagnostic-v2.pdf', queryParams);
}

/**
 * Open a diagnostic PDF for a standalone Solomon diagnostic.
 */
export async function openStandaloneDiagnosticPdf(diagnosticId, options = {}) {
  const baseUrl = getWorkOrderPdfBaseUrl();
  const qs = new URLSearchParams({
    variant: options.variant || 'light',
    show_technician: String(options.showTechnician !== false),
  });
  const pdfUrl = `${baseUrl}/api/dma/diagnostics/${diagnosticId}/diagnostic-v2.pdf?${qs.toString()}`;
  const shortId = String(diagnosticId).replace(/-/g, '').slice(0, 8);
  return fetchAuthorizedPdf(pdfUrl, `diagnostic-sol-${shortId}.pdf`);
}

export const DOCUMENT_LINE_PRESETS = [
  {
    id: 'diagnostic',
    label: 'Diagnostic',
    description: 'Trip charge and diagnostic services only',
  },
  {
    id: 'repair',
    label: 'Repair',
    description: 'Repair services and parts (no trip charge)',
  },
  {
    id: 'full',
    label: 'Full',
    description: 'All services and parts for this estimate (including quoted lines)',
  },
];

function buildDocumentQueryParams({
  docType = 'invoice',
  variant = 'light',
  showPayments = true,
  showPaymentMessage = true,
  showTechnician = true,
  showNotes = false,
  linePreset = 'full',
} = {}) {
  const preset = docType === 'invoice' ? 'full' : linePreset;
  return {
    doc_type: docType,
    variant,
    line_preset: preset,
    show_payments: String(showPayments),
    show_payment_message: String(showPaymentMessage),
    show_technician: String(showTechnician),
    show_notes: String(showNotes),
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
