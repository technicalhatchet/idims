'use client';

import { FaCheckCircle, FaCloudUploadAlt, FaShieldAlt, FaWifi } from 'react-icons/fa';
import { useClientMounted } from '../../hooks/useClientMounted';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import useSolomonTheme from '../../hooks/useSolomonTheme';
import { formatSolomonDateTime } from '../../utils/solomonFormat';

function OfflineFooterShell({ children, isProfessional }) {
  if (isProfessional) {
    return (
      <div className="rounded-[var(--solomon-radius-card)] border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] px-3 py-2.5 flex items-center gap-3">
        {children}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/15 bg-[#060a12]/78 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] px-3 py-2 flex items-center gap-3">
      {children}
    </div>
  );
}

export default function SolomonOfflineFooter({ syncReferenceTime }) {
  const mounted = useClientMounted();
  const { isProfessional } = useSolomonTheme();
  const { isOnline, pendingCount, syncState } = useOfflineSync();
  const syncedLabel = syncReferenceTime
    ? formatSolomonDateTime(syncReferenceTime, 'MMM d, h:mm a')
    : null;

  if (!mounted) return null;

  if (!isOnline) {
    return (
      <OfflineFooterShell isProfessional={isProfessional}>
        <FaWifi size={14} className="text-amber-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--solomon-text-primary)]">Offline</p>
          <p className="text-[10px] text-[var(--solomon-text-muted)]">Diagnostics saved on your device</p>
        </div>
      </OfflineFooterShell>
    );
  }

  if (pendingCount > 0) {
    return (
      <OfflineFooterShell isProfessional={isProfessional}>
        <FaCloudUploadAlt size={14} className="text-sky-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[var(--solomon-text-primary)]">Sync pending</p>
          <p className="text-[10px] text-[var(--solomon-text-muted)]">
            {syncState === 'syncing' ? 'Syncing…' : `${pendingCount} item(s) waiting to sync`}
          </p>
        </div>
      </OfflineFooterShell>
    );
  }

  return (
    <OfflineFooterShell isProfessional={isProfessional}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--solomon-radius-control)] ${
        isProfessional
          ? 'bg-[var(--solomon-status-diagnostic)]/10 text-[var(--solomon-status-diagnostic)]'
          : 'bg-cyan-500/10 text-cyan-400'
      }`}>
        <FaShieldAlt size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[var(--solomon-text-primary)]">Offline ready</p>
        <p className="text-[10px] text-[var(--solomon-text-muted)] leading-snug">
          All diagnostics and repair memory available offline.
        </p>
      </div>
      <div className="shrink-0 text-right">
        {syncedLabel ? (
          <p className="text-[10px] text-[var(--solomon-text-muted)]">Synced {syncedLabel}</p>
        ) : null}
        <FaCheckCircle size={12} className="text-[var(--solomon-status-complete)] ml-auto mt-0.5" />
      </div>
    </OfflineFooterShell>
  );
}
