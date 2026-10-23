import { useEffect, useRef, useState } from 'react';
import { FaChevronDown } from 'react-icons/fa';
import { getPortalSessionToken } from '../../../utils/portalFetch';
import { buildPortalExportUrl } from '../../../utils/portalPreview';
import { triggerBlobDownload } from '../../../utils/portalInvoicePdf';
import { useFeature } from '../../../context/FeatureFlagsContext';

const MENU_ITEMS = [
  { id: 'pdf', path: 'export.pdf', filename: 'appliance-summary.pdf', label: 'Summary (PDF)' },
  { id: 'appliances', path: 'export.csv', filename: 'appliances.csv', label: 'Appliances (CSV)' },
  {
    id: 'repairs',
    path: 'repairs-export.csv',
    filename: 'repair-history.csv',
    label: 'Repair history (CSV)',
  },
];

export default function AppliancesExportMenu({ exportExtraQuery = {} }) {
  const exportsEnabled = useFeature('appliance_exports');
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const runExport = async (item) => {
    setOpen(false);
    setBusyId(item.id);
    try {
      const token = await getPortalSessionToken();
      const url = buildPortalExportUrl(item.path, exportExtraQuery);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      triggerBlobDownload(blob, item.filename);
    } catch (err) {
      window.alert(err.message || 'Export failed');
    } finally {
      setBusyId(null);
    }
  };

  const menuBusy = Boolean(busyId);

  if (!exportsEnabled) {
    return null;
  }

  return (
    <div ref={ref} className="relative inline-flex justify-end w-full sm:w-auto">
      <button
        type="button"
        disabled={menuBusy}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 border border-cyan-500/30 rounded-lg px-3 py-1.5 whitespace-nowrap disabled:opacity-60"
      >
        Export
        <FaChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-[calc(100%+4px)] z-20 min-w-[11.5rem] rounded-lg border border-cyan-500/25 bg-[#0B1220] shadow-xl shadow-black/40 py-1 overflow-hidden"
        >
          {MENU_ITEMS.map((item) => {
            const itemBusy = busyId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={menuBusy}
                onClick={() => runExport(item)}
                className="w-full px-3 py-2 text-left text-xs font-semibold text-cyan-300 hover:bg-white/5 inline-flex items-center justify-between gap-2 disabled:cursor-wait"
              >
                <span>{item.label}</span>
                {itemBusy ? (
                  <span
                    className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0"
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
