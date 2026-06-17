import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
import PortalPdfViewer from './PortalPdfViewer';

const ZOOM_OPTIONS = [75, 100, 125, 150];
const TOOLBAR_SIZE = 32;

const toolbarBtn = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px',
  background: 'rgba(255,255,255,0.06)',
  color: '#d1d5db',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '6px',
  height: `${TOOLBAR_SIZE}px`,
  padding: '0 8px',
  fontSize: '0.8125rem',
  fontWeight: '600',
  cursor: 'pointer',
  flexShrink: 0,
};

const iconBtn = {
  ...toolbarBtn,
  width: `${TOOLBAR_SIZE}px`,
  padding: 0,
};

const accentBtn = {
  ...iconBtn,
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
  const downloadRef = useRef(null);
  const downloadMenuRef = useRef(null);
  const [downloadMenuPos, setDownloadMenuPos] = useState(null);

  const updateDownloadMenuPos = useCallback(() => {
    const el = downloadRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuHeight = 88;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < menuHeight + 12;
    setDownloadMenuPos({
      top: openUp ? rect.top - menuHeight - 6 : rect.bottom + 6,
      left: Math.max(8, rect.right - 140),
      width: 140,
    });
  }, []);

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

  useEffect(() => {
    if (!downloadOpen) {
      setDownloadMenuPos(null);
      return undefined;
    }
    updateDownloadMenuPos();
    const close = (e) => {
      if (downloadRef.current?.contains(e.target)) return;
      if (downloadMenuRef.current?.contains(e.target)) return;
      setDownloadOpen(false);
    };
    const onLayout = () => updateDownloadMenuPos();
    document.addEventListener('mousedown', close);
    window.addEventListener('resize', onLayout);
    window.addEventListener('scroll', onLayout, true);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('resize', onLayout);
      window.removeEventListener('scroll', onLayout, true);
    };
  }, [downloadOpen, updateDownloadMenuPos]);

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-[200] flex items-stretch sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-[920px] h-[100dvh] sm:h-[92vh] rounded-none sm:rounded-2xl"
        style={{
          background: '#0A0F1E', border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div
          className="relative z-20 shrink-0 rounded-none sm:rounded-t-2xl"
          style={{
            padding: 'max(0.75rem, env(safe-area-inset-top)) 1rem 0.75rem',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            background: '#0A0F1A',
          }}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 pt-0.5">
                <p style={{ color: '#fff', fontWeight: '700', margin: 0, fontSize: '0.9375rem' }}>
                  Invoice #{invoice?.order_number}
                </p>
                <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '2px 0 0' }}>
                  {invoice?.created_at ? format(parseISO(invoice.created_at), 'MMM d, yyyy') : ''}
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
                style={{ ...iconBtn }}
                aria-label="Close"
              >
                <FaTimes style={{ fontSize: '13px' }} />
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 flex-wrap sm:flex-nowrap">
                <label
                  style={{
                    ...toolbarBtn,
                    padding: '0 6px',
                    gap: '2px',
                  }}
                  title="Zoom"
                >
                  <select
                    value={zoom}
                    onChange={e => setZoom(Number(e.target.value))}
                    aria-label="Zoom"
                    style={{
                      background: 'transparent', border: 'none', color: '#e5e7eb',
                      fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', outline: 'none',
                      lineHeight: 1, padding: 0, height: '100%',
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
                  aria-label="Email invoice"
                >
                  <FaEnvelope style={{ fontSize: '13px' }} />
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={busy || loading}
                  style={iconBtn}
                  title="Print (light)"
                  aria-label="Print invoice"
                >
                  <FaPrint style={{ fontSize: '13px' }} />
                </button>

                <div
                  ref={downloadRef}
                  style={{ position: 'relative', flexShrink: 0 }}
                >
                  <button
                    type="button"
                    onClick={() => setDownloadOpen(v => !v)}
                    disabled={busy || loading}
                    style={{ ...toolbarBtn, width: 'auto', minWidth: `${TOOLBAR_SIZE}px`, padding: '0 6px' }}
                    title="Download"
                    aria-label="Download invoice"
                    aria-expanded={downloadOpen}
                  >
                    <FaDownload style={{ fontSize: '13px' }} />
                    <FaChevronDown style={{ fontSize: '8px', opacity: 0.7 }} />
                  </button>
                  {downloadOpen && downloadMenuPos && typeof document !== 'undefined' && createPortal(
                    <div
                      ref={downloadMenuRef}
                      role="menu"
                      style={{
                        position: 'fixed',
                        top: downloadMenuPos.top,
                        left: downloadMenuPos.left,
                        width: downloadMenuPos.width,
                        zIndex: 10000,
                        background: '#111827',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
                      }}
                    >
                      {['light', 'dark'].map(v => (
                        <button
                          key={v}
                          type="button"
                          role="menuitem"
                          onClick={() => handleDownload(v)}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px',
                            background: 'none', border: 'none', color: '#e5e7eb', fontSize: '0.8125rem',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,212,255,0.08)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                        >
                          {v === 'light' ? 'Light PDF' : 'Dark PDF'}
                        </button>
                      ))}
                    </div>,
                    document.body,
                  )}
                </div>

                {blobUrl && (
                  <a
                    href={pdfViewerSrc(blobUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...accentBtn, textDecoration: 'none' }}
                    title="Open in new tab"
                    aria-label="Open in new tab"
                  >
                    <FaExternalLinkAlt style={{ fontSize: '13px' }} />
                  </a>
                )}
            </div>
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

        <div
          className="flex-1 min-h-0 overflow-auto rounded-none sm:rounded-b-2xl"
          style={{
            background: '#1a1a1a',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {loading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
              <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', padding: '2rem' }}>
              {error}
            </div>
          ) : blobUrl ? (
            <PortalPdfViewer blobUrl={blobUrl} zoom={zoom} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
