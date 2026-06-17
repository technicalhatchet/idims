import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  FaTimes, FaExternalLinkAlt, FaDownload, FaPrint, FaChevronDown, FaEnvelope,
} from 'react-icons/fa';
import {
  fetchPortalInvoicePdfBlob,
  pdfViewerSrc,
  printPortalInvoicePdf,
  triggerBlobDownload,
  emailPortalInvoice,
} from '../../utils/portalInvoicePdf';

const ZOOM_OPTIONS = [75, 100, 125, 150];

const toolbarBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  background: 'rgba(255,255,255,0.06)',
  color: '#d1d5db',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '6px',
  padding: '6px 10px',
  fontSize: '0.8125rem',
  fontWeight: '600',
  cursor: 'pointer',
};

const accentBtn = {
  ...toolbarBtn,
  background: 'rgba(0,212,255,0.1)',
  color: '#22d3ee',
  border: '1px solid rgba(0,212,255,0.2)',
};

export default function InvoicePdfModal({ invoice, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(100);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);

  useEffect(() => {
    let revoked = false;
    let url = null;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const blob = await fetchPortalInvoicePdfBlob(invoice.id, 'dark');
        url = URL.createObjectURL(blob);
        if (!revoked) setBlobUrl(url);
      } catch (e) {
        if (!revoked) setError(`Failed to load invoice: ${e.message}`);
      } finally {
        if (!revoked) setLoading(false);
      }
    }

    load();
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [invoice?.id]);

  function handleClose() {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    onClose();
  }

  async function handleDownload(variant) {
    setDownloadOpen(false);
    setBusy(true);
    try {
      const blob = await fetchPortalInvoicePdfBlob(invoice.id, variant);
      triggerBlobDownload(blob, `invoice-${invoice.order_number}-${variant}.pdf`);
    } catch (e) {
      alert(`Download failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleEmail() {
    setEmailStatus(null);
    setBusy(true);
    try {
      const result = await emailPortalInvoice(invoice.id);
      setEmailStatus({ ok: true, message: result.message || 'Invoice sent.' });
    } catch (e) {
      setEmailStatus({ ok: false, message: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function handlePrint() {
    setBusy(true);
    try {
      await printPortalInvoicePdf(invoice.id);
    } catch (e) {
      alert(`Print failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px',
          width: '100%', maxWidth: '920px', height: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
          padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, flexWrap: 'wrap',
        }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ color: '#fff', fontWeight: '700', margin: 0, fontSize: '0.9375rem' }}>
              Invoice #{invoice?.order_number}
            </p>
            <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '2px 0 0' }}>
              {invoice?.created_at ? format(parseISO(invoice.created_at), 'MMM d, yyyy') : ''}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', ...toolbarBtn, padding: '6px 8px' }}>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Zoom</span>
              <select
                value={zoom}
                onChange={e => setZoom(Number(e.target.value))}
                style={{
                  background: 'transparent', border: 'none', color: '#e5e7eb',
                  fontSize: '0.8125rem', fontWeight: '600', cursor: 'pointer', outline: 'none',
                }}
              >
                {ZOOM_OPTIONS.map(z => (
                  <option key={z} value={z} style={{ color: '#111' }}>{z}%</option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={handleEmail}
              disabled={busy || loading}
              style={accentBtn}
              title="Email light PDF copy to you"
            >
              <FaEnvelope style={{ fontSize: '12px' }} />
              Email
            </button>

            <button type="button" onClick={handlePrint} disabled={busy || loading} style={toolbarBtn} title="Print (light)">
              <FaPrint style={{ fontSize: '12px' }} />
            </button>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setDownloadOpen(v => !v)}
                disabled={busy || loading}
                style={toolbarBtn}
                title="Download"
              >
                <FaDownload style={{ fontSize: '12px' }} />
                <FaChevronDown style={{ fontSize: '9px', opacity: 0.7 }} />
              </button>
              {downloadOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 10,
                  background: '#111827', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px',
                  overflow: 'hidden', minWidth: '140px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                }}>
                  {['light', 'dark'].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleDownload(v)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                        background: 'none', border: 'none', color: '#e5e7eb', fontSize: '0.8125rem',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.08)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                    >
                      {v === 'light' ? 'Light PDF' : 'Dark PDF'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {blobUrl && (
              <a
                href={pdfViewerSrc(blobUrl)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...accentBtn, textDecoration: 'none' }}
              >
                <FaExternalLinkAlt style={{ fontSize: '11px' }} />
                Open
              </a>
            )}

            <button type="button" onClick={handleClose} style={{ ...toolbarBtn, width: '32px', padding: 0, justifyContent: 'center' }}>
              <FaTimes />
            </button>
          </div>
        </div>

        {emailStatus && (
          <div style={{
            padding: '8px 1rem',
            fontSize: '0.8125rem',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            color: emailStatus.ok ? '#22c55e' : '#ef4444',
            background: emailStatus.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
          }}>
            {emailStatus.message}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, background: '#1a1a1a', overflow: 'auto' }}>
          {loading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', padding: '2rem' }}>
              {error}
            </div>
          ) : blobUrl ? (
            <div style={{
              minHeight: '100%',
              display: 'flex',
              justifyContent: 'center',
              padding: '0.5rem',
            }}>
              <div style={{
                width: `${zoom}%`,
                maxWidth: '100%',
                minHeight: '100%',
              }}>
                <embed
                  src={pdfViewerSrc(blobUrl)}
                  type="application/pdf"
                  title="Invoice PDF"
                  style={{ width: '100%', minHeight: 'calc(92vh - 56px)', border: 'none', display: 'block' }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
