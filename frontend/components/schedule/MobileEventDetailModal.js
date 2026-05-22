import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { format, parseISO } from 'date-fns';
import { FaCalendarAlt, FaClock, FaMapMarkerAlt, FaUser, FaTasks, FaTimes, FaWrench } from 'react-icons/fa';
import Link from 'next/link';
import StatusBadge from '../ui/StatusBadge';

function DetailRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-950/30 text-cyan-400">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        {label && (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">
            {label}
          </p>
        )}
        <div className="text-sm text-gray-200 leading-snug">{children}</div>
      </div>
    </div>
  );
}

function formatAppointmentType(type) {
  if (!type) return 'Appointment';
  return String(type).replace(/_/g, ' ');
}

export default function MobileEventDetailModal({ event, onClose }) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!event || typeof document === 'undefined') return null;

  const isAppointment = event.source === 'appointment';
  const workOrderId = event.work_order_id || (event.source === 'work_order' ? event.id : null);
  const headline = event.order_number
    ? `WO #${event.order_number}`
    : event.title || 'Untitled';
  const typeLabel = formatAppointmentType(event.appointment_type);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end sm:justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        className="relative z-[1] w-full sm:max-w-lg max-h-[88vh] overflow-hidden flex flex-col rounded-t-[22px] sm:rounded-[22px] border border-cyan-400/35 bg-[rgba(5,12,22,.96)] shadow-[0_0_40px_rgba(0,212,255,.18)]"
        style={{ paddingBottom: 'max(0px, env(safe-area-inset-bottom))' }}
      >
        <div className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-40 bg-[linear-gradient(rgba(0,217,255,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(0,217,255,.07)_1px,transparent_1px)] bg-[size:42px_42px]" />
        <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-cyan-400/15 to-transparent" />

        <div className="relative shrink-0 px-4 pt-3 pb-3 border-b border-white/10">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300/90">
                {isAppointment ? 'Appointment' : 'Work order'}
              </p>
              <h2 className="text-lg font-bold text-white truncate">{headline}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={event.status} />
                {isAppointment && (
                  <span className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-300">
                    {typeLabel}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/12 bg-[#0D1525] text-gray-400 active:bg-white/5"
              aria-label="Close"
            >
              <FaTimes className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative flex-1 overflow-y-auto px-4 py-4 space-y-1">
          <DetailRow icon={FaCalendarAlt} label="Date">
            {event.start ? format(parseISO(event.start), 'EEEE, MMMM d, yyyy') : 'Not scheduled'}
          </DetailRow>

          <DetailRow icon={FaClock} label="Time">
            {event.start ? format(parseISO(event.start), 'h:mm a') : '—'}
            {event.end ? ` – ${format(parseISO(event.end), 'h:mm a')}` : ' – TBD'}
          </DetailRow>

          {event.location && (
            <DetailRow icon={FaMapMarkerAlt} label="Location">
              {event.location}
            </DetailRow>
          )}

          {event.client_name && (
            <DetailRow icon={FaUser} label="Client">
              {event.client_name}
            </DetailRow>
          )}

          {event.technician_name && (
            <DetailRow icon={FaWrench} label="Technician">
              {event.technician_name}
            </DetailRow>
          )}

          {event.priority && (
            <DetailRow icon={FaTasks} label="Priority">
              <span className="capitalize">{event.priority}</span>
            </DetailRow>
          )}

          {event.description && (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                Description
              </p>
              <p className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">
                {event.description}
              </p>
            </div>
          )}
        </div>

        <div
          className="relative shrink-0 border-t border-white/10 bg-[#0B1120]/95 backdrop-blur-md px-3 pt-2 flex gap-2"
          style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="h-10 shrink-0 rounded-xl border border-white/15 px-4 text-[11px] font-semibold uppercase tracking-wide text-gray-300"
          >
            Close
          </button>
          {workOrderId && (
            <Link
              href={`/work_orders/${workOrderId}/mobile`}
              className="flex-1 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-cyan-700 flex items-center justify-center text-xs font-semibold uppercase tracking-wide text-white shadow-[0_0_20px_rgba(34,211,238,0.25)] active:scale-[0.98]"
              onClick={onClose}
            >
              View work order
            </Link>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
