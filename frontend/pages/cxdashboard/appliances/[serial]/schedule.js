import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { format, parseISO } from 'date-fns';
import { FaArrowLeft, FaCalendarAlt, FaCheckCircle, FaPhone } from 'react-icons/fa';
import DashboardLayout from '../../../../components/cxdashboard/DashboardLayout';
import ApplianceIcon from '../../../../components/cxdashboard/ApplianceIcon';
import { applianceDisplayName } from '../../../../constants/applianceEquipment';
import {
  getSymptomsForEquipmentSubtype,
  BOOKING_GENERIC_SYMPTOMS,
} from '../../../../constants/applianceSymptoms';
import { getPortalSessionToken, portalFetch } from '../../../../utils/portalFetch';
import PortalSquarePayment from '../../../../components/cxdashboard/PortalSquarePayment';

const STEPS = ['Issue', 'Date & Time', 'Review', 'Confirmed'];
const SUPPORT_PHONE = '(419) 740-0146';
const SUPPORT_TEL = 'tel:+14197400146';
const PREP_STALE_MS = 5 * 60 * 1000;

function formatCurrency(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

const WINDOW_LABELS = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

function StepIndicator({ current }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div
            key={label}
            style={{
              flex: '1 1 0',
              minWidth: '70px',
              textAlign: 'center',
              padding: '0.5rem 0.25rem',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: '600',
              background: active ? 'rgba(0,212,255,0.12)' : done ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)',
              color: active ? '#22d3ee' : done ? '#22c55e' : '#6b7280',
              border: `1px solid ${active ? 'rgba(0,212,255,0.25)' : done ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}`,
            }}
          >
            {done ? '✓ ' : ''}{label}
          </div>
        );
      })}
    </div>
  );
}

function RequestUpdatePanel({ applianceId, orderNumber, onSuccess }) {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const token = await getPortalSessionToken();
      await portalFetch('schedule/request-update', token, {
        method: 'POST',
        body: JSON.stringify({ appliance_id: applianceId, message }),
      });
      setSent(true);
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '10px', padding: '1rem', color: '#22c55e', fontSize: '0.9rem' }}>
        Your update request was sent. Our team will reach out shortly.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
      <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
        Order #{orderNumber} is already open for this appliance. Send us a message and we&apos;ll update your request.
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Describe what changed or what you'd like us to know..."
        rows={4}
        required
        style={{
          width: '100%', background: '#0a0f1a', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px', padding: '0.75rem', color: '#fff', fontSize: '0.875rem', resize: 'vertical',
        }}
      />
      {error && <p style={{ color: '#ef4444', fontSize: '0.8125rem', marginTop: '0.5rem' }}>{error}</p>}
      <button
        type="submit"
        disabled={submitting || !message.trim()}
        style={{
          marginTop: '0.75rem', background: '#22d3ee', color: '#0a0f1a', border: 'none',
          borderRadius: '8px', padding: '0.625rem 1.25rem', fontWeight: '700', fontSize: '0.875rem',
          cursor: submitting ? 'wait' : 'pointer', opacity: submitting || !message.trim() ? 0.6 : 1,
        }}
      >
        {submitting ? 'Sending...' : 'Request Update'}
      </button>
    </form>
  );
}

export default function ScheduleAppliancePage() {
  const router = useRouter();
  const { serial } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [appliance, setAppliance] = useState(null);
  const [profile, setProfile] = useState(null);
  const [schedulingStatus, setSchedulingStatus] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [schedulingContext, setSchedulingContext] = useState(null);
  const [schedulingConfig, setSchedulingConfig] = useState(null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepLoadedAt, setPrepLoadedAt] = useState(null);

  const [step, setStep] = useState(0);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [issueDescription, setIssueDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedWindow, setSelectedWindow] = useState(null);
  const [priorityRequested, setPriorityRequested] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [paymentFormReady, setPaymentFormReady] = useState(false);
  const squarePaymentRef = useRef(null);
  const handleSquareError = useCallback((msg) => setConfirmError(msg), []);
  const handleSquareReady = useCallback((isReady) => setPaymentFormReady(Boolean(isReady)), []);

  const applianceId = appliance?.id;

  const symptomOptions = useMemo(() => {
    if (!appliance) return BOOKING_GENERIC_SYMPTOMS;
    return (
      getSymptomsForEquipmentSubtype(appliance.equipment_subtype, appliance.equipment_type)
      || BOOKING_GENERIC_SYMPTOMS
    );
  }, [appliance]);

  const loadInitial = useCallback(async () => {
    if (!serial) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getPortalSessionToken();
      const applianceData = await portalFetch(`appliances/${encodeURIComponent(serial)}?include_history=false`, token);
      const [me, status, schedCfg] = await Promise.all([
        portalFetch('me', token),
        portalFetch(`schedule/status/${encodeURIComponent(applianceData.id)}`, token),
        portalFetch('scheduling-config', token),
      ]);
      setAppliance(applianceData);
      setProfile(me);
      setSchedulingStatus(status);
      setSchedulingConfig(schedCfg);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [serial]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const canStartScheduling = Boolean(
    applianceId
    && !loading
    && profile?.self_scheduling_allowed
    && appliance?.scheduling_ready
    && schedulingStatus?.can_schedule
  );

  const fetchSchedulePrep = useCallback(async () => {
    const token = await getPortalSessionToken();
    const prep = await portalFetch(`schedule/prep/${applianceId}`, token);
    setAvailability(prep.availability);
    setEstimate(prep.estimate);
    setSchedulingContext(prep.scheduling_context || schedulingConfig?.scheduling_context || null);
    setPrepLoadedAt(Date.now());
    return prep;
  }, [applianceId, schedulingConfig]);

  // Prefetch pricing + calendar while the client picks symptoms.
  useEffect(() => {
    if (!canStartScheduling || !applianceId) return undefined;
    let cancelled = false;
    (async () => {
      setPrepLoading(true);
      try {
        await fetchSchedulePrep();
      } catch (err) {
        if (!cancelled) console.error('Schedule prep prefetch failed:', err);
      } finally {
        if (!cancelled) setPrepLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [canStartScheduling, applianceId, fetchSchedulePrep]);

  function toggleSymptom(symptom) {
    setSelectedSymptoms((prev) => (
      prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom]
    ));
  }

  async function reloadAvailability() {
    setPrepLoading(true);
    try {
      const prep = await fetchSchedulePrep();
      return prep.availability;
    } finally {
      setPrepLoading(false);
    }
  }

  async function goToDateStep() {
    if (selectedSymptoms.length === 0 && !issueDescription.trim()) {
      setConfirmError('Please select at least one symptom or describe the issue.');
      return;
    }
    setConfirmError(null);

    const prepFresh = prepLoadedAt && Date.now() - prepLoadedAt <= PREP_STALE_MS;
    let avail = prepFresh ? availability : null;

    if (!avail) {
      setPrepLoading(true);
      try {
        const prep = await fetchSchedulePrep();
        avail = prep.availability;
      } catch (err) {
        setConfirmError(err.message);
        return;
      } finally {
        setPrepLoading(false);
      }
    }

    if (!avail.serviceable) {
      setConfirmError(avail.service_area_message || 'This address is outside our service area.');
      return;
    }
    if (!avail.days?.length) {
      setConfirmError(`No openings available. Please call ${SUPPORT_PHONE}.`);
      return;
    }
    setStep(1);
  }

  const selectedDay = availability?.days?.find((d) => d.date === selectedDate);
  const availableWindows = selectedDay?.windows?.filter((w) => w.available) || [];

  const isSameDaySelected = Boolean(
    selectedDate && schedulingContext?.shop_date && selectedDate === schedulingContext.shop_date
  );
  const needsApproval = isSameDaySelected;
  const paymentRequired = Boolean(
    schedulingConfig?.payment_required
    && schedulingConfig?.square?.configured
    && !(schedulingStatus?.reschedule_denied_request && schedulingStatus?.prior_payment_captured)
  );
  const squarePublic = schedulingConfig?.square || {};
  const priorityAvailable = Boolean(
    schedulingConfig?.priority_service_enabled
    && (schedulingContext?.priority_service_open || schedulingContext?.standard_same_day_open)
  );

  const applePayEnabled = Boolean(
    schedulingConfig?.apple_pay_enabled !== false
    && schedulingConfig?.payment_required
    && schedulingConfig?.square?.configured
  );

  async function submitScheduleWithPayment(squareSourceId) {
    const token = await getPortalSessionToken();
    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}`;

    const body = {
      appliance_id: applianceId,
      scheduled_date: selectedDate,
      time_window: selectedWindow,
      symptoms: selectedSymptoms,
      issue_description: issueDescription.trim() || null,
      square_source_id: squareSourceId,
      payment_idempotency_key: idempotencyKey,
    };

    const endpoint = needsApproval ? 'schedule/request' : 'schedule/confirm';
    if (needsApproval) {
      body.priority_requested = priorityRequested;
    }

    return portalFetch(endpoint, token, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async function handleWalletPayment(sourceId) {
    setConfirmError(null);
    setConfirming(true);
    try {
      const result = await submitScheduleWithPayment(sourceId);
      setConfirmation(result);
      setStep(3);
    } catch (err) {
      setConfirmError(err.message);
      if (err.message?.includes('no longer available')) {
        await reloadAvailability();
        setStep(1);
      }
      throw err;
    } finally {
      setConfirming(false);
    }
  }

  async function handleConfirm() {
    setConfirmError(null);

    if (paymentRequired && !squarePaymentRef.current?.isReady?.()) {
      setConfirmError('Payment form is still loading. Please wait a moment and try again.');
      return;
    }

    try {
      let squareSourceId = null;

      if (paymentRequired) {
        squareSourceId = await squarePaymentRef.current.tokenize();
      }

      setConfirming(true);
      const result = await submitScheduleWithPayment(squareSourceId);
      setConfirmation(result);
      setStep(3);
    } catch (err) {
      setConfirmError(err.message);
      if (err.message?.includes('no longer available')) {
        await reloadAvailability();
        setStep(1);
      }
    } finally {
      setConfirming(false);
    }
  }

  const displayName = appliance ? applianceDisplayName(appliance) : 'Schedule Service';
  const blocked = profile && !profile.self_scheduling_allowed;
  const hasOpenWo = schedulingStatus && !schedulingStatus.can_schedule;
  const notReady = appliance && !appliance.scheduling_ready;

  return (
    <>
      <Head><title>Schedule Service | {displayName} | Atomic Repair</title></Head>
      <div className="space-y-6">
        <Link
          href={`/cxdashboard/appliances/${encodeURIComponent(serial || '')}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280', fontSize: '0.875rem', textDecoration: 'none' }}
          className="hover:text-white"
        >
          <FaArrowLeft style={{ fontSize: '12px' }} />
          Back to Appliance
        </Link>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#ef4444' }}>{error}</div>
        ) : (
          <>
            <div style={{ background: '#0D1525', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ background: 'rgba(0,212,255,0.08)', borderRadius: '10px', padding: '10px' }}>
                <ApplianceIcon type={appliance?.equipment_subtype || appliance?.equipment_type} className="w-8 h-8" />
              </div>
              <div>
                <h1 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: '700', margin: 0, textTransform: 'capitalize' }}>
                  Schedule Service
                </h1>
                <p style={{ color: '#9ca3af', margin: '2px 0 0', fontSize: '0.875rem' }}>{displayName}</p>
              </div>
            </div>

            {blocked ? (
              <div style={{ background: '#0D1525', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
                <FaPhone style={{ color: '#f59e0b', fontSize: '1.5rem', marginBottom: '0.75rem' }} />
                <p style={{ color: '#fff', fontWeight: '600', marginBottom: '0.5rem' }}>Online scheduling isn&apos;t available</p>
                <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  Please call us to schedule service for this account.
                </p>
                <a href={SUPPORT_TEL} style={{ color: '#22d3ee', fontWeight: '700', fontSize: '1.125rem', textDecoration: 'none' }}>
                  {SUPPORT_PHONE}
                </a>
              </div>
            ) : notReady ? (
              <div style={{ background: '#0D1525', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '1.5rem' }}>
                <p style={{ color: '#fff', fontWeight: '600', marginBottom: '0.5rem' }}>Appliance not ready to schedule</p>
                <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
                  We need the appliance type, subtype, make, and a service address on file before you can book online.
                </p>
              </div>
            ) : hasOpenWo ? (
              <div style={{ background: '#0D1525', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '12px', padding: '1.5rem' }}>
                <p style={{ color: '#fff', fontWeight: '600', marginBottom: '0.25rem' }}>Open service request</p>
                <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  {schedulingStatus.blocked_message}
                </p>
                <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                  Need help sooner? Call{' '}
                  <a href={SUPPORT_TEL} style={{ color: '#22d3ee', textDecoration: 'none' }}>{SUPPORT_PHONE}</a>
                </p>
                <RequestUpdatePanel
                  applianceId={applianceId}
                  orderNumber={schedulingStatus.open_work_order_number}
                />
              </div>
            ) : (
              <>
                {schedulingStatus?.reschedule_denied_request && (
                  <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
                    <p style={{ color: '#93c5fd', fontWeight: '600', margin: '0 0 0.25rem', fontSize: '0.9rem' }}>
                      Pick a new appointment day
                    </p>
                    <p style={{ color: '#9ca3af', margin: 0, fontSize: '0.8125rem' }}>
                      Your same-day request wasn&apos;t approved
                      {schedulingStatus.open_work_order_number ? ` (#${schedulingStatus.open_work_order_number})` : ''}.
                      {' '}Choose another date below — your service request stays open.
                    </p>
                  </div>
                )}
                <StepIndicator current={step} />

                {step === 0 && (
                  <div style={{ background: '#0D1525', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '1.5rem' }}>
                    <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem' }}>What&apos;s going on?</h2>
                    <p style={{ color: '#6b7280', fontSize: '0.8125rem', marginBottom: '1rem' }}>Select all symptoms that apply.</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                      {symptomOptions.map((symptom) => {
                        const selected = selectedSymptoms.includes(symptom);
                        return (
                          <button
                            key={symptom}
                            type="button"
                            onClick={() => toggleSymptom(symptom)}
                            style={{
                              background: selected ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${selected ? 'rgba(0,212,255,0.35)' : 'rgba(255,255,255,0.08)'}`,
                              color: selected ? '#22d3ee' : '#d1d5db',
                              borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', cursor: 'pointer',
                            }}
                          >
                            {symptom}
                          </button>
                        );
                      })}
                    </div>
                    <label style={{ display: 'block', color: '#6b7280', fontSize: '0.75rem', marginBottom: '0.375rem' }}>
                      Additional details (optional)
                    </label>
                    <textarea
                      value={issueDescription}
                      onChange={(e) => setIssueDescription(e.target.value)}
                      rows={3}
                      placeholder="Anything else we should know?"
                      style={{
                        width: '100%', background: '#0a0f1a', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px', padding: '0.75rem', color: '#fff', fontSize: '0.875rem', resize: 'vertical',
                      }}
                    />
                    {confirmError && <p style={{ color: '#ef4444', fontSize: '0.8125rem', marginTop: '0.75rem' }}>{confirmError}</p>}
                    {prepLoading && (
                      <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.75rem' }}>
                        Loading available times…
                      </p>
                    )}
                    {!prepLoading && availability?.days?.length > 0 && (
                      <p style={{ color: '#22c55e', fontSize: '0.75rem', marginTop: '0.75rem' }}>
                        Times are ready — pick Continue when you&apos;re done.
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={goToDateStep}
                      disabled={prepLoading}
                      style={{
                        marginTop: '1rem', background: '#22d3ee', color: '#0a0f1a', border: 'none',
                        borderRadius: '8px', padding: '0.75rem 1.5rem', fontWeight: '700',
                        cursor: prepLoading ? 'wait' : 'pointer', opacity: prepLoading ? 0.7 : 1,
                      }}
                    >
                      {prepLoading ? 'Loading times…' : 'Continue'}
                    </button>
                  </div>
                )}

                {step === 1 && (
                  <div style={{ background: '#0D1525', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '1.5rem' }}>
                    <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FaCalendarAlt style={{ color: '#22d3ee' }} /> Pick a date &amp; window
                    </h2>
                    <p style={{ color: '#6b7280', fontSize: '0.8125rem', marginBottom: '1rem' }}>
                      Pick a date and window. Tomorrow and later confirm instantly; same-day needs a quick team review.
                    </p>
                    {schedulingContext?.message && (
                      <p style={{ color: '#f59e0b', fontSize: '0.8125rem', marginBottom: '1rem' }}>
                        {schedulingContext.message}
                      </p>
                    )}

                    {!availability?.serviceable ? (
                      <p style={{ color: '#f59e0b' }}>{availability?.service_area_message || 'Loading availability...'}</p>
                    ) : availability.days?.length === 0 ? (
                      <p style={{ color: '#f59e0b' }}>No openings in the next few weeks. Please call {SUPPORT_PHONE}.</p>
                    ) : (
                      <>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
                          {availability.days.map((day) => {
                            const active = selectedDate === day.date;
                            return (
                              <button
                                key={day.date}
                                type="button"
                                onClick={() => { setSelectedDate(day.date); setSelectedWindow(null); }}
                                style={{
                                  background: active ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.04)',
                                  border: `1px solid ${active ? 'rgba(0,212,255,0.35)' : 'rgba(255,255,255,0.08)'}`,
                                  color: active ? '#22d3ee' : '#d1d5db',
                                  borderRadius: '8px', padding: '0.625rem 0.875rem', fontSize: '0.8125rem', cursor: 'pointer',
                                }}
                              >
                                {format(parseISO(day.date), 'EEE, MMM d')}
                              </button>
                            );
                          })}
                        </div>

                        {selectedDate && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <p style={{ color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time window</p>
                            {availableWindows.length === 0 ? (
                              <p style={{ color: '#f59e0b', fontSize: '0.875rem' }}>No windows available this day — pick another date.</p>
                            ) : (
                              availableWindows.map((w) => {
                                const active = selectedWindow === w.name;
                                return (
                                  <button
                                    key={w.name}
                                    type="button"
                                    onClick={() => setSelectedWindow(w.name)}
                                    style={{
                                      textAlign: 'left', background: active ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.03)',
                                      border: `1px solid ${active ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.07)'}`,
                                      borderRadius: '10px', padding: '0.875rem 1rem', cursor: 'pointer',
                                    }}
                                  >
                                    <div style={{ color: active ? '#22d3ee' : '#fff', fontWeight: '600', fontSize: '0.9rem' }}>
                                      {WINDOW_LABELS[w.name] || w.name}
                                      <span style={{ color: '#9ca3af', fontWeight: '400', marginLeft: '0.5rem' }}>{w.display_range}</span>
                                    </div>
                                    {w.narrowing_note && (
                                      <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '4px 0 0' }}>{w.narrowing_note}</p>
                                    )}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </>
                    )}

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                      <button type="button" onClick={() => setStep(0)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#9ca3af', borderRadius: '8px', padding: '0.75rem 1.25rem', cursor: 'pointer' }}>
                        Back
                      </button>
                      <button
                        type="button"
                        disabled={!selectedDate || !selectedWindow}
                        onClick={() => setStep(2)}
                        style={{
                          background: '#22d3ee', color: '#0a0f1a', border: 'none', borderRadius: '8px',
                          padding: '0.75rem 1.5rem', fontWeight: '700', cursor: 'pointer',
                          opacity: !selectedDate || !selectedWindow ? 0.5 : 1,
                        }}
                      >
                        Review
                      </button>
                    </div>
                  </div>
                )}

                {step === 2 && estimate && (
                  <div style={{ background: '#0D1525', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '1.5rem' }}>
                    <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>Review &amp; confirm</h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem', fontSize: '0.875rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                        <span style={{ color: '#6b7280' }}>Date</span>
                        <span style={{ color: '#fff', fontWeight: '600' }}>{selectedDate && format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                        <span style={{ color: '#6b7280' }}>Window</span>
                        <span style={{ color: '#fff', fontWeight: '600', textTransform: 'capitalize' }}>{WINDOW_LABELS[selectedWindow] || selectedWindow}</span>
                      </div>
                      {selectedSymptoms.length > 0 && (
                        <div>
                          <span style={{ color: '#6b7280', display: 'block', marginBottom: '0.375rem' }}>Symptoms</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                            {selectedSymptoms.map((s) => (
                              <span key={s} style={{ background: 'rgba(255,255,255,0.05)', color: '#d1d5db', borderRadius: '6px', padding: '2px 8px', fontSize: '0.75rem' }}>{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
                      {estimate.diagnostic && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                          <span style={{ color: '#9ca3af' }}>{estimate.diagnostic.name}</span>
                          <span style={{ color: '#fff' }}>{formatCurrency(estimate.diagnostic.price)}</span>
                        </div>
                      )}
                      {estimate.trip_charge?.amount != null && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                          <span style={{ color: '#9ca3af' }}>Trip charge ({estimate.trip_charge.zone_name})</span>
                          <span style={{ color: '#fff' }}>{formatCurrency(estimate.trip_charge.amount)}</span>
                        </div>
                      )}
                      {estimate.estimated_total != null && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.08)', fontWeight: '700' }}>
                          <span style={{ color: '#22d3ee' }}>Estimated total</span>
                          <span style={{ color: '#22d3ee', fontSize: '1.125rem' }}>{formatCurrency(estimate.estimated_total)}</span>
                        </div>
                      )}
                      {estimate.note && (
                        <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '0.75rem 0 0' }}>{estimate.note}</p>
                      )}
                    </div>

                    {isSameDaySelected && priorityAvailable && (
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={priorityRequested}
                          onChange={(e) => setPriorityRequested(e.target.checked)}
                          style={{ marginTop: '0.2rem' }}
                        />
                        <span style={{ color: '#d1d5db', fontSize: '0.875rem' }}>
                          <strong style={{ color: '#f59e0b' }}>Priority service</strong>
                          {' '}— higher diagnostic/trip rates. We&apos;ll review before confirming.
                        </span>
                      </label>
                    )}

                    {paymentRequired && (
                      <div style={{ marginBottom: '1rem' }}>
                        <p style={{ color: '#9ca3af', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
                          Payment required to {needsApproval ? 'submit this request' : 'confirm'}.
                          {applePayEnabled ? ' Use Apple Pay or enter a card below.' : ''}
                        </p>
                        <PortalSquarePayment
                          ref={squarePaymentRef}
                          applicationId={squarePublic.square_application_id}
                          locationId={squarePublic.square_location_id}
                          environment={squarePublic.square_environment}
                          amount={estimate?.estimated_total}
                          amountLabel="Atomic Repair service"
                          applePayEnabled={applePayEnabled}
                          onError={handleSquareError}
                          onReady={handleSquareReady}
                          onWalletToken={handleWalletPayment}
                          disabled={confirming}
                        />
                        {paymentRequired && !paymentFormReady && (
                          <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.35rem' }}>
                            Wait for the card form to finish loading before confirming.
                          </p>
                        )}
                      </div>
                    )}

                    {confirmError && <p style={{ color: '#ef4444', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>{confirmError}</p>}

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button type="button" onClick={() => setStep(1)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#9ca3af', borderRadius: '8px', padding: '0.75rem 1.25rem', cursor: 'pointer' }}>
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={confirming || (paymentRequired && !paymentFormReady)}
                        style={{
                          flex: 1, background: '#22c55e', color: '#0a0f1a', border: 'none', borderRadius: '8px',
                          padding: '0.875rem 1.5rem', fontWeight: '700', cursor: confirming ? 'wait' : 'pointer',
                          opacity: confirming || (paymentRequired && !paymentFormReady) ? 0.5 : 1,
                        }}
                      >
                        {confirming
                          ? (needsApproval ? 'Submitting...' : 'Confirming...')
                          : (needsApproval ? 'Submit Request' : 'Confirm Appointment')}
                      </button>
                    </div>
                  </div>
                )}

                {step === 3 && confirmation && (
                  <div style={{ background: '#0D1525', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '12px', padding: '2rem', textAlign: 'center' }}>
                    <FaCheckCircle style={{ color: '#22c55e', fontSize: '2.5rem', marginBottom: '1rem' }} />
                    <h2 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                      {confirmation?.pending_approval ? 'Request submitted!' : 'You\'re scheduled!'}
                    </h2>
                    <p style={{ color: '#9ca3af', marginBottom: '0.25rem' }}>
                      Order #{confirmation.order_number}
                    </p>
                    {confirmation?.pending_approval ? (
                      <p style={{ color: '#d1d5db', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                        {confirmation.message || 'We\'ll confirm as soon as possible.'}
                      </p>
                    ) : (
                      <>
                        <p style={{ color: '#d1d5db', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                          {selectedDate && format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')}
                          {confirmation.window_display && ` · ${confirmation.window_display}`}
                        </p>
                        {confirmation.narrowing_note && (
                          <p style={{ color: '#6b7280', fontSize: '0.8125rem', marginBottom: '1.25rem' }}>{confirmation.narrowing_note}</p>
                        )}
                      </>
                    )}
                    {confirmation.estimated_total != null && (
                      <p style={{ color: '#22d3ee', fontWeight: '600', marginBottom: '1.5rem' }}>
                        Estimated total: {formatCurrency(confirmation.estimated_total)}
                      </p>
                    )}
                    <Link
                      href="/cxdashboard/repairs"
                      style={{
                        display: 'inline-block', background: '#22d3ee', color: '#0a0f1a',
                        borderRadius: '8px', padding: '0.75rem 1.5rem', fontWeight: '700', textDecoration: 'none',
                      }}
                    >
                      View My Repairs
                    </Link>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

ScheduleAppliancePage.getLayout = function getLayout(page) {
  return <DashboardLayout title="Schedule Service">{page}</DashboardLayout>;
};
