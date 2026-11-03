import { useCallback, useEffect, useRef, useState } from 'react';
import { FaQrcode, FaSms, FaWifi, FaEnvelope, FaLink, FaCreditCard, FaMoneyBillWave, FaCheckCircle } from 'react-icons/fa';
import MobileActionSheet, { MobileActionSheetButton, MobileActionSheetGridTile } from '../ui/MobileActionSheet';
import {
  SQUARE_PAY_FEATURES,
  buildPayLinkSmsUrl,
  buildTapToPayUrl,
  fetchWorkOrderPayLink,
  publishWorkOrderSquareInvoice,
} from '../../services/api/squarePayApi';

const POLL_MS = 3000;

function formatMoney(n) {
  const v = Number(n);
  return Number.isFinite(v) ? `$${v.toFixed(2)}` : '—';
}

/**
 * "Pay" sheet opened from the work order bar's Payment / Prepay button.
 *
 * Works today: Enter card (existing Square card sheet), Record cash or check.
 * Scaffolded for the Square plan (stay disabled until their backend + flags exist):
 * Show QR · Text link · Tap to Pay · Email invoice · Copy link, plus live "Paid ✓".
 */
export default function WorkOrderPaySheet({
  open,
  onClose,
  workOrderId,
  orderNumber,
  dueToday = 0,
  clientPhone = '',
  onEnterCard,
  onRecordPayment,
  onRefreshBalance,
  onNotice,
}) {
  const [payLink, setPayLink] = useState(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const refreshRef = useRef(onRefreshBalance);
  refreshRef.current = onRefreshBalance;

  const paid = Number(dueToday) <= 0;

  // Load the job's pay link when the sheet opens (no-op until pay links are enabled).
  useEffect(() => {
    if (!open || !SQUARE_PAY_FEATURES.payLinks) return undefined;
    let cancelled = false;
    setLinkLoading(true);
    fetchWorkOrderPayLink(workOrderId)
      .then((link) => { if (!cancelled) setPayLink(link); })
      .finally(() => { if (!cancelled) setLinkLoading(false); });
    return () => { cancelled = true; };
  }, [open, workOrderId]);

  // Live status: while a customer may be paying remotely, re-check the balance (plan §5).
  useEffect(() => {
    if (!open || paid || !SQUARE_PAY_FEATURES.payLinks || !payLink) return undefined;
    const t = window.setInterval(() => refreshRef.current?.(), POLL_MS);
    return () => window.clearInterval(t);
  }, [open, paid, payLink]);

  useEffect(() => {
    if (!open) setShowQr(false);
  }, [open]);

  const tapUrl = buildTapToPayUrl({
    workOrderId,
    amountCents: Math.round(Number(dueToday) * 100),
    platform: typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent) ? 'android' : 'ios',
  });
  const smsUrl = buildPayLinkSmsUrl({ phone: clientPhone, orderNumber, amountDue: dueToday, payUrl: payLink?.payUrl });
  const linkReady = Boolean(payLink?.payUrl) && !paid;

  const copyLink = useCallback(async () => {
    if (!payLink?.payUrl) return;
    try {
      await navigator.clipboard.writeText(payLink.payUrl);
      onNotice?.('PAY LINK // COPIED');
    } catch {
      window.prompt('Copy this pay link:', payLink.payUrl);
    }
  }, [payLink, onNotice]);

  const emailInvoice = useCallback(async () => {
    setPublishing(true);
    try {
      await publishWorkOrderSquareInvoice(workOrderId);
      onNotice?.('INVOICE // EMAILED');
    } catch (err) {
      alert(err?.message || 'Could not send the Square invoice');
    } finally {
      setPublishing(false);
    }
  }, [workOrderId, onNotice]);

  const notReadyNote = !SQUARE_PAY_FEATURES.payLinks
    ? 'QR, text, Tap to Pay, email and copy link turn on once Square pay links are set up.'
    : linkLoading
      ? 'Getting the pay link…'
      : !payLink && !paid
        ? 'No pay link for this job yet.'
        : null;

  return (
    <MobileActionSheet open={open} onClose={onClose} title="Collect payment" kicker="WORK ORDER // PAYMENT" zIndex={20060}>
      <div className="mb-4 flex items-end justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">Due today</div>
          <div className="text-2xl font-bold text-white">{formatMoney(dueToday)}</div>
        </div>
        {paid ? (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-300">
            <FaCheckCircle aria-hidden /> Paid
          </span>
        ) : (
          <span className="rounded-full bg-orange-500/15 px-3 py-1 text-sm font-semibold text-orange-300">Unpaid</span>
        )}
      </div>

      {showQr && payLink?.payUrl ? (
        // QR rendering lands with plan step 4 (add the `qrcode` package; black on white with
        // a quiet zone, white even in dark mode, total under it).
        <div className="mb-4 rounded-xl bg-white p-6 text-center text-black">
          <p className="text-sm font-semibold">QR code coming with pay links</p>
          <p className="mt-1 break-all text-xs">{payLink.payUrl}</p>
          <p className="mt-3 text-lg font-bold">{formatMoney(dueToday)}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-2.5">
        <MobileActionSheetGridTile
          label="Show QR"
          icon={<FaQrcode aria-hidden />}
          disabled={!linkReady}
          onClick={() => setShowQr((v) => !v)}
        />
        <MobileActionSheetGridTile
          label="Text link"
          icon={<FaSms aria-hidden />}
          disabled={!linkReady || !smsUrl}
          onClick={() => { if (smsUrl) window.location.href = smsUrl; }}
        />
        <MobileActionSheetGridTile
          label="Tap to Pay"
          icon={<FaWifi aria-hidden style={{ transform: 'rotate(90deg)' }} />}
          disabled={paid || !tapUrl}
          onClick={() => { if (tapUrl) window.location.href = tapUrl; }}
        />
        <MobileActionSheetGridTile
          label={publishing ? 'Sending…' : 'Email invoice'}
          icon={<FaEnvelope aria-hidden />}
          disabled={paid || publishing || !SQUARE_PAY_FEATURES.payLinks}
          onClick={emailInvoice}
        />
        <MobileActionSheetGridTile
          label="Copy link"
          icon={<FaLink aria-hidden />}
          disabled={!linkReady}
          onClick={copyLink}
        />
        <MobileActionSheetGridTile
          label="Enter card"
          icon={<FaCreditCard aria-hidden />}
          disabled={paid}
          onClick={onEnterCard}
        />
      </div>

      {notReadyNote ? <p className="mt-3 text-xs text-gray-500">{notReadyNote}</p> : null}

      <div className="mt-4">
        <MobileActionSheetButton disabled={paid} onClick={onRecordPayment}>
          <FaMoneyBillWave aria-hidden />
          Record cash or check
        </MobileActionSheetButton>
      </div>
    </MobileActionSheet>
  );
}
