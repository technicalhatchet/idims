import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { format, parseISO } from 'date-fns';
import { FaCalendarAlt, FaClock, FaMapMarkerAlt, FaUser, FaTasks, FaTimes, FaWrench } from 'react-icons/fa';
import Link from 'next/link';
import StatusBadge from '../ui/StatusBadge';

function DetailRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-500/25 bg-cyan-950/30 text-cyan-400">
        <Icon className="h-3 w-3" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        {label && (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">
            {label}
          </p>
        )}
        <div className="text-[13px] text-gray-200 leading-snug">{children}</div>
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        className="relative z-[1] w-full max-w-[min(100%,22rem)] max-h-[min(78vh,520px)] overflow-hidden flex flex-col rounded-[18px] border border-cyan-400/35 bg-[rgba(5,12,22,.96)] shadow-[0_0_40px_rgba(0,212,255,.18)]"
      >
        <div className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-40 bg-[linear-gradient(rgba(0,217,255,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(0,217,255,.07)_1px,transparent_1px)] bg-[size:42px_42px]" />
        <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-cyan-400/15 to-transparent" />

        <div className="relative shrink-0 px-3.5 pt-3 pb-2.5 border-b border-white/10">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300/90">
                {isAppointment ? 'Appointment' : 'Work order'}
              </p>
              <h2 className="text-base font-bold text-white truncate">{headline}</h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={event.status} />
                {isAppointment && (
                  <span className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-cyan-300">
                    {typeLabel}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-[#0D1525] text-gray-400 active:bg-white/5"
              aria-label="Close"
            >
              <FaTimes className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="relative flex-1 overflow-y-auto px-3.5 py-3 space-y-0.5">
          <DetailRow icon={FaCalendarAlt} label="Date">
            {event.start ? format(parseISO(event.start), 'EEE, MMM d, yyyy') : 'Not scheduled'}
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
            <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                Description
              </p>
              <p className="text-[13px] text-gray-300 whitespace-pre-line leading-relaxed">
                {event.description}
              </p>
            </div>
          )}
        </div>

        <div className="relative shrink-0 border-t border-white/10 px-3 py-2.5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 shrink-0 rounded-lg border border-white/15 px-3 text-[10px] font-semibold uppercase tracking-wide text-gray-300"
          >
            Close
          </button>
          {workOrderId && (
            <Link
              href={`/work_orders/${workOrderId}/mobile`}
              className="flex-1 h-9 rounded-lg bg-gradient-to-br from-cyan-600 to-cyan-700 flex items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-white shadow-[0_0_16px_rgba(34,211,238,0.2)] active:scale-[0.98]"
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
