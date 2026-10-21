import { useCallback, useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { formatPortalCurrency } from '../../utils/portalMoney';
import { getPortalSessionToken, portalFetch } from '../../utils/portalFetch';

function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  const getPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0];
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const emit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL('image/png'));
  }, [onChange]);

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const { x, y } = getPoint(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    emit();
  };

  const end = () => {
    drawing.current = false;
    emit();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange('');
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = 120;
  }, []);

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg border border-white/15 bg-white touch-none"
        style={{ height: 120 }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <button
        type="button"
        onClick={clear}
        className="mt-2 text-xs text-gray-500 hover:text-gray-300"
      >
        Clear signature
      </button>
    </div>
  );
}

export default function EstimateApprovalSheet({ workOrder, onClose, onDecided }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState(null);
  const [signerName, setSignerName] = useState('');
  const [signature, setSignature] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const woId = workOrder?.id;

  useEffect(() => {
    if (!woId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getPortalSessionToken();
        const data = await portalFetch(`work-orders/${woId}/estimate-approval`, token);
        setState(data);
      } catch (err) {
        setError(err.message || 'Could not load estimate');
      } finally {
        setLoading(false);
      }
    })();
  }, [woId]);

  const submitApprove = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const token = await getPortalSessionToken();
      await portalFetch(`work-orders/${woId}/estimate-approval/approve`, token, {
        method: 'POST',
        body: JSON.stringify({ signer_name: signerName, signature_png: signature }),
      });
      onDecided?.();
      onClose?.();
    } catch (err) {
      setError(err.message || 'Approval failed');
    } finally {
      setSubmitting(false);
    }
  };

  const submitDecline = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const token = await getPortalSessionToken();
      await portalFetch(`work-orders/${woId}/estimate-approval/decline`, token, {
        method: 'POST',
        body: JSON.stringify({ decline_reason: declineReason || null }),
      });
      onDecided?.();
      onClose?.();
    } catch (err) {
      setError(err.message || 'Could not save decline');
    } finally {
      setSubmitting(false);
    }
  };

  const canAct = state?.can_approve || state?.can_decline;
  const decided = state?.current_decision && !canAct;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: '0.75rem',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          maxHeight: '90vh',
          overflow: 'auto',
          background: '#0D1525',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          padding: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Review estimate</h2>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
            Close
          </button>
        </div>

        {loading && <p style={{ color: '#9ca3af' }}>Loading…</p>}
        {error && <p style={{ color: '#ef4444', fontSize: '0.875rem' }}>{error}</p>}

        {!loading && state && (
          <>
            <p style={{ color: '#9ca3af', fontSize: '0.8125rem', marginTop: 0 }}>
              Order #{workOrder.order_number}
            </p>

            {state.lines?.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                {state.lines.map((line, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', padding: '4px 0', color: '#d1d5db' }}>
                    <span style={{ paddingRight: 8 }}>{line.name}</span>
                    <span>{formatPortalCurrency(line.line_total)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', fontWeight: 700, color: '#22d3ee' }}>
                  <span>Total</span>
                  <span>{formatPortalCurrency(state.total)}</span>
                </div>
              </div>
            )}

            {decided && (
              <p style={{ color: state.current_decision === 'approved' ? '#22c55e' : '#f59e0b', fontWeight: 600, fontSize: '0.875rem' }}>
                {state.current_decision === 'approved'
                  ? `Approved by ${state.signer_name || 'you'}${state.decided_at ? ` on ${format(parseISO(state.decided_at), 'MMM d, yyyy')}` : ''}`
                  : `Declined${state.decided_at ? ` on ${format(parseISO(state.decided_at), 'MMM d, yyyy')}` : ''}`}
                {state.decline_reason ? ` — ${state.decline_reason}` : ''}
              </p>
            )}

            {canAct && !mode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setMode('approve')}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#22d3ee',
                    color: '#0A0F1E',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Approve estimate
                </button>
                <button
                  type="button"
                  onClick={() => setMode('decline')}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'transparent',
                    color: '#9ca3af',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Decline
                </button>
              </div>
            )}

            {canAct && mode === 'approve' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                  Your name
                  <input
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  />
                </label>
                <div>
                  <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: 4 }}>Sign with your finger</p>
                  <SignaturePad onChange={setSignature} />
                </div>
                <button
                  type="button"
                  disabled={submitting || !signerName.trim() || !signature}
                  onClick={submitApprove}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#22d3ee',
                    color: '#0A0F1E',
                    fontWeight: 700,
                    opacity: submitting || !signerName.trim() || !signature ? 0.5 : 1,
                    cursor: 'pointer',
                  }}
                >
                  {submitting ? 'Saving…' : 'Submit approval'}
                </button>
              </div>
            )}

            {canAct && mode === 'decline' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                  Reason (optional)
                  <textarea
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  />
                </label>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={submitDecline}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#f59e0b',
                    color: '#0A0F1E',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {submitting ? 'Saving…' : 'Submit decline'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
