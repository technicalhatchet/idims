import { FaEye, FaTimes } from 'react-icons/fa';
import { getPortalImpersonateClientName } from '../../utils/portalPreview';

export default function ImpersonationBanner({ onExit }) {
  const clientName = getPortalImpersonateClientName();
  if (!clientName) return null;

  return (
    <div
      className="sticky top-0 z-40 mb-4 flex items-center justify-between gap-3 rounded-lg px-4 py-2 text-[13px] font-semibold text-[#0f0f1a]"
      style={{ background: 'rgba(245,158,11,0.95)', backdropFilter: 'blur(8px)' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <FaEye className="shrink-0" aria-hidden />
        <span className="truncate">
          Admin Preview — Viewing as: <strong>{clientName}</strong>
        </span>
      </div>
      {onExit ? (
        <button
          type="button"
          onClick={onExit}
          className="flex shrink-0 items-center gap-1 rounded-md bg-black/15 px-2.5 py-1 font-bold hover:bg-black/25"
        >
          <FaTimes size={11} aria-hidden /> Exit Preview
        </button>
      ) : null}
    </div>
  );
}
