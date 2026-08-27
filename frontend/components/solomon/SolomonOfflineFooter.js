'use client';

import { FaCheckCircle, FaCloudUploadAlt, FaWifi } from 'react-icons/fa';
import { useClientMounted } from '../../hooks/useClientMounted';
import { useOfflineSync } from '../../hooks/useOfflineSync';

export default function SolomonOfflineFooter() {
  const mounted = useClientMounted();
  const { isOnline, pendingCount, syncState } = useOfflineSync();

  if (!mounted) return null;

  if (!isOnline) {
    return (
      <p className="flex items-center justify-center gap-2 text-xs text-amber-300/90">
        <FaWifi size={12} />
        Offline — saved on your device
      </p>
    );
  }

  if (pendingCount > 0) {
    return (
      <p className="flex items-center justify-center gap-2 text-xs text-sky-300/90">
        <FaCloudUploadAlt size={12} />
        {syncState === 'syncing' ? 'Syncing…' : `${pendingCount} item(s) waiting to sync`}
      </p>
    );
  }

  return (
    <p className="flex items-center justify-center gap-2 text-xs text-emerald-400/90">
      <FaCheckCircle size={12} />
      Offline ready
    </p>
  );
}
