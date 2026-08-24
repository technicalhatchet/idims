import { useState } from 'react';
import { moderateDmaRepairRecord } from '../../services/api/dmaApi';

const STATUS_STYLES = {
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-300 border-red-500/30',
};

const STATUS_LABELS = {
  pending: 'Pending review',
  approved: 'Approved for repair pool',
  rejected: 'Rejected',
};

export function DmaModerationBadge({ status }) {
  if (!status) return null;
  const style = STATUS_STYLES[status] || 'bg-white/5 text-gray-400 border-white/10';
  const label = STATUS_LABELS[status] || status;
  return (
    <span className={`inline-block text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border ${style}`}>
      {label}
    </span>
  );
}

export default function DmaModerationPanel({ record, onModerated }) {
  const [isModerating, setIsModerating] = useState(false);
  const [error, setError] = useState(null);

  if (!record) return null;

  const status = record.moderation_status || 'approved';
  const isDiy = record.context === 'diy';

  const handleModerate = async (moderationStatus) => {
    if (moderationStatus === 'rejected') {
      const ok = window.confirm(
        'Reject this submission? It will stay private to the homeowner and will not enter the shared repair pool.',
      );
      if (!ok) return;
    }

    setIsModerating(true);
    setError(null);
    try {
      const updated = await moderateDmaRepairRecord(record.id, { moderation_status: moderationStatus });
      onModerated?.(updated);
    } catch (err) {
      setError(err.message || 'Moderation failed');
    } finally {
      setIsModerating(false);
    }
  };

  return (
    <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4 mb-4">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <p className="text-xs uppercase tracking-wide text-violet-300/90 font-semibold">Moderation</p>
        {isDiy ? (
          <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border border-cyan-500/25 bg-cyan-500/10 text-cyan-300">
            DIY submission
          </span>
        ) : null}
        <DmaModerationBadge status={status} />
      </div>

      {status === 'pending' ? (
        <p className="text-sm text-gray-400 mb-3">
          This homeowner submission is waiting for review before it can appear in Repair Memory search.
        </p>
      ) : null}
      {status === 'rejected' ? (
        <p className="text-sm text-gray-400 mb-3">
          Rejected submissions stay private. You can approve later if you change your mind.
        </p>
      ) : null}
      {status === 'approved' && isDiy ? (
        <p className="text-sm text-gray-400 mb-3">
          Approved DIY outcomes are visible in the shared repair knowledge pool.
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-400 mb-3">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {(status === 'pending' || status === 'rejected') && (
          <button
            type="button"
            disabled={isModerating}
            onClick={() => handleModerate('approved')}
            className="text-sm px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-50"
          >
            {isModerating ? '…' : 'Approve for pool'}
          </button>
        )}
        {(status === 'pending' || status === 'approved') && (
          <button
            type="button"
            disabled={isModerating}
            onClick={() => handleModerate('rejected')}
            className="text-sm px-4 py-2 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
          >
            {isModerating ? '…' : status === 'approved' ? 'Remove from pool' : 'Reject'}
          </button>
        )}
      </div>
    </div>
  );
}
