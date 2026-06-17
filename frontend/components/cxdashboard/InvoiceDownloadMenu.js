import { useState, useRef, useEffect } from 'react';
import { FaDownload, FaChevronDown } from 'react-icons/fa';
import { fetchPortalInvoicePdfBlob, triggerBlobDownload } from '../../utils/portalInvoicePdf';

export default function InvoiceDownloadMenu({ invoice, className = '' }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  async function download(variant) {
    setOpen(false);
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

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        title="Download invoice"
        disabled={busy}
        onClick={() => setOpen(v => !v)}
        className={className}
        style={{
          width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,212,255,0.08)', color: '#22d3ee', border: '1px solid rgba(0,212,255,0.2)',
          borderRadius: '6px', cursor: busy ? 'wait' : 'pointer',
        }}
      >
        <FaDownload style={{ fontSize: '13px' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 20,
          background: '#111827', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px',
          overflow: 'hidden', minWidth: '130px', boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        }}>
          {['light', 'dark'].map(v => (
            <button
              key={v}
              type="button"
              onClick={() => download(v)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                background: 'none', border: 'none', color: '#e5e7eb', fontSize: '0.8125rem', cursor: 'pointer',
              }}
            >
              {v === 'light' ? 'Light PDF' : 'Dark PDF'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
