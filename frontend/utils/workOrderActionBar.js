/**
 * Decides what the work order bottom bar shows.
 *
 * Rule: while you're on a visit, the bar follows the VISIT (appointment) status.
 * The rest of the time it follows the JOB (work order) status.
 * Mirrors backend work_order_status_sync_service._pick_driver_appointment_today.
 */
import { DIAGNOSTIC_RESULTS_NOTE_TYPE } from '../constants/workOrderNoteTypes';
import { parseScheduleUtcMs } from './schedule-time';

const VISIT_ACTIVE = ['in_progress', 'phone_payment', 'en_route'];

function statusOf(x) {
  const raw = x && typeof x === 'object' ? x.status : x;
  const v = raw && typeof raw === 'object' && raw.value != null ? raw.value : raw;
  return String(v || '').toLowerCase();
}

// API times may arrive without a zone; they are UTC (see utils/schedule-time).
function isSameLocalDay(value, now) {
  if (!value) return false;
  const ms = value instanceof Date ? value.getTime() : parseScheduleUtcMs(value);
  if (!Number.isFinite(ms)) return false;
  const d = new Date(ms);
  return (
    d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate()
  );
}

function startMs(a) {
  const ms = parseScheduleUtcMs(a?.scheduled_start);
  return Number.isFinite(ms) ? ms : 0;
}

function byStart(a, b) {
  return startMs(a) - startMs(b);
}

/** The visit the bar should follow, or null when the job should drive it. */
export function pickDriverVisit(appointments, now = new Date()) {
  const list = Array.isArray(appointments) ? [...appointments].sort(byStart) : [];
  if (!list.length) return null;
  const today = list.filter((a) => isSameLocalDay(a.scheduled_start, now));

  // 1. A visit in motion today.
  for (const s of VISIT_ACTIVE) {
    const hit = today.find((a) => statusOf(a) === s);
    if (hit) return hit;
  }
  // 2. A visit left in motion on another day (don't strand it).
  for (const s of VISIT_ACTIVE) {
    const hit = list.find((a) => statusOf(a) === s);
    if (hit) return hit;
  }
  // 3. Today's visit couldn't reach the client.
  const unreachable = today.find((a) => statusOf(a) === 'unreachable');
  if (unreachable) return unreachable;
  // 4. Today's next stop.
  const scheduled = today.find((a) => statusOf(a) === 'scheduled');
  if (scheduled) return scheduled;
  return null;
}

/** True when a Diagnostic Results note exists for this visit (or today, if notes aren't visit-tagged). */
export function hasDiagnosticForVisit(notes, visit, now = new Date()) {
  if (!Array.isArray(notes) || !notes.length) return false;
  const prefix = `[${DIAGNOSTIC_RESULTS_NOTE_TYPE}]`;
  return notes.some((n) => {
    if (typeof n?.note !== 'string' || !n.note.startsWith(prefix)) return false;
    if (visit?.id && n.appointment_id) return String(n.appointment_id) === String(visit.id);
    return isSameLocalDay(n.created_at, now);
  });
}

function hasEquipmentCaptured(workOrder) {
  const model = String(workOrder?.equipment_model || '').trim();
  const serial = String(workOrder?.equipment_serial || '').trim();
  return Boolean(model && serial);
}

function partsStillNeedOrdering(workOrder) {
  const parts = Array.isArray(workOrder?.parts) ? workOrder.parts : [];
  return parts.some((p) => statusOf(p) === 'needed');
}

const A = {
  // primary actions
  startRoute: { id: 'start_route', label: 'Start Route', tone: 'cyan', icon: 'route' },
  arrived: { id: 'arrived', label: 'Arrived', tone: 'cyan', icon: 'pin' },
  prepay: { id: 'payment', label: 'Prepay', tone: 'orange', icon: 'card' },
  startWork: { id: 'start_work', label: 'Start Work', tone: 'cyan', icon: 'wrench' },
  addModel: { id: 'equipment', label: 'Add Model', tone: 'cyan', icon: 'scan' },
  diagnose: { id: 'diagnose', label: 'Diagnose', tone: 'cyan', icon: 'search' },
  wrapUp: { id: 'wrap_up', label: 'Wrap Up', tone: 'cyan', icon: 'flag' },
  callAgain: { id: 'call', label: 'Call Again', tone: 'cyan', icon: 'call' },
  call: { id: 'call', label: 'Call', tone: 'cyan', icon: 'call' },
  bookVisit: { id: 'schedule', label: 'Book Visit', tone: 'cyan', icon: 'calendar' },
  bookReturn: { id: 'schedule', label: 'Book Return', tone: 'cyan', icon: 'calendar' },
  viewVisit: { id: 'view_visit', label: 'View Visit', tone: 'cyan', icon: 'calendar' },
  orderParts: { id: 'order_parts', label: 'Order Parts', tone: 'orange', icon: 'box' },
  partsIn: { id: 'parts_in', label: 'Parts In', tone: 'orange', icon: 'box' },
  estimate: { id: 'estimate', label: 'Estimate', tone: 'orange', icon: 'send' },
  payment: { id: 'payment', label: 'Payment', tone: 'orange', icon: 'card' },
  closeJob: { id: 'close', label: 'Close Job', tone: 'red', icon: 'lock' },
  summary: { id: 'summary', label: 'Summary', tone: 'cyan', icon: 'doc' },
  readOnly: { id: 'none', label: 'Read Only', tone: 'off', icon: 'lock' },
  // secondary actions (icon-only)
  sCall: { id: 'call', label: 'Call client', icon: 'call' },
  sText: { id: 'text', label: 'Text client', icon: 'text' },
  sNavigate: { id: 'navigate', label: 'Navigate', icon: 'route' },
  sPhoto: { id: 'photo', label: 'Add photo', icon: 'photo' },
  sPart: { id: 'add_part', label: 'Add part', icon: 'box' },
  sRecordPayment: { id: 'record_payment', label: 'Record cash or check', icon: 'cash' },
  sStartWork: { id: 'start_work', label: 'Start work', icon: 'wrench' },
  sSummary: { id: 'summary', label: 'Summary PDF', icon: 'doc' },
};

/**
 * @returns {{ reads: 'visit'|'job', visit: object|null, primary: object, secondary: object }}
 */
export function resolveWorkOrderActionBar({
  workOrder,
  notes = null,
  dueToday = 0,
  readOnly = false,
  canClose = false,
  now = new Date(),
} = {}) {
  const jobStatus = statusOf(workOrder);

  if (readOnly) {
    return { reads: 'job', visit: null, primary: A.readOnly, secondary: A.sSummary };
  }

  const visit = pickDriverVisit(workOrder?.appointments, now);
  if (visit) {
    const s = statusOf(visit);
    const v = (primary, secondary) => ({ reads: 'visit', visit, primary, secondary });
    if (s === 'scheduled') return v(A.startRoute, A.sCall);
    if (s === 'en_route') return v(A.arrived, A.sNavigate);
    if (s === 'unreachable') return v(A.callAgain, A.sText);
    if (s === 'phone_payment') {
      return Number(dueToday) > 0 ? v(A.prepay, A.sStartWork) : v(A.startWork, A.sRecordPayment);
    }
    if (s === 'in_progress') {
      if (!hasEquipmentCaptured(workOrder)) return v(A.addModel, A.sPhoto);
      if (notes && !hasDiagnosticForVisit(notes, visit, now)) return v(A.diagnose, A.sPart);
      return v(A.wrapUp, A.sPhoto);
    }
  }

  const j = (primary, secondary) => ({ reads: 'job', visit: null, primary, secondary });
  switch (jobStatus) {
    case 'pending':
      return j(A.bookVisit, A.sCall);
    case 'need_to_contact':
    case 'on_hold':
      return j(A.call, A.sText);
    case 'unreachable':
      return j(A.callAgain, A.sText);
    case 'reschedule':
    case 'recall':
    case 'redo':
      return j(A.bookVisit, A.sText);
    case 'scheduled':
    case 'en_route':
    case 'in_progress':
      return j(A.viewVisit, A.sCall);
    case 'waiting_on_parts':
    case 'parts_on_order':
      return j(partsStillNeedOrdering(workOrder) ? A.orderParts : A.partsIn, A.sCall);
    case 'parts_received':
      return j(A.bookReturn, A.sCall);
    case 'pending_estimate_approval':
      return j(A.estimate, A.sCall);
    case 'completed_pending_payment':
      return j(A.payment, A.sRecordPayment);
    case 'completed':
      return canClose ? j(A.closeJob, A.sSummary) : j(A.summary, A.sCall);
    default:
      return j(A.summary, A.sCall);
  }
}
