import { useCallback, useEffect, useState } from 'react';
import { FaEye, FaLock, FaTimes, FaUnlock } from 'react-icons/fa';
import {
  clearPortalPreviewUnlock,
  getPortalImpersonateClientName,
  isPortalPreviewUnlocked,
  requestPortalPreviewUnlock,
} from '../../utils/portalPreview';
import { getPortalSessionToken } from '../../utils/portalFetch';

export default function PortalPreviewBanner({ onExit }) {
  const clientName = getPortalImpersonateClientName();
  const [unlocked, setUnlocked] = useState(isPortalPreviewUnlocked());
  const [unlocking, setUnlocking] = useState(false);

  const refreshUnlockState = useCallback(() => {
    setUnlocked(isPortalPreviewUnlocked());
  }, []);

  useEffect(() => {
    refreshUnlockState();
    const timer = setInterval(refreshUnlockState, 30_000);
    return () => clearInterval(timer);
  }, [refreshUnlockState]);

  const handleUnlock = async () => {
    const confirmed = window.confirm(
      `You'll be making real changes to ${clientName}'s account. Continue?`,
    );
    if (!confirmed) return;

    setUnlocking(true);
    try {
      const token = await getPortalSessionToken();
      const clientId = sessionStorage.getItem('portal_impersonate_client_id');
      await requestPortalPreviewUnlock(token, clientId);
      setUnlocked(true);
    } catch (err) {
      window.alert(err.message || 'Could not unlock preview editing.');
    } finally {
      setUnlocking(false);
    }
  };

  const handleRelock = () => {
    clearPortalPreviewUnlock();
    setUnlocked(false);
  };

  const bg = unlocked ? 'rgba(239,68,68,0.95)' : 'rgba(245,158,11,0.95)';

  return (
    <div
      className="relative z-0 shrink-0 w-full rounded-none border-b border-black/10"
      style={{
        background: bg,
        padding: '8px 16px',
        paddingTop: 'max(8px, env(safe-area-inset-top))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        fontSize: '13px',
        fontWeight: '600',
        color: '#0f0f1a',
      }}
    >
      <div className="flex items-center gap-2">
        <FaEye />
        {unlocked ? (
          <span>
            Editing as <strong>{clientName}</strong> — changes are real.
          </span>
        ) : (
          <span>
            Admin Preview — Viewing as: <strong>{clientName}</strong>
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {unlocked ? (
          <button
            type="button"
            onClick={handleRelock}
            style={{
              background: 'rgba(0,0,0,0.15)',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 10px',
              cursor: 'pointer',
              color: '#0f0f1a',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: '700',
            }}
          >
            <FaLock size={11} /> Re-lock
          </button>
        ) : (
          <button
            type="button"
            onClick={handleUnlock}
            disabled={unlocking}
            style={{
              background: 'rgba(0,0,0,0.15)',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 10px',
              cursor: 'pointer',
              color: '#0f0f1a',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: '700',
            }}
          >
            <FaUnlock size={11} /> {unlocking ? 'Unlocking…' : 'Unlock editing'}
          </button>
        )}
        <button
          type="button"
          onClick={onExit}
          style={{
            background: 'rgba(0,0,0,0.15)',
            border: 'none',
            borderRadius: '6px',
            padding: '4px 10px',
            cursor: 'pointer',
            color: '#0f0f1a',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontWeight: '700',
          }}
        >
          <FaTimes size={11} /> Exit Preview
        </button>
      </div>
    </div>
  );
}
