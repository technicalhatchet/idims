'use client';

import { FaCheckCircle, FaCloudUploadAlt, FaShieldAlt, FaWifi } from 'react-icons/fa';
import { useClientMounted } from '../../hooks/useClientMounted';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { formatSolomonDateTime } from '../../utils/solomonFormat';

export default function SolomonOfflineFooter({ syncReferenceTime }) {
  const mounted = useClientMounted();
  const { isOnline, pendingCount, syncState } = useOfflineSync();
  const syncedLabel = syncReferenceTime
    ? formatSolomonDateTime(syncReferenceTime, 'MMM d, h:mm a')
    : null;

  if (!mounted) return null;

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-white/15 bg-[#060a12]/78 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] px-3 py-2 flex items-center gap-3">
        <FaWifi size={14} className="text-amber-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-white">Offline</p>
          <p className="text-[10px] text-gray-500">Diagnostics saved on your device</p>
        </div>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="rounded-xl border border-white/15 bg-[#060a12]/78 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] px-3 py-2 flex items-center gap-3">
        <FaCloudUploadAlt size={14} className="text-sky-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-white">Sync pending</p>
          <p className="text-[10px] text-gray-500">
            {syncState === 'syncing' ? 'Syncing…' : `${pendingCount} item(s) waiting to sync`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/15 bg-[#060a12]/78 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] px-3 py-2 flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
        <FaShieldAlt size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-white">Offline ready</p>
        <p className="text-[10px] text-gray-500 leading-snug">
          All diagnostics and repair memory available offline.
        </p>
      </div>
      <div className="shrink-0 text-right">
        {syncedLabel ? (
          <p className="text-[10px] text-gray-500">Synced {syncedLabel}</p>
        ) : null}
        <FaCheckCircle size={12} className="text-emerald-400 ml-auto mt-0.5" />
      </div>
    </div>
  );
}
