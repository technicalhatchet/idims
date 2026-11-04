import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../utils/api-client';
import { techdeckQueryKeys, fetchTechdeckNotifications } from '../../lib/techdeckQueries';
import { notificationLook } from '../../utils/notificationLook';

const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const CLOSE_MS = 190;
const SWEEP_MS = 560;

const ICONS = {
  job: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
  calendar: 'M3 5h18v16H3zM16 3v4M8 3v4M3 10h18',
  doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
  photo: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  card: 'M2 6h20v12H2zM2 10h20M6 15h4',
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z',
  bell: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
};

const TONES = {
  cyan: { line: '#22D3EE', bg: 'rgba(34, 211, 238, 0.1)', border: 'rgba(34, 211, 238, 0.3)' },
  orange: { line: '#FB923C', bg: 'rgba(251, 146, 60, 0.1)', border: 'rgba(251, 146, 60, 0.35)' },
};

/*
 * Laser motion, kept light because the bell is opened often: a cut ignites from the bell
 * along the top edge, then the panel and its glowing bottom edge slide down together from
 * under the header (~0.25s, one transform, so the edge can never drift off the panel), and
 * rows power up quickly. Transform / opacity only.
 */
const BELL_CSS = `
@keyframes nb-cut{0%{transform:scaleX(0);opacity:0}20%{opacity:1}100%{transform:scaleX(1);opacity:1}}
@keyframes nb-drop{0%{transform:translate3d(0,-100%,0)}100%{transform:translate3d(0,0,0)}}
@keyframes nb-lift{0%{transform:translate3d(0,0,0)}100%{transform:translate3d(0,-100%,0)}}
@keyframes nb-row{0%{opacity:0;transform:translate3d(0,-4px,0)}100%{opacity:1;transform:translate3d(0,0,0)}}
@keyframes nb-fade{0%{opacity:0}100%{opacity:1}}
@keyframes nb-fade-out{0%{opacity:1}100%{opacity:0}}
@keyframes nb-seam{0%{left:-6px;opacity:1}80%{opacity:1}100%{left:calc(100% + 2px);opacity:0}}
@keyframes nb-sweep{0%{transform:translate3d(0,-30%,0);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translate3d(0,105%,0);opacity:0}}
@keyframes nb-clear{0%{opacity:1}100%{opacity:0}}
@keyframes nb-ping{0%{transform:scale(1)}40%{transform:scale(1.3)}100%{transform:scale(1)}}
.nb-panel{position:absolute;top:calc(100% + 8px);width:24rem;max-width:calc(100vw - 24px);z-index:1300;overflow:hidden;padding-bottom:28px;pointer-events:none}
.nb-panel.is-right{right:0}.nb-panel.is-left{left:0}
.nb-backdrop{display:none}
@media (max-width: 767px){
  /* Phone: full width, hanging straight off the bottom of the fixed TechDeck header. */
  .nb-panel,.nb-panel.is-right,.nb-panel.is-left{position:fixed;top:calc(72px + env(safe-area-inset-top, 0px));left:12px;right:12px;width:auto;max-width:none}
  .nb-backdrop{display:block;position:fixed;left:0;right:0;bottom:0;top:calc(72px + env(safe-area-inset-top, 0px));z-index:1299;background:rgba(2,6,12,.45);animation:nb-fade .2s ease-out both}
  .nb-backdrop.is-out{animation:nb-fade-out .18s ease-in both}
  .nb-panel .nb-body{border-top-left-radius:0!important;border-top-right-radius:0!important;border-top:0!important}
}
.nb-cut{animation:nb-cut .14s cubic-bezier(.3,.7,.3,1) both}
.nb-slide{position:relative;pointer-events:auto;animation:nb-drop .26s cubic-bezier(.2,.85,.25,1) .1s both;will-change:transform}
.nb-slide.is-out{animation:nb-lift .18s cubic-bezier(.5,0,.75,0) both}
.nb-row{animation:nb-row .2s cubic-bezier(.2,.9,.3,1) both}
.nb-seam{position:absolute;top:0;bottom:0;width:3px;background:#fff;box-shadow:0 0 8px #fff,0 0 18px #22D3EE;pointer-events:none;animation:nb-seam .28s cubic-bezier(.5,0,.3,1) both}
.nb-sweep{animation:nb-sweep .55s cubic-bezier(.45,.05,.55,.95) both}
.nb-clear{animation:nb-clear .16s linear both}
.nb-ping{animation:nb-ping .4s cubic-bezier(.2,.9,.3,1.4)}
.nb-tap:focus-visible{outline:2px solid #A5F3FC;outline-offset:2px}
@media (prefers-reduced-motion: reduce){
  .nb-root *{animation-duration:1ms!important;animation-delay:0s!important;animation-iteration-count:1!important}
}
`;

function formatWhen(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (sameDay) {
      return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function NotificationRow({ n, index, sweeping, sweepCount, onOpen }) {
  const [pressed, setPressed] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const look = notificationLook(n);
  const tone = TONES[look.tone] || TONES.cyan;
  const unread = !n.is_read;
  // While "Mark all read" sweeps, each unread marker fades as the scan line passes its row.
  const clearStyle = sweeping && unread
    ? { animationDelay: `${60 + Math.round((index / Math.max(1, sweepCount)) * 440)}ms` }
    : undefined;

  return (
    <li className="nb-row" style={{ animationDelay: `${0.18 + Math.min(index, 8) * 0.03}s` }}>
      <button
        type="button"
        onClick={() => {
          setPressed(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => onOpen(n), 240);
        }}
        className="nb-tap relative flex w-full min-h-[60px] items-start gap-2.5 overflow-hidden rounded-[10px] py-2.5 pl-3.5 pr-2.5 text-left touch-manipulation"
        style={pressed
          ? { border: '1px solid rgba(165, 243, 252, 0.85)', background: 'rgba(34, 211, 238, 0.16)', boxShadow: '0 0 16px rgba(34, 211, 238, 0.35)' }
          : unread
            ? { border: '1px solid rgba(34, 211, 238, 0.24)', background: 'rgba(34, 211, 238, 0.07)' }
            : { border: '1px solid rgba(255, 255, 255, 0.06)', background: 'rgba(13, 22, 38, 0.5)' }}
      >
        {unread ? (
          <span
            aria-hidden="true"
            className={`absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-sm ${sweeping ? 'nb-clear' : ''}`}
            style={{ background: tone.line, boxShadow: `0 0 8px ${tone.line}`, ...clearStyle }}
          />
        ) : null}
        <span
          aria-hidden="true"
          className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px]"
          style={{ background: tone.bg, border: `1px solid ${tone.border}`, color: tone.line }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d={ICONS[look.icon] || ICONS.bell} />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={`min-w-0 flex-1 truncate text-sm ${unread ? 'font-bold text-slate-100' : 'font-medium text-[#B8C7D6]'}`}>
              {n.title || 'Notification'}
            </span>
            <span className="whitespace-nowrap" style={{ fontFamily: MONO, fontSize: 10, color: '#5B7083' }}>
              {formatWhen(n.created_at)}
            </span>
          </span>
          {n.message ? (
            <span className="mt-0.5 block text-xs leading-4 text-[#8A9FB4] line-clamp-3">{n.message}</span>
          ) : null}
        </span>
        {unread ? (
          <span
            aria-hidden="true"
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${sweeping ? 'nb-clear' : ''}`}
            style={{ background: tone.line, boxShadow: `0 0 8px ${tone.line}`, ...clearStyle }}
          />
        ) : null}
        {unread ? <span className="sr-only">(unread)</span> : null}
        {pressed ? <span className="nb-seam" aria-hidden="true" /> : null}
      </button>
    </li>
  );
}

export default function TechDeckNotificationsBell({
  align = 'right',
  onOpenChange,
}) {
  const router = useRouter();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [ping, setPing] = useState(0);
  const closeTimer = useRef(null);
  const sweepTimer = useRef(null);
  const prevUnread = useRef(null);
  const queryClient = useQueryClient();
  const { data, isFetching, refetch } = useQuery({
    queryKey: techdeckQueryKeys.notifications(),
    queryFn: fetchTechdeckNotifications,
    staleTime: 60 * 1000,
  });
  const items = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const loading = isFetching && !data;

  useEffect(() => () => {
    clearTimeout(closeTimer.current);
    clearTimeout(sweepTimer.current);
  }, []);

  // Ping the badge when new notifications arrive (not on first load).
  useEffect(() => {
    if (prevUnread.current != null && unreadCount > prevUnread.current) setPing((p) => p + 1);
    prevUnread.current = unreadCount;
  }, [unreadCount]);

  const setOpenSafe = useCallback(
    (next) => {
      clearTimeout(closeTimer.current);
      if (next) {
        setClosing(false);
        setOpen(true);
      } else {
        // Slice back up, then unmount.
        setClosing(true);
        closeTimer.current = setTimeout(() => {
          setOpen(false);
          setClosing(false);
        }, CLOSE_MS);
      }
      onOpenChange?.(next);
    },
    [onOpenChange]
  );

  useEffect(() => {
    if (open && !closing) refetch();
  }, [open, closing, refetch]);

  useEffect(() => {
    if (!open || closing) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpenSafe(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpenSafe(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, closing, setOpenSafe]);

  const markRead = async (notification) => {
    if (!notification?.id || notification.is_read) return;
    try {
      await apiClient(`/notifications/notifications/${notification.id}/read`, { method: 'PUT' });
      queryClient.setQueryData(techdeckQueryKeys.notifications(), (prev) => {
        if (!prev) return prev;
        const notifications = prev.notifications.map((n) =>
          n.id === notification.id ? { ...n, is_read: true } : n
        );
        const unread =
          typeof prev.unreadCount === 'number'
            ? Math.max(0, prev.unreadCount - 1)
            : notifications.filter((n) => !n.is_read).length;
        return { notifications, unreadCount: unread };
      });
    } catch (err) {
      console.error('[TechDeckNotificationsBell] mark read failed:', err);
    }
  };

  const handleItemClick = async (notification) => {
    await markRead(notification);
    setOpenSafe(false);
    if (notification.related_type === 'work_order' && notification.reference_id) {
      router.push(`/techboard/work-orders/${notification.reference_id}`);
    }
  };

  const markAllRead = async () => {
    if (sweeping) return;
    setSweeping(true);
    const request = apiClient('/notifications/notifications/read-all', { method: 'PUT' });
    clearTimeout(sweepTimer.current);
    sweepTimer.current = setTimeout(async () => {
      try {
        await request;
        queryClient.setQueryData(techdeckQueryKeys.notifications(), (prev) => {
          if (!prev) return prev;
          return {
            notifications: prev.notifications.map((n) => ({ ...n, is_read: true })),
            unreadCount: 0,
          };
        });
      } catch (err) {
        console.error('[TechDeckNotificationsBell] mark all read failed:', err);
      } finally {
        setSweeping(false);
      }
    }, SWEEP_MS);
  };

  const isOpen = open && !closing;
  const out = closing ? ' is-out' : '';
  const rightSide = align !== 'left';
  const kicker = loading && items.length === 0
    ? 'NOTIFICATIONS // SYNCING…'
    : unreadCount > 0
      ? `NOTIFICATIONS // ${unreadCount} NEW`
      : 'NOTIFICATIONS // ALL READ';

  return (
    <div className="nb-root relative" ref={rootRef}>
      <style>{BELL_CSS}</style>
      <button
        type="button"
        onClick={() => {
          const next = !isOpen;
          setOpenSafe(next);
          if (next) refetch();
        }}
        className="nb-tap relative w-10 h-10 flex items-center justify-center rounded-lg transition-all hover:bg-white/5"
        style={isOpen
          ? { border: '1px solid rgba(165,243,252,0.8)', background: 'rgba(34,211,238,0.16)', boxShadow: '0 0 14px rgba(34,211,238,0.4)' }
          : { border: '1px solid rgba(255,255,255,0.07)', background: 'transparent' }}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          aria-hidden="true"
          style={{
            stroke: isOpen ? '#A5F3FC' : '#9CA3AF',
            strokeWidth: 1.75,
            fill: 'none',
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
          }}
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            key={ping}
            className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold text-white ${ping ? 'nb-ping' : ''}`}
            style={{ background: '#EF4444', boxShadow: '0 0 8px rgba(239,68,68,0.7)' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            tabIndex={-1}
            className={`nb-backdrop${out}`}
            onClick={() => setOpenSafe(false)}
          />
          <div className={`nb-panel ${rightSide ? 'is-right' : 'is-left'}`} role="dialog" aria-label="Notifications">
            {/* The cut: ignites from the bell's side along the top edge (stays put while the panel drops). */}
            <div
              aria-hidden="true"
              className="nb-cut pointer-events-none absolute inset-x-0 top-0 z-[3]"
              style={{
                height: 2,
                transformOrigin: rightSide ? '100% 50%' : '0 50%',
                background: rightSide
                  ? 'linear-gradient(90deg, rgba(165,243,252,0), #A5F3FC 30%, #FFFFFF 92%, #A5F3FC)'
                  : 'linear-gradient(270deg, rgba(165,243,252,0), #A5F3FC 30%, #FFFFFF 92%, #A5F3FC)',
                boxShadow: '0 0 8px #22D3EE, 0 0 18px rgba(34, 211, 238, 0.7)',
              }}
            />
            <div className={`nb-slide${out}`}>
            <div
              className="nb-body relative flex flex-col overflow-hidden rounded-[14px]"
              style={{
                maxHeight: 'min(560px, calc(100dvh - 72px - env(safe-area-inset-top, 0px) - 120px))',
                border: '1px solid rgba(34, 211, 238, 0.35)',
                background: 'linear-gradient(180deg, rgba(16, 40, 56, 0.98) 0%, rgba(8, 16, 28, 0.99) 60%)',
                boxShadow: '0 18px 40px rgba(0, 0, 0, 0.55)',
              }}
            >
              <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: 'repeating-linear-gradient(0deg, rgba(34, 211, 238, 0.04) 0 1px, transparent 1px 4px)' }} />
              {sweeping ? (
                <div aria-hidden="true" className="nb-sweep pointer-events-none absolute inset-x-0 top-0 z-[2] h-full">
                  <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: '#FFFFFF', boxShadow: '0 0 8px #FFFFFF, 0 0 18px #22D3EE' }} />
                  <div className="absolute inset-x-0 h-10" style={{ top: -40, background: 'linear-gradient(180deg, rgba(34,211,238,0), rgba(34,211,238,0.14))' }} />
                </div>
              ) : null}

              <div className="relative flex shrink-0 items-center justify-between px-3.5 pb-2.5 pt-3">
                <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: '#5FB7C9' }}>{kicker}</span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    disabled={sweeping}
                    className="nb-tap min-h-[36px] rounded-lg px-2.5 text-xs font-semibold text-[#8FE6F3] touch-manipulation"
                    style={{ border: '1px solid rgba(34, 211, 238, 0.35)' }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2.5">
                {loading && items.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-gray-500">Loading…</p>
                ) : items.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-gray-500">No notifications yet.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {items.map((n, i) => (
                      <NotificationRow
                        key={n.id}
                        n={n}
                        index={i}
                        sweeping={sweeping}
                        sweepCount={items.length}
                        onOpen={handleItemClick}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {/* Glowing bottom edge: part of the sliding piece, so it rides down with the panel. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute"
              style={{ left: 6, right: 6, bottom: -1, height: 2, borderRadius: 1, background: 'linear-gradient(90deg, rgba(165,243,252,0), #A5F3FC 12%, #FFFFFF 50%, #A5F3FC 88%, rgba(165,243,252,0))', boxShadow: '0 0 8px #22D3EE, 0 0 18px rgba(34, 211, 238, 0.7)' }}
            />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
