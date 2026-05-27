import { useRouter } from 'next/router';
import { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import { getSession } from '@auth0/nextjs-auth0';
import { useUser } from '@auth0/nextjs-auth0/client';
import Head from 'next/head';
import Link from 'next/link';
import { format } from 'date-fns';
import { FaEdit, FaPrint, FaEllipsisH, FaExclamationTriangle, FaCalendarAlt, FaClipboardList, FaToolbox, FaUserAlt, FaFileInvoiceDollar, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import TechDashboardLayout from '../../../components/layouts/TechDashboardLayout';
import StatusBadge from '../../../components/ui/StatusBadge';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { useWorkOrder, useWorkOrderMutations } from '../../../hooks/useWorkOrders';
import { warmWorkOrderCache } from '../../../lib/offlineReads';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';
import { apiClient } from '../../../utils/api-client';
import { useTheme } from '../../../context/ThemeContext';
import AppointmentScheduler from '../../../components/work_orders/AppointmentScheduler';
import WorkOrderNotes from '../../../components/work_orders/WorkOrderNotes';
import EquipmentDetails from '../../../components/work_orders/EquipmentDetails';
import WorkOrderDebriefing from '../../../components/work_orders/WorkOrderDebriefing';
import WorkOrderPerformancePanel from '../../../components/work_orders/WorkOrderPerformancePanel';
import RecordPaymentSheet from '../../../components/work_orders/RecordPaymentSheet';
import { formatAppointmentStatus } from '../../../utils/appointmentStatusLabels';
import { useTechDashboardRail } from '../../../components/layouts/TechDashboardLayout';
import { useUserRole } from '../../../utils/auth0-helpers';

// Tabs for the detail page
const TABS = {
  DETAILS: 'details',
  APPOINTMENTS: 'appointments',
  NOTES: 'notes',
  MODEL: 'model',
  CLIENT: 'client',
  INVOICES: 'invoices'
};

const TAB_ITEMS = [
  { id: TABS.DETAILS, label: 'Details', Icon: FaClipboardList },
  { id: TABS.APPOINTMENTS, label: 'Appointments', Icon: FaCalendarAlt },
  { id: TABS.NOTES, label: 'Notes', Icon: FaClipboardList },
  { id: TABS.MODEL, label: 'Equipment', Icon: FaToolbox },
  { id: TABS.CLIENT, label: 'Client', Icon: FaUserAlt },
  { id: TABS.INVOICES, label: 'Billing', Icon: FaFileInvoiceDollar },
];

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function computeMobileBillingTotals(workOrder, allServices, halfDiagnosticDiscount) {
  if (!workOrder) {
    return { dueToday: 0, taxOnBillableParts: 0, totalWorkOrder: 0, previouslyPaid: 0 };
  }
  const taxRate = parseFloat(workOrder.tax_rate || 0.0775);
  const hasRepairSku = (allServices || []).some(
    (s) => s.name?.toLowerCase().includes('repair') || s.service_definition?.service_type === 'repair'
  );
  const repairCompleted = (workOrder.appointments || []).some(
    (a) => a.appointment_type === 'repair' && a.status === 'completed'
  );
  const discountAmt =
    hasRepairSku && workOrder?.diagnostic_discount_amount > 0
      ? halfDiagnosticDiscount
        ? round2(workOrder.diagnostic_discount_amount * 0.5)
        : round2(workOrder.diagnostic_discount_amount)
      : 0;
  const billableServices = (allServices || [])
    .filter((s) => s.billing_status === 'billable')
    .reduce((sum, s) => sum + parseFloat(s.price || 0), 0);
  const billableParts = (workOrder.parts || [])
    .filter((p) => ['phone_payment', 'upfront_50', 'installed', 'paid_not_installed'].includes(p.status))
    .reduce((sum, p) => sum + parseFloat(p.price || 0), 0);
  const taxOnBillableParts = round2(billableParts * taxRate);
  const previouslyPaid = round2(parseFloat(workOrder.amount_previously_paid || 0));
  const dueTodayDiscount = repairCompleted ? discountAmt : 0;
  const dueToday = Math.max(0, round2(billableServices + billableParts + taxOnBillableParts - previouslyPaid - dueTodayDiscount));
  const servicesSubtotal = (allServices || []).reduce((sum, s) => sum + parseFloat(s.price || 0), 0);
  const PART_BILLABLE = ['phone_payment', 'paid_not_installed', 'upfront_50', 'installed'];
  const partsSubtotal = (workOrder.parts || [])
    .filter((p) => PART_BILLABLE.includes(p.status))
    .reduce((sum, p) => sum + parseFloat(p.price || 0), 0);
  const taxOnParts = round2(partsSubtotal * taxRate);
  const totalWorkOrder = round2(servicesSubtotal + partsSubtotal + taxOnParts - (repairCompleted ? discountAmt : 0));
  return { dueToday, taxOnBillableParts, totalWorkOrder, previouslyPaid };
}

/** Fractal noise texture for tactical HUD background */
const TACTICAL_NOISE_BG =
  'url("data:image/svg+xml,%3Csvg viewBox=%270 0 256 256%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")';

const HUD_GRID_STEP = 42;
const HUD_GRID_NUDGE_X = -1;
const HUD_GRID_NUDGE_Y = -1;

function positiveMod(n, m) {
  return ((n % m) + m) % m;
}

function hudGridShiftForTitleplate(dx, dy, step) {
  return {
    x: -positiveMod(dx, step),
    y: -positiveMod(dy, step),
  };
}

function WorkOrderDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useUser();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteModalError, setDeleteModalError] = useState(null);
  const { isManager } = useUserRole();
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [activeTab, setActiveTab] = useState(
    router.query.tab === 'appointments' ? TABS.APPOINTMENTS :
    router.query.tab === 'details' ? TABS.DETAILS :
    TABS.DETAILS
  );
  const [statusModalError, setStatusModalError] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isApplyingPayment, setIsApplyingPayment] = useState(false);
  const [clientWorkOrders, setClientWorkOrders] = useState([]);
  const [clientWorkOrdersLoading, setClientWorkOrdersLoading] = useState(false);
  const [halfDiagnosticDiscount, setHalfDiagnosticDiscount] = useState(false);
  const [editingServicePrice, setEditingServicePrice] = useState(null); // { id, price, unit_price, name }
  const [editingPartPrice, setEditingPartPrice] = useState(null); // { id, price, cost }
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [fieldPayments, setFieldPayments] = useState([]);
  const [showServiceProperty, setShowServiceProperty] = useState(false);
  const [showAllProperties, setShowAllProperties] = useState(false);
  const { theme } = useTheme();

    // Fetch work order details
  const { data: workOrder, isLoading, error, refetch } = useWorkOrder(id);
  const { isOnline } = useOnlineStatus();

  useEffect(() => {
    if (isOnline && id) {
      warmWorkOrderCache(id);
    }
  }, [isOnline, id]);

  /** Mobile ⋯ overflow (Print, Edit, Delete, Status) */
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [notesAddSheetOpen, setNotesAddSheetOpen] = useState(false);
  const mobileMoreRef = useRef(null);

  /** HUD grid double-tap for icon rail - attach after data loads */
  const tacticalColumnRef = useRef(null);
  const { openRail } = useTechDashboardRail() || {};
  const headerCardRef = useRef(null);
  const [hudGridShift, setHudGridShift] = useState({ x: 0, y: 0 });

  // Attach double-tap listener AFTER work order loads
  useEffect(() => {
    if (isLoading || error || !tacticalColumnRef.current || !openRail) return;
    
    const layer = tacticalColumnRef.current;
    const lastTap = { t: 0, x: 0, y: 0 };
    
    const tryOpenRail = (x, y) => {
      const now = Date.now();
      const dt = now - lastTap.t;
      const dist = Math.hypot(x - lastTap.x, y - lastTap.y);
      if (lastTap.t && dt < 350 && dist < 48) {
        openRail();
        lastTap.t = 0;
        return true;
      }
      lastTap.t = now;
      lastTap.x = x;
      lastTap.y = y;
      return false;
    };
    
    const onTouch = (e) => {
      if (e.touches.length === 1) {
        const { clientX, clientY } = e.touches[0];
        if (tryOpenRail(clientX, clientY)) e.preventDefault();
      }
    };
    
    const onDblClick = () => openRail();
    
    layer.addEventListener('touchstart', onTouch, { passive: false });
    layer.addEventListener('dblclick', onDblClick);
    
    return () => {
      layer.removeEventListener('touchstart', onTouch);
      layer.removeEventListener('dblclick', onDblClick);
    };
  }, [isLoading, error, openRail]);

  const syncHudGridAlignment = useCallback(() => {
    const col = tacticalColumnRef.current;
    const card = headerCardRef.current;
    if (!col || !card) return;
    const c = col.getBoundingClientRect();
    const h = card.getBoundingClientRect();
    const dx = h.left - c.left;
    const dy = h.top - c.top;
    const base = hudGridShiftForTitleplate(dx, dy, HUD_GRID_STEP);
    setHudGridShift({ x: base.x + HUD_GRID_NUDGE_X, y: base.y + HUD_GRID_NUDGE_Y });
  }, []);

  useLayoutEffect(() => {
    syncHudGridAlignment();
    const col = tacticalColumnRef.current;
    if (!col) return undefined;
    const ro = new ResizeObserver(() => syncHudGridAlignment());
    ro.observe(col);
    window.addEventListener('resize', syncHudGridAlignment);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', syncHudGridAlignment);
    };
  }, [syncHudGridAlignment]);

  useEffect(() => {
    if (activeTab !== TABS.NOTES) {
      setNotesAddSheetOpen(false);
    }
  }, [activeTab]);
  
  // Ensure dark mode applies correctly on page load
  useEffect(() => {
    // Apply the theme from context to the document
    if (theme.mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme.mode]);

  useEffect(() => {
    function onPointerDown(e) {
      if (!mobileMoreOpen) return;
      if (mobileMoreRef.current?.contains(e.target)) return;
      setMobileMoreOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [mobileMoreOpen]);



  // Services come directly from the work order
  const allServices = workOrder?.services || [];
  const billingTotals = useMemo(
    () => computeMobileBillingTotals(workOrder, allServices, halfDiagnosticDiscount),
    [workOrder, allServices, halfDiagnosticDiscount]
  );

  useEffect(() => {
    if (!workOrder?.id || activeTab !== TABS.INVOICES) return;
    apiClient(`work-orders/${workOrder.id}/payments`)
      .then((res) => setFieldPayments(res?.items || []))
      .catch(() => setFieldPayments([]));
  }, [workOrder?.id, activeTab, showRecordPayment]);
  
  // Handle payment success/cancel URLs
  useEffect(() => {
    const { payment } = router.query;
    
    if (payment === 'success') {
      // Show success message and refresh work order data
      alert('Payment successful! Your work order has been updated.');
      refetch(); // Refresh the work order data
      
      // Remove the payment parameter from URL
      router.replace(`/work_orders/${id}/mobile`, undefined, { shallow: true });
    } else if (payment === 'cancelled') {
      // Show cancellation message
      alert('Payment was cancelled. You can try again anytime.');
      
      // Remove the payment parameter from URL
      router.replace(`/work_orders/${id}/mobile`, undefined, { shallow: true });
    }
  }, [router.query, router, id, refetch]);
  // Sync tab from URL query param (router.query is empty on first render)
  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.tab === 'appointments') setActiveTab(TABS.APPOINTMENTS);
    else if (router.query.tab === 'details') setActiveTab(TABS.DETAILS);
  }, [router.isReady, router.query.tab]);

  // Fetch client's other work orders when Client tab is active
  useEffect(() => {
    if (activeTab === TABS.CLIENT && workOrder?.client_id && clientWorkOrders.length === 0) {
      setClientWorkOrdersLoading(true);
      apiClient(`work-orders?client_id=${workOrder.client_id}&limit=50`)
        .then(res => {
          const items = res?.items || [];
          // Exclude the current work order
          setClientWorkOrders(items.filter(wo => wo.id !== workOrder.id));
        })
        .catch(err => console.error('Error fetching client work orders:', err))
        .finally(() => setClientWorkOrdersLoading(false));
    }
  }, [activeTab, workOrder?.client_id]);

  // Work order mutations
  const { 
    deleteWorkOrder, 
    updateWorkOrderStatus, 
    isLoading: isMutating 
  } = useWorkOrderMutations();
  
  // Handle work order deletion
  const handleDelete = async () => {
    setDeleteModalError(null);
    try {
      const workOrderId = workOrder?.id || id;
      if (!workOrderId) {
        setDeleteModalError('Work order ID is not available. Try refreshing the page.');
        return;
      }
      await deleteWorkOrder(workOrderId);
      setShowDeleteModal(false);
      router.push('/work_orders/test');
    } catch (error) {
      console.error('Error deleting work order:', error);
      const detail = error?.responseData?.detail ?? error?.message;
      setDeleteModalError(
        typeof detail === 'string'
          ? detail
          : 'Failed to delete work order. It may have invoices, be in progress, or require admin access.'
      );
    }
  };
  
  // Handle status update
  const handleStatusUpdate = async () => {
    try {
      if (!workOrder?.id) {
        console.error('Work order ID is not available');
        return;
      }
      
      await updateWorkOrderStatus({
        id: workOrder.id,
        status: newStatus,
        notes: statusNotes
      });
      setShowStatusModal(false);
      setStatusNotes('');
      if (navigator.onLine) {
        refetch();
      }
    } catch (error) {
      console.error('Error updating status:', error);
      // Error is shown by the mutation hook
    }
  };

  // Handle payment collection
  const handleApplyPayment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      alert('Please enter a valid payment amount');
      return;
    }

    setIsApplyingPayment(true);
    try {
      const response = await fetch(`/api/work-orders/${id}/admin-override`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          action: 'apply_payment',
          payment_amount: parseFloat(paymentAmount)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to apply payment');
      }

      // Clear the payment amount and refresh the work order
      setPaymentAmount('');
      refetch();
      alert('Payment applied successfully!');
    } catch (error) {
      console.error('Error applying payment:', error);
      alert('Failed to apply payment: ' + error.message);
    } finally {
      setIsApplyingPayment(false);
    }
  };
  
  return (
    <>
      <Head>
        <title>{workOrder?.order_number || 'Work Order'} | Work Order | Atomic Repair 419</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <style>{`
          @keyframes wo-mobile-tactical-scan {
            0% { left: -48%; }
            100% { left: 115%; }
          }
          .wo-mobile-hud-card-grid {
            background-image:
              linear-gradient(rgba(0,217,255,.07) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,217,255,.07) 1px, transparent 1px);
            background-size: ${HUD_GRID_STEP}px ${HUD_GRID_STEP}px;
            background-position: var(--wo-mobile-hud-grid-x, 0px) var(--wo-mobile-hud-grid-y, 0px);
          }
          /* Ensure tap layer can receive events in empty areas */
          .hud-tactical-column {
            touch-action: manipulation;
          }
        `}</style>
      </Head>

      <div className="min-h-screen pb-24" style={{ background: '#0A0F1E' }}>
      <div 
        ref={tacticalColumnRef}
        className="hud-tactical-column relative px-4 pt-0 pb-5 max-w-lg mx-auto" 
        style={{ minHeight: '100vh' }}
      >
        {/* Tactical background — same layers as techboard; no extra "card" container */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="absolute inset-0" style={{ background: '#0A0F1E' }} />
            <div
              className="absolute inset-0 opacity-[0.11]
                bg-[linear-gradient(rgba(0,217,255,.36)_1px,transparent_1px),linear-gradient(90deg,rgba(0,217,255,.28)_1px,transparent_1px)]
                bg-[size:42px_42px]"
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,217,255,.13),transparent_48%)]" />
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[min(560px,120%)] h-[220px] bg-cyan-400/[0.085] blur-[120px] rounded-full" />
            <div
              className="absolute inset-0 opacity-[0.028]
                bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,.1),rgba(255,255,255,.1)_1px,transparent_1px,transparent_14px)]"
            />
            <div
              className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
              style={{ backgroundImage: TACTICAL_NOISE_BG }}
            />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-300/45 to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,.52)_100%)] pointer-events-none" />
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div
                className="absolute top-0 bottom-0 w-[42%]"
                style={{
                  left: '-48%',
                  background: 'linear-gradient(90deg, transparent 0%, transparent 32%, rgba(255,255,255,0.024) 50%, transparent 68%, transparent 100%)',
                  animation: 'wo-mobile-tactical-scan 6.5s linear infinite',
                }}
              />
            </div>
            <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] pointer-events-none" />
          </div>

        <div className="hud-grid-content relative z-10 p-4 sm:p-6">

        {isLoading && (
          <div className="py-6">
            <LoadingSpinner size="large" />
          </div>
        )}

        {error && (
          <div className="py-6">
            <ErrorAlert 
              message={
                typeof navigator !== 'undefined' && !navigator.onLine
                  ? 'This work order is not cached offline yet. Visit /techboard while online, open this job once, then try again.'
                  : 'Failed to load work order details'
              }
              onRetry={refetch}
            />
          </div>
        )}

        {!isLoading && !error && (
          <>
        {/* Header card */}
        <div className="relative mb-4 z-[1200]">
          <div
            ref={headerCardRef}
            data-hud-card
            className="relative overflow-visible rounded-[18px] md:rounded-[22px] border border-cyan-400/35 bg-[rgba(5,12,22,.84)] backdrop-blur-2xl px-3.5 py-3 md:px-5 md:py-4 shadow-[0_0_30px_rgba(0,212,255,.28)]"
            style={{
              '--wo-mobile-hud-grid-x': `${hudGridShift.x}px`,
              '--wo-mobile-hud-grid-y': `${hudGridShift.y}px`,
            }}
          >
                <div
                  className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-50 wo-mobile-hud-card-grid"
                  aria-hidden
                />
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-cyan-950/0 opacity-60 pointer-events-none rounded-[inherit]" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none z-[1]" />
                <div className="absolute bottom-0 left-4 right-4 md:left-8 md:right-8 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent pointer-events-none z-[1]" />

                <div className="relative z-[2] flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="hidden md:inline text-2xl font-bold text-gray-900 dark:text-white">
                          Work Order:{' '}
                        </span>
                        <span className="md:hidden text-[10px] font-semibold uppercase tracking-wider text-cyan-300/95 w-full md:w-auto">
                          Work order
                        </span>
                        <h1 className="text-lg md:text-2xl font-bold text-white truncate max-w-[12rem] sm:max-w-none">
                          #{workOrder.order_number}
                        </h1>
                        <StatusBadge status={workOrder.status} />
                      </div>
                      <p className="text-xs md:text-sm text-gray-400 mt-1">
                        Created {format(new Date(workOrder.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
            {/* Mobile ⋯ */}
            <div className="relative shrink-0 md:hidden" ref={mobileMoreRef}>
              <button
                type="button"
                onClick={() => setMobileMoreOpen((o) => !o)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 bg-[#0D1525] text-gray-300 active:bg-white/5"
                aria-expanded={mobileMoreOpen}
                aria-label="More actions"
              >
                <FaEllipsisH className="text-lg" />
              </button>
              {mobileMoreOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-white/10 bg-[#0D1525] py-1 shadow-xl z-[1198] ring-1 ring-black/40">
                  <Link
                    href={`/work_orders/${id}/womobile_edit`}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-200 hover:bg-white/5 active:bg-white/10"
                    onClick={() => setMobileMoreOpen(false)}
                  >
                    <FaEdit className="opacity-70" /> Edit work order
                  </Link>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-200 hover:bg-white/5"
                    onClick={() => {
                      setMobileMoreOpen(false);
                      window.print();
                    }}
                  >
                    <FaPrint className="opacity-70" /> Print
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-200 hover:bg-white/5"
                    onClick={() => {
                      setMobileMoreOpen(false);
                      setDeleteModalError(null);
                      setShowStatusModal(true);
                    }}
                  >
                    <FaExclamationTriangle className="opacity-70" /> Update status
                  </button>
                  {isManager && (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-400 hover:bg-white/5"
                      onClick={() => {
                        setMobileMoreOpen(false);
                        setDeleteModalError(null);
                        setShowDeleteModal(true);
                      }}
                    >
                      Delete…
                    </button>
                  )}
                </div>
              )}
                    </div>
                  </div>

                  {/* Desktop actions */}
                  <div className="hidden md:flex flex-wrap gap-2">
                    <Link href={`/work_orders/${id}/womobile_edit`} className="btn-primary flex items-center h-10" title="Edit work order">
                      <FaEdit className="mr-2" />
                      Edit
                    </Link>
                    <button type="button" onClick={() => window.print()} className="btn-white flex items-center h-10" title="Print work order">
                      <FaPrint className="mr-2" />
                      Print
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowStatusModal(true)}
                      className="btn-secondary flex items-center h-10"
                      title="Update status"
                    >
                      Update Status
                    </button>
                    {isManager && (
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteModalError(null);
                          setShowDeleteModal(true);
                        }}
                        className="btn-danger flex items-center h-10"
                        title="Delete work order"
                      >
                        Delete
                      </button>
                    )}
              </div>
            </div>
          </div>
        </div>

        {/* Content card container */}
        <div className="rounded-lg p-3 overflow-visible" style={{ background: 'rgba(13, 21, 37, 0.25)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)' }} data-hud-card>
        
        {/* Mobile tab pills — sticky below tech header */}
        <div 
          className="md:hidden sticky z-[1100] -mx-3 px-3 py-2 mb-3 border-y border-white/[0.08] bg-[#0A0F1E]/95 backdrop-blur-md supports-[backdrop-filter]:bg-[#0A0F1E]/80"
          style={{ top: 'calc(72px + env(safe-area-inset-top, 0px))' }}
        >
        <nav className="flex gap-2 overflow-x-auto overscroll-x-contain pb-0.5 snap-x snap-mandatory touch-pan-x" aria-label="Work order sections">
            {TAB_ITEMS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`snap-start shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                  activeTab === id
                    ? 'bg-cyan-500/20 text-cyan-300 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.35)]'
                    : 'bg-white/[0.05] text-gray-400 hover:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Desktop tabs */}
        <div className="hidden md:block border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="-mb-px flex flex-wrap gap-x-4 gap-y-1">
            {TAB_ITEMS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="text-base shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </div>
        
        {/* Tab Content */}
        <div className="min-w-0">
          {/* Details Tab */}
          {activeTab === TABS.DETAILS && (
            <>
              {/* Work Order Detail Card */}
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden mb-6">
                <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">Work Order Details</h2>
                </div>
                
                <div className="px-6 py-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Client</h3>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        {workOrder.client?.company_name || workOrder.client_name || 
                        `${workOrder.client?.first_name || ''} ${workOrder.client?.last_name || ''}`.trim() || 
                        'No client assigned'}
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Scheduled Time</h3>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white flex items-center">
                        {workOrder.scheduled_start ? (
                          <>
                            <span className="mr-2 inline-block w-2 h-2 rounded-full bg-green-500"></span>
                            {format(new Date(workOrder.scheduled_start), 'MMM d, yyyy h:mm a')}
                            {workOrder.scheduled_end && 
                              ` - ${format(new Date(workOrder.scheduled_end), 'h:mm a')}`}
                          </>
                        ) : (
                          <>
                            <span className="mr-2 inline-block w-2 h-2 rounded-full bg-gray-400"></span>
                            Not scheduled
                          </>
                        )}
                      </p>
                    </div>
                    
                    {workOrder.priority && workOrder.priority !== 'medium' && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Priority</h3>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white capitalize">{workOrder.priority}</p>
                      </div>
                    )}
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Service Location</h3>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">{workOrder.service_location?.address || 'No location specified'}</p>
                    </div>
                    
                    <div className="md:col-span-2">
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</h3>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-line">{workOrder.description || 'No description provided'}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Tenant & Property Access */}
              {workOrder.property && (workOrder.property.tenant_name || workOrder.property.tenant_phone || workOrder.property.unit_number || workOrder.property.gate_code || workOrder.property.access_instructions) && (
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden mb-6">
                  <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <h2 className="text-lg font-medium text-gray-900 dark:text-white">Tenant & Property Access</h2>
                  </div>
                  
                  <div className="px-6 py-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-4">
                      {/* Tenant Contact - Lead Information */}
                      {(workOrder.property.tenant_name || workOrder.property.tenant_phone) && (
                        <div className="md:col-span-2">
                          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Tenant / Contact at Property</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {workOrder.property.tenant_name && (
                              <div>
                                <h4 className="text-xs text-gray-500 dark:text-gray-400">Name</h4>
                                <p className="mt-1 text-sm text-gray-900 dark:text-white font-medium">
                                  {workOrder.property.tenant_name}
                                </p>
                              </div>
                            )}
                            {workOrder.property.tenant_phone && (
                              <div>
                                <h4 className="text-xs text-gray-500 dark:text-gray-400">Phone</h4>
                                <a 
                                  href={`tel:${workOrder.property.tenant_phone}`}
                                  className="mt-1 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium inline-block"
                                >
                                  {workOrder.property.tenant_phone}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Unit Number */}
                      {workOrder.property.unit_number && (
                        <div className={`${(workOrder.property.tenant_name || workOrder.property.tenant_phone) ? 'md:col-span-2 pt-4 border-t border-gray-200 dark:border-gray-700' : ''}`}>
                          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Unit Number</h3>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">
                            {workOrder.property.unit_number}
                          </p>
                        </div>
                      )}
                      
                      {/* Gate Code */}
                      {workOrder.property.gate_code && (
                        <div className={`${(workOrder.property.tenant_name || workOrder.property.tenant_phone || workOrder.property.unit_number) ? 'pt-4 border-t border-gray-200 dark:border-gray-700' : ''}`}>
                          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Gate Code</h3>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded inline-block">
                            {workOrder.property.gate_code}
                          </p>
                        </div>
                      )}
                      
                      {/* Access Instructions */}
                      {workOrder.property.access_instructions && (
                        <div className={`md:col-span-2 ${(workOrder.property.tenant_name || workOrder.property.tenant_phone || workOrder.property.unit_number || workOrder.property.gate_code) ? 'pt-4 border-t border-gray-200 dark:border-gray-700' : ''}`}>
                          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Access Instructions</h3>
                          <p className="mt-2 text-sm text-gray-900 dark:text-white bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                            {workOrder.property.access_instructions}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              <WorkOrderPerformancePanel workOrderId={workOrder.id} variant="mobile" />

              {workOrder.appointments && workOrder.appointments.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-2">Appointments</h3>
                  <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                    <div className="px-6 py-4">
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {workOrder.appointments.map((appointment, index) => (
                          <div
                            key={index}
                            className="p-2 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700"
                          >
                                <div className="flex justify-between items-center">
                                  <div>
                                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                      {appointment.appointment_type.charAt(0).toUpperCase() + appointment.appointment_type.slice(1)}
                                      {appointment.services?.length > 0 && (
                                        <span className="ml-2 text-xs text-cyan-500 dark:text-cyan-400 font-normal">
                                          — {appointment.services.map(s => s.name).join(', ')}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">
                                      {new Date(appointment.scheduled_start).toLocaleDateString()} {new Date(appointment.scheduled_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      {appointment.scheduled_end && (
                                        <span> - {new Date(appointment.scheduled_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                      )}
                                    </div>
                                    {appointment.notes && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">
                                        {appointment.notes}
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                                      appointment.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                      appointment.status === 'canceled' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                      appointment.status === 'reschedule' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                      appointment.status === 'en_route' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                      appointment.status === 'in_progress' ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200' :
                                      appointment.status === 'completed_pending_payment' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                      appointment.status === 'unreachable' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                      appointment.status === 'failed' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' :
                                      'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                    }`}>
                                      {formatAppointmentStatus(appointment.status)}
                                    </span>
                                  </div>
                                </div>
                                {appointment.assigned_technician_id && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Technician: {appointment.technician_name || "Unassigned"}
                                  </div>
                                )}
                              </div>
                            ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Services and Items */}
              {(allServices?.length > 0 || workOrder.parts?.length > 0) && (
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden mb-6">
                  <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                    <h2 className="text-lg font-medium text-gray-900 dark:text-white">Services & Items</h2>
                  </div>
                  
                  <div className="px-6 py-5">
                    {/* Services */}
                    {allServices?.length > 0 && (
                      <div className="mb-6">
                        <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">Services</h3>
                        <div className="md:hidden space-y-2">
                          {allServices.map((service, index) => (
                            <div
                              key={service.id || index}
                              className="rounded-2xl border border-white/[0.08] bg-[#0D1525]/80 p-3 text-sm backdrop-blur-sm"
                            >
                              <p className="font-semibold text-white">{service.name || 'Unknown Service'}</p>
                              <div className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1 text-xs text-gray-400">
                                <span>Qty</span>
                                <span>Unit</span>
                                <span className="text-right">Total</span>
                                <span className="text-gray-200">{service.quantity}</span>
                                <span className="text-gray-200">
                                  ${service.unit_price ? Number(service.unit_price).toFixed(2) : 'N/A'}
                                </span>
                                <span className="text-right text-cyan-300/90 tabular-nums">
                                  ${service.price ? Number(service.price).toFixed(2) : 'N/A'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="hidden md:block overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Service</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quantity</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unit Price</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Line Total</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                              {allServices.map((service, index) => (
                                <tr key={service.id || index}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{service.name || 'Unknown Service'}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{service.quantity}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${service.unit_price ? Number(service.unit_price).toFixed(2) : 'N/A'}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${service.price ? Number(service.price).toFixed(2) : 'N/A'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    
                    {/* Parts */}
                    {workOrder.parts?.length > 0 && (
                      <div>
                        <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">Parts</h3>
                        <div className="md:hidden space-y-2">
                          {workOrder.parts.map((part) => (
                            <div
                              key={part.id}
                              className="rounded-2xl border border-white/[0.08] bg-[#0D1525]/80 p-3 text-sm backdrop-blur-sm"
                            >
                              <div className="flex justify-between gap-2">
                                <p className="font-mono font-semibold text-white">{part.number}</p>
                                <span
                                  className={`inline-flex shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-full capitalize ${
                                    part.status === 'installed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                    part.status === 'received' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                    part.status === 'ordered' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                    'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                                  }`}
                                >
                                  {part.status}
                                </span>
                              </div>
                              <p className="mt-2 text-xs text-gray-400 break-words">{part.description}</p>
                              <div className="mt-3 grid grid-cols-3 gap-x-2 text-xs">
                                <div>
                                  <span className="text-gray-500">Cost</span>
                                  <p className="text-gray-200 tabular-nums">${part.cost ? part.cost.toFixed(2) : 'N/A'}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Price</span>
                                  <p className="text-cyan-300/90 tabular-nums">${part.price ? part.price.toFixed(2) : 'N/A'}</p>
                                </div>
                                <div className="min-w-0">
                                  <span className="text-gray-500">Vendor</span>
                                  <p className="text-gray-200 truncate">{part.vendor || 'N/A'}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="hidden md:block overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Part Number</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cost</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vendor</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                              {workOrder.parts.map((part) => (
                                <tr key={part.id}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{part.number}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{part.description}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${part.cost ? part.cost.toFixed(2) : 'N/A'}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${part.price ? part.price.toFixed(2) : 'N/A'}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{part.vendor || 'N/A'}</td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                      part.status === 'installed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                      part.status === 'received' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                      part.status === 'ordered' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                      'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                                    }`}>
                                      {part.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <WorkOrderDebriefing workOrderId={workOrder.id} variant="mobile" />
            </>
          )}
          {activeTab === TABS.APPOINTMENTS && (
            <div className="px-1 py-2 md:p-6 min-w-0">
              <AppointmentScheduler
                workOrderId={id}
                workOrderAddress={workOrder.service_location?.address}
                key={`appointments-${id}`}
                variant="mobile"
                onAppointmentChange={() => {
                  refetch();
                }}
              />
            </div>
          )}
          
          {/* Notes Tab */}
          {activeTab === TABS.NOTES && (
            <div className="px-1 py-2 md:p-6 min-w-0">
              <WorkOrderNotes
                workOrderId={workOrder.id}
                workOrder={workOrder}
                variant="mobile"
                addSheetOpen={notesAddSheetOpen}
                onAddSheetOpenChange={setNotesAddSheetOpen}
              />
            </div>
          )}
          
          {/* Model Tab */}
          {activeTab === TABS.MODEL && (
            <div className="px-1 py-2 md:p-6 min-w-0 md:bg-white md:dark:bg-gray-800 md:shadow md:rounded-lg md:overflow-hidden md:mb-6">
              <div className="hidden md:block px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Equipment Details</h2>
              </div>
              <div className="md:px-6 md:py-5">
                <EquipmentDetails
                  workOrderId={workOrder.id}
                  workOrder={workOrder}
                  onUpdate={refetch}
                  variant="mobile"
                />
              </div>
            </div>
          )}
          
          {/* Client Tab */}
          {activeTab === TABS.CLIENT && (
            <div className="space-y-6">
              {/* Client Info Card */}
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">Client Information</h2>
                </div>
                <div className="px-6 py-5">
                  {(workOrder.client_user || workOrder.client) ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-4">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</h3>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {`${(workOrder.client_user?.first_name || workOrder.client?.first_name || '')} ${(workOrder.client_user?.last_name || workOrder.client?.last_name || '')}`.trim() || 'N/A'}
                        </p>
                      </div>
                      {workOrder.client?.company_name && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Company</h3>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">
                            {workOrder.client.company_name}
                          </p>
                        </div>
                      )}
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</h3>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {workOrder.client_user?.email || workOrder.client?.email || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone</h3>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {workOrder.client?.phone || workOrder.client?.mobile || 'N/A'}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <Link href={`/clients/${workOrder.client_id}`} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm">
                          View Full Client Profile →
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                      No client information available.
                    </p>
                  )}
                </div>
              </div>

              {/* Service Property (if set) */}
              {workOrder.property && (
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                  <button
                    onClick={() => setShowServiceProperty(!showServiceProperty)}
                    className="w-full px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  >
                    <h2 className="text-lg font-medium text-gray-900 dark:text-white">Service Property</h2>
                    {showServiceProperty ? <FaChevronUp className="text-gray-500" /> : <FaChevronDown className="text-gray-500" />}
                  </button>
                  {showServiceProperty && (
                  <div className="px-6 py-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-4">
                      <div className="md:col-span-2">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Address</h3>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {workOrder.property.address || 'N/A'}
                          {workOrder.property.unit_number && ` - Unit ${workOrder.property.unit_number}`}
                        </p>
                      </div>
                      {workOrder.property.property_type && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Property Type</h3>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white capitalize">
                            {workOrder.property.property_type}
                          </p>
                        </div>
                      )}
                      {workOrder.property.gate_code && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Gate Code</h3>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white font-mono">
                            {workOrder.property.gate_code}
                          </p>
                        </div>
                      )}
                      {workOrder.property.access_instructions && (
                        <div className="md:col-span-2">
                          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Access Instructions</h3>
                          <p className="mt-1 text-sm text-gray-900 dark:text-white">
                            {workOrder.property.access_instructions}
                          </p>
                        </div>
                      )}
                      {(workOrder.property.tenant_name || workOrder.property.tenant_phone || workOrder.property.tenant_email) && (
                        <div className="md:col-span-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Tenant Information</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {workOrder.property.tenant_name && (
                              <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Name</p>
                                <p className="mt-1 text-sm text-gray-900 dark:text-white">{workOrder.property.tenant_name}</p>
                              </div>
                            )}
                            {workOrder.property.tenant_phone && (
                              <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Phone</p>
                                <p className="mt-1 text-sm text-gray-900 dark:text-white">{workOrder.property.tenant_phone}</p>
                              </div>
                            )}
                            {workOrder.property.tenant_email && (
                              <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                                <p className="mt-1 text-sm text-gray-900 dark:text-white">{workOrder.property.tenant_email}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  )}
                </div>
              )}

              {/* All Client Properties */}
              {workOrder.client_properties && workOrder.client_properties.length > 0 && (
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                  <button
                    onClick={() => setShowAllProperties(!showAllProperties)}
                    className="w-full px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  >
                    <h2 className="text-lg font-medium text-gray-900 dark:text-white">All Properties ({workOrder.client_properties.length})</h2>
                    {showAllProperties ? <FaChevronUp className="text-gray-500" /> : <FaChevronDown className="text-gray-500" />}
                  </button>
                  {showAllProperties && (
                  <div className="px-6 py-5">
                    <div className="space-y-4">
                      {workOrder.client_properties.map((property) => (
                        <div key={property.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 dark:text-white">
                                {property.address}
                                {property.unit_number && ` - Unit ${property.unit_number}`}
                              </p>
                              {property.property_type && (
                                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize mt-1">
                                  {property.property_type}
                                </p>
                              )}
                            </div>
                            {workOrder.property_id === property.id && (
                              <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">
                                Service Location
                              </span>
                            )}
                          </div>
                          {(property.gate_code || property.tenant_name) && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                {property.gate_code && (
                                  <p className="text-gray-600 dark:text-gray-400">
                                    Gate: <span className="font-mono text-gray-900 dark:text-white">{property.gate_code}</span>
                                  </p>
                                )}
                                {property.tenant_name && (
                                  <p className="text-gray-600 dark:text-gray-400">
                                    Tenant: <span className="text-gray-900 dark:text-white">{property.tenant_name}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  )}
                </div>
              )}

              {/* Client's Other Work Orders */}
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">Other Work Orders</h2>
                </div>
                <div className="px-6 py-5">
                  {clientWorkOrdersLoading ? (
                    <div className="flex justify-center py-6"><LoadingSpinner /></div>
                  ) : clientWorkOrders.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-6">No other work orders for this client.</p>
                  ) : (
                    <>
                      <div className="md:hidden space-y-2">
                        {clientWorkOrders.map((wo) => (
                          <Link
                            key={wo.id}
                            href={`/work_orders/${wo.id}/mobile`}
                            className="block rounded-2xl border border-white/[0.08] bg-[#0D1525]/80 p-3 backdrop-blur-sm active:bg-white/[0.04]"
                          >
                            <div className="flex justify-between gap-2">
                              <span className="font-mono font-semibold text-cyan-400 text-sm">{wo.order_number}</span>
                              <StatusBadge status={wo.status} />
                            </div>
                            <p className="mt-2 text-xs text-gray-400 line-clamp-2 break-words">
                              {wo.description || 'No description'}
                            </p>
                            <p className="mt-2 text-[11px] text-gray-500">
                              {wo.created_at ? format(new Date(wo.created_at), 'MMM d, yyyy') : 'N/A'}
                            </p>
                          </Link>
                        ))}
                      </div>
                      <div className="hidden md:block overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Order #</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {clientWorkOrders.map(wo => (
                            <tr key={wo.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <Link href={`/work_orders/${wo.id}?tab=details`} className="text-blue-600 dark:text-blue-400 hover:underline font-medium text-sm">
                                  {wo.order_number}
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate">
                                {wo.description || 'No description'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <StatusBadge status={wo.status} />
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                {wo.created_at ? format(new Date(wo.created_at), 'MMM d, yyyy') : 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Invoices Tab */}
          {activeTab === TABS.INVOICES && (
            <div className="mb-6 min-w-0 overflow-x-hidden md:rounded-lg md:border md:border-gray-200 md:dark:border-gray-700 md:bg-white md:dark:bg-gray-800 md:shadow">
              <div className="flex flex-col gap-3 mb-3 px-0.5 md:mb-0 md:border-b md:border-gray-200 md:dark:border-gray-700 md:px-6 md:py-5 md:bg-gray-50 md:dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 md:text-lg md:font-medium md:normal-case md:tracking-normal md:text-gray-900 md:dark:text-white">
                  Billing
                </h2>
                <div className="flex gap-2">
                  {['estimate', 'invoice'].map(type => (
                    <button
                      key={type}
                      onClick={async () => {
                        try {
                          const { getAuthHeaders } = await import('../../../utils/api-client');
                          const headers = await getAuthHeaders();
                          const rawBase = process.env.NEXT_PUBLIC_API_URL || 'https://idims-production.up.railway.app';
                          const baseUrl = rawBase.replace(/\/api\/?$/, '').replace(/\/$/, '');
                          const pdfUrl = `${baseUrl}/api/work-orders/${workOrder.id}/${type}.pdf`;
                          const res = await fetch(pdfUrl, { headers });
                          if (!res.ok) {
                            const err = await res.json().catch(() => ({ detail: res.statusText }));
                            throw new Error(err.detail || res.statusText);
                          }
                          const blob = await res.blob();
                          const blobUrl = URL.createObjectURL(blob);
                          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                          if (isMobile) {
                            const a = document.createElement('a');
                            a.href = blobUrl;
                            a.download = `${type}-${workOrder.order_number}.pdf`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                          } else {
                            window.open(blobUrl, '_blank');
                          }
                          setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
                        } catch(e) { alert(`Failed to generate ${type}: ` + e.message); }
                      }}
                      className={`px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide rounded-lg border transition-colors md:px-3 md:py-1.5 md:text-sm md:normal-case md:tracking-normal md:rounded ${
                        type === 'estimate'
                          ? 'border-cyan-500/35 text-cyan-300 md:border-0 md:bg-cyan-600 md:text-white md:hover:bg-cyan-700'
                          : 'border-orange-500/35 text-orange-200 md:border-0 md:bg-orange-600 md:text-white md:hover:bg-orange-700'
                      }`}
                    >
                      {type === 'estimate' ? 'Estimate' : 'Invoice'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-w-0 px-0.5 py-2 md:px-6 md:py-5">
                {(allServices?.length > 0 || workOrder?.parts?.length > 0) ? (
                  <div className="space-y-6">
                    {/* Services Section */}
                    {allServices?.length > 0 && (
                      <div className="min-w-0">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 md:text-md md:font-medium md:normal-case md:tracking-normal md:text-gray-700 md:dark:text-gray-300 md:mb-3">
                          Services
                        </h3>
                        {/* Mobile service cards */}
                        <div className="md:hidden space-y-2">
                          {allServices.map((item, index) => {
                            const isBillable = item.billing_status === 'billable' || item.billing_status === 'paid';
                            const isPaid = item.billing_status === 'paid';
                            const isWaived = item.billing_status === 'waived';
                            const isEditingThis = editingServicePrice?.id === item.id;
                            const statusLabel = isPaid ? 'Paid' : isBillable ? 'Due Today' : isWaived ? 'Waived' : 'Not Billable';
                            const statusClass = isPaid
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : isBillable
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                : isWaived
                                  ? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';

                            return (
                              <div
                                key={`svc-m-${item.service_id || item.id || index}`}
                                className={`rounded-xl border p-3 ${
                                  isBillable && !isPaid
                                    ? 'border-cyan-500/25 bg-cyan-500/[0.04]'
                                    : 'border-white/10 bg-white/[0.03]'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    {isEditingThis ? (
                                      <input
                                        className="w-full px-2 py-1.5 text-sm border border-cyan-500/40 rounded-lg bg-[#0B1120] text-white"
                                        value={editingServicePrice.name}
                                        onChange={e => setEditingServicePrice(prev => ({ ...prev, name: e.target.value }))}
                                      />
                                    ) : (
                                      <p className="text-sm font-semibold text-white truncate">
                                        {item.name || 'N/A'}
                                        {isPaid && <span className="ml-1">✓</span>}
                                        {isBillable && !isPaid && <span className="ml-1">💰</span>}
                                      </p>
                                    )}
                                  </div>
                                  <span className={`shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-full ${statusClass}`}>
                                    {statusLabel}
                                  </span>
                                </div>
                                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wide text-gray-500">Qty</p>
                                    <p className="text-sm text-gray-200 mt-0.5">{item.quantity || 1}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wide text-gray-500">Unit</p>
                                    {isEditingThis ? (
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="w-full mt-0.5 px-1.5 py-1 text-sm border border-cyan-500/40 rounded bg-[#0B1120] text-white text-center"
                                        value={editingServicePrice.unit_price}
                                        onChange={e => setEditingServicePrice(prev => ({
                                          ...prev,
                                          unit_price: e.target.value,
                                          price: (parseFloat(e.target.value) * (item.quantity || 1)).toFixed(2),
                                        }))}
                                      />
                                    ) : (
                                      <p className="text-sm text-gray-200 mt-0.5">${item.unit_price ? item.unit_price.toFixed(2) : '0.00'}</p>
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wide text-gray-500">Total</p>
                                    {isEditingThis ? (
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="w-full mt-0.5 px-1.5 py-1 text-sm border border-cyan-500/40 rounded bg-[#0B1120] text-white text-center"
                                        value={editingServicePrice.price}
                                        onChange={e => setEditingServicePrice(prev => ({ ...prev, price: e.target.value }))}
                                      />
                                    ) : (
                                      <p className="text-sm font-medium text-cyan-300 mt-0.5">${item.price ? item.price.toFixed(2) : '0.00'}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="mt-3 pt-2 border-t border-white/10 flex justify-end">
                                  {isEditingThis ? (
                                    <div className="flex gap-2 w-full">
                                      <button
                                        type="button"
                                        disabled={isSavingPrice}
                                        onClick={async () => {
                                          setIsSavingPrice(true);
                                          try {
                                            await apiClient(`api/work-orders/services/${item.id}/price`, {
                                              method: 'PUT',
                                              body: JSON.stringify({
                                                unit_price: parseFloat(editingServicePrice.unit_price),
                                                price: parseFloat(editingServicePrice.price),
                                                name: editingServicePrice.name,
                                              }),
                                            });
                                            setEditingServicePrice(null);
                                            refetch();
                                          } catch (e) { alert('Failed to save: ' + e.message); }
                                          finally { setIsSavingPrice(false); }
                                        }}
                                        className="flex-1 h-9 rounded-lg bg-green-600 text-xs font-semibold text-white disabled:opacity-50"
                                      >
                                        {isSavingPrice ? 'Saving…' : 'Save'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingServicePrice(null)}
                                        className="h-9 px-3 rounded-lg border border-white/15 text-xs font-semibold text-gray-300"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setEditingServicePrice({ id: item.id, name: item.name, unit_price: item.unit_price, price: item.price })}
                                      className="text-xs font-semibold uppercase tracking-wide text-cyan-300"
                                    >
                                      Edit price
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Service</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quantity</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unit Price</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3"></th>
                                 </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                              {allServices.map((item, index) => {
                                const isBillable = item.billing_status === 'billable' || item.billing_status === 'paid';
                                const isPaid = item.billing_status === 'paid';
                                const isWaived = item.billing_status === 'waived';
                                const isEditingThis = editingServicePrice?.id === item.id;
                                
                                return (
                                  <tr key={item.service_id || item.id || index} className={isBillable && !isPaid ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}>
                                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                                      {isEditingThis ? (
                                        <input
                                          className="w-full px-2 py-1 text-sm border border-blue-400 rounded dark:bg-gray-700 dark:text-white"
                                          value={editingServicePrice.name}
                                          onChange={e => setEditingServicePrice(prev => ({ ...prev, name: e.target.value }))}
                                        />
                                      ) : (
                                        <>
                                          {item.name || 'N/A'}
                                          {isPaid && <span className="ml-2">✓</span>}
                                          {isBillable && !isPaid && <span className="ml-2">💰</span>}
                                        </>
                                      )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-right">{item.quantity || 1}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-right">
                                      {isEditingThis ? (
                                        <input
                                          type="number" step="0.01" min="0"
                                          className="w-24 px-2 py-1 text-sm border border-blue-400 rounded dark:bg-gray-700 dark:text-white"
                                          value={editingServicePrice.unit_price}
                                          onChange={e => setEditingServicePrice(prev => ({ ...prev, unit_price: e.target.value, price: (parseFloat(e.target.value) * (item.quantity || 1)).toFixed(2) }))}
                                        />
                                      ) : (
                                        `${item.unit_price ? item.unit_price.toFixed(2) : '0.00'}`
                                      )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-100 text-right">
                                      {isEditingThis ? (
                                        <input
                                          type="number" step="0.01" min="0"
                                          className="w-24 px-2 py-1 text-sm border border-blue-400 rounded dark:bg-gray-700 dark:text-white"
                                          value={editingServicePrice.price}
                                          onChange={e => setEditingServicePrice(prev => ({ ...prev, price: e.target.value }))}
                                        />
                                      ) : (
                                        `${item.price ? item.price.toFixed(2) : '0.00'}`
                                      )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                        isPaid ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                        isBillable ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                        isWaived ? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' :
                                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                      }`}>
                                        {isPaid ? 'Paid' : isBillable ? 'Due Today' : isWaived ? 'Waived' : 'Not Billable'}
                                      </span>
                                    </td>
                                    {/* Admin price edit controls */}
                                    <td className="px-4 py-4 whitespace-nowrap text-right">
                                      {isEditingThis ? (
                                        <div className="flex gap-2 justify-end">
                                          <button
                                            disabled={isSavingPrice}
                                            onClick={async () => {
                                              setIsSavingPrice(true);
                                              try {
                                                await apiClient(`api/work-orders/services/${item.id}/price`, {
                                                  method: 'PUT',
                                                  body: JSON.stringify({
                                                    unit_price: parseFloat(editingServicePrice.unit_price),
                                                    price: parseFloat(editingServicePrice.price),
                                                    name: editingServicePrice.name
                                                  })
                                                });
                                                setEditingServicePrice(null);
                                                refetch();
                                              } catch(e) { alert('Failed to save: ' + e.message); }
                                              finally { setIsSavingPrice(false); }
                                            }}
                                            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                                          >{isSavingPrice ? '...' : 'Save'}</button>
                                          <button
                                            onClick={() => setEditingServicePrice(null)}
                                            className="px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500"
                                          >Cancel</button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => setEditingServicePrice({ id: item.id, name: item.name, unit_price: item.unit_price, price: item.price })}
                                          className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400"
                                          title="Edit price"
                                        >✏️</button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Parts Section */}
                    {workOrder?.parts?.length > 0 && (
                      <div className="min-w-0">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 md:text-md md:font-medium md:normal-case md:tracking-normal md:text-gray-700 md:dark:text-gray-300 md:mb-3">
                          Parts
                        </h3>
                        <div className="md:hidden space-y-2">
                          {workOrder.parts.map((part, index) => {
                            const isPhonePayment = part.status === 'phone_payment';
                            const isUpfront50 = part.status === 'upfront_50';
                            const isInstalled = part.status === 'installed';
                            const upfrontCollected = parseFloat(part.amount_upfront_collected || 0);
                            const price = parseFloat(part.price || 0);
                            const remainingDue = isInstalled ? price - upfrontCollected : isUpfront50 ? price * 0.5 : isPhonePayment ? 0 : null;
                            const isBillable = isPhonePayment || isUpfront50 || isInstalled;
                            const isPaid = isPhonePayment;
                            const isPartial = isUpfront50 || (isInstalled && upfrontCollected > 0);
                            const statusLabel = isPaid
                              ? 'Paid in Full'
                              : isUpfront50
                                ? `50% Due ($${(price * 0.5).toFixed(2)})`
                                : isInstalled && upfrontCollected > 0
                                  ? `Balance ($${remainingDue.toFixed(2)})`
                                  : isInstalled
                                    ? 'Due Today'
                                    : 'Not Billable';
                            const statusClass = isPaid
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : isUpfront50
                                ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                                : isInstalled && upfrontCollected > 0
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                  : isBillable
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';

                            return (
                              <div
                                key={`part-m-${part.id || index}`}
                                className={`rounded-xl border p-3 ${
                                  isBillable && !isPaid
                                    ? 'border-cyan-500/25 bg-cyan-500/[0.04]'
                                    : 'border-white/10 bg-white/[0.03]'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-white truncate">{part.number}</p>
                                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{part.description}</p>
                                  </div>
                                  <span className={`shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-full max-w-[42%] text-right leading-tight ${statusClass}`}>
                                    {statusLabel}
                                  </span>
                                </div>
                                <div className="mt-3 flex items-end justify-between gap-3">
                                  <div>
                                    <p className="text-[10px] uppercase tracking-wide text-gray-500">Price</p>
                                    {editingPartPrice?.id === part.id ? (
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="w-28 mt-0.5 px-2 py-1 text-sm border border-cyan-500/40 rounded bg-[#0B1120] text-white"
                                        value={editingPartPrice.price}
                                        onChange={e => setEditingPartPrice(prev => ({ ...prev, price: e.target.value }))}
                                      />
                                    ) : (
                                      <p className="text-lg font-semibold text-cyan-300 mt-0.5">${price.toFixed(2)}</p>
                                    )}
                                    {isPartial && upfrontCollected > 0 && (
                                      <p className="text-xs text-gray-500 mt-0.5">${upfrontCollected.toFixed(2)} collected</p>
                                    )}
                                  </div>
                                  <div className="flex gap-2">
                                    {editingPartPrice?.id === part.id ? (
                                      <>
                                        <button
                                          type="button"
                                          disabled={isSavingPrice}
                                          onClick={async () => {
                                            setIsSavingPrice(true);
                                            try {
                                              await apiClient(`api/work-orders/parts/${part.id}/price`, {
                                                method: 'PUT',
                                                body: JSON.stringify({ price: parseFloat(editingPartPrice.price) }),
                                              });
                                              setEditingPartPrice(null);
                                              refetch();
                                            } catch (e) { alert('Failed to save: ' + e.message); }
                                            finally { setIsSavingPrice(false); }
                                          }}
                                          className="h-9 px-3 rounded-lg bg-green-600 text-xs font-semibold text-white disabled:opacity-50"
                                        >
                                          {isSavingPrice ? '…' : 'Save'}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingPartPrice(null)}
                                          className="h-9 px-3 rounded-lg border border-white/15 text-xs font-semibold text-gray-300"
                                        >
                                          Cancel
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setEditingPartPrice({ id: part.id, price })}
                                        className="h-9 px-3 rounded-lg border border-cyan-500/35 text-xs font-semibold uppercase tracking-wide text-cyan-300"
                                      >
                                        Edit
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="hidden md:block overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Part Number</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3"></th>
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                              {workOrder.parts.map((part, index) => {
                                const isPhonePayment = part.status === 'phone_payment';
                                const isUpfront50 = part.status === 'upfront_50';
                                const isInstalled = part.status === 'installed';
                                const upfrontCollected = parseFloat(part.amount_upfront_collected || 0);
                                const price = parseFloat(part.price || 0);
                                const remainingDue = isInstalled ? price - upfrontCollected : isUpfront50 ? price * 0.5 : isPhonePayment ? 0 : null;
                                const isBillable = isPhonePayment || isUpfront50 || isInstalled;
                                const isPaid = isPhonePayment;
                                const isPartial = isUpfront50 || (isInstalled && upfrontCollected > 0);
                                
                                return (
                                  <tr key={part.id || index} className={isBillable && !isPaid ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                                      {part.number}
                                      {isPaid && <span className="ml-2">✓</span>}
                                      {isBillable && !isPaid && <span className="ml-2">💰</span>}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                      {part.description}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 dark:text-gray-100 text-right">
                                      {editingPartPrice?.id === part.id ? (
                                        <input
                                          type="number" step="0.01" min="0"
                                          className="w-24 px-2 py-1 text-sm border border-blue-400 rounded dark:bg-gray-700 dark:text-white"
                                          value={editingPartPrice.price}
                                          onChange={e => setEditingPartPrice(prev => ({ ...prev, price: e.target.value }))}
                                        />
                                      ) : (
                                        `${price.toFixed(2)}`
                                      )}
                                      {isPartial && upfrontCollected > 0 && (
                                        <div className="text-xs text-gray-400">${upfrontCollected.toFixed(2)} collected</div>
                                      )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                        isPaid ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                        isUpfront50 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                        isInstalled && upfrontCollected > 0 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                        isBillable ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                      }`}>
                                        {isPaid ? 'Paid in Full' :
                                         isUpfront50 ? `50% Due (${(price * 0.5).toFixed(2)})` :
                                         isInstalled && upfrontCollected > 0 ? `Balance Due (${remainingDue.toFixed(2)})` :
                                         isInstalled ? 'Due Today' :
                                         'Not Billable'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap text-right">
                                      {editingPartPrice?.id === part.id ? (
                                        <div className="flex gap-2 justify-end">
                                          <button
                                            disabled={isSavingPrice}
                                            onClick={async () => {
                                              setIsSavingPrice(true);
                                              try {
                                                await apiClient(`api/work-orders/parts/${part.id}/price`, {
                                                  method: 'PUT',
                                                  body: JSON.stringify({ price: parseFloat(editingPartPrice.price) })
                                                });
                                                setEditingPartPrice(null);
                                                refetch();
                                              } catch(e) { alert('Failed to save: ' + e.message); }
                                              finally { setIsSavingPrice(false); }
                                            }}
                                            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                                          >{isSavingPrice ? '...' : 'Save'}</button>
                                          <button
                                            onClick={() => setEditingPartPrice(null)}
                                            className="px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500"
                                          >Cancel</button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => setEditingPartPrice({ id: part.id, price: price })}
                                          className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400"
                                          title="Edit price"
                                        >✏️</button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Invoice Totals */}
                    {(() => {
                      const taxRate = parseFloat(workOrder.tax_rate || 0.0775);
                      const taxPct = (taxRate * 100).toFixed(2);

                      // All services regardless of billing status
                      const servicesSubtotal = (allServices || []).reduce((sum, s) => sum + parseFloat(s.price || 0), 0);

                      // All billable parts (any payment-triggering status)
                      const PART_BILLABLE = ['phone_payment', 'paid_not_installed', 'upfront_50', 'installed'];
                      const partsSubtotal = (workOrder.parts || [])
                        .filter(p => PART_BILLABLE.includes(p.status))
                        .reduce((sum, p) => sum + parseFloat(p.price || 0), 0);

                      const subtotal = servicesSubtotal + partsSubtotal;

                      // Tax only on billable parts
                      const taxOnParts = round2(partsSubtotal * taxRate);
                      const grossTotal = round2(subtotal + taxOnParts);

                      // Diagnostic discount — shown always if repair SKU exists, grayed if repair not yet completed
                      const hasRepairSku = (allServices || []).some(s =>
                        s.name?.toLowerCase().includes('repair') ||
                        s.service_definition?.service_type === 'repair'
                      );
                      const repairCompleted = (workOrder.appointments || []).some(a =>
                        a.appointment_type === 'repair' && a.status === 'completed'
                      );
                      const discountAmt = hasRepairSku && workOrder?.diagnostic_discount_amount > 0
                        ? (halfDiagnosticDiscount
                            ? round2(workOrder.diagnostic_discount_amount * 0.5)
                            : round2(workOrder.diagnostic_discount_amount))
                        : 0;

                      const totalWorkOrder = round2(grossTotal - discountAmt);
                      const previouslyPaid = round2(parseFloat(workOrder.amount_previously_paid || 0));

                      // Due Today = billable services only + parts due now (with tax) - previously paid
                      const billableServices = (allServices || [])
                        .filter(s => s.billing_status === 'billable')
                        .reduce((sum, s) => sum + parseFloat(s.price || 0), 0);
                      const billableParts = (workOrder.parts || [])
                        .filter(p => ['phone_payment', 'upfront_50', 'installed', 'paid_not_installed'].includes(p.status))
                        .reduce((sum, p) => sum + parseFloat(p.price || 0), 0);
                      const taxOnBillableParts = round2(billableParts * taxRate);
                      const dueTodayDiscount = repairCompleted ? discountAmt : 0;
                      const dueToday = Math.max(0, round2(billableServices + billableParts + taxOnBillableParts - previouslyPaid - dueTodayDiscount));

                      return (
                        <>
                          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:pt-4 md:border-t md:border-gray-200 md:dark:border-gray-700 space-y-1.5">
                            {/* Tax rate control */}
                            <div className="flex justify-between md:justify-end items-center gap-2 mb-3">
                              <span className="text-xs text-gray-500">Tax Rate</span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number" step="0.01" min="0" max="20"
                                  className="w-16 px-2 py-1 text-xs border border-white/15 rounded bg-[#0B1120] text-white text-right md:border-gray-300 md:dark:border-gray-600 md:dark:bg-gray-700"
                                  defaultValue={taxPct}
                                  onBlur={async (e) => {
                                    const newRate = parseFloat(e.target.value) / 100;
                                    if (isNaN(newRate)) return;
                                    try {
                                      await apiClient(`api/work-orders/${workOrder.id}/tax-rate`, {
                                        method: 'PUT',
                                        body: JSON.stringify({ tax_rate: newRate })
                                      });
                                      refetch();
                                    } catch(err) { alert('Failed to update tax rate'); }
                                  }}
                                />
                                <span className="text-xs text-gray-500">%</span>
                              </div>
                            </div>

                            <div className="flex justify-between text-sm text-gray-400 md:text-gray-600 md:dark:text-gray-400">
                              <span>Services Subtotal</span>
                              <span>${servicesSubtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-400 md:text-gray-600 md:dark:text-gray-400">
                              <span>Parts Subtotal</span>
                              <span>${partsSubtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-medium text-gray-200 md:text-gray-700 md:dark:text-gray-300 pt-1 border-t border-white/10 md:border-gray-200 md:dark:border-gray-700">
                              <span>Subtotal</span>
                              <span>${subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-400 md:text-gray-600 md:dark:text-gray-400">
                              <span>Sales Tax ({taxPct}% on parts)</span>
                              <span>${taxOnParts.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-medium text-gray-200 md:text-gray-700 md:dark:text-gray-300 pt-1 border-t border-white/10 md:border-gray-200 md:dark:border-gray-700">
                              <span>Gross Total</span>
                              <span>${grossTotal.toFixed(2)}</span>
                            </div>

                            {/* Diagnostic discount line */}
                            {hasRepairSku && workOrder?.diagnostic_discount_amount > 0 && (
                              <div className={`flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center text-sm ${
                                repairCompleted
                                  ? 'text-cyan-300 md:text-blue-600 md:dark:text-blue-400 font-medium'
                                  : 'text-gray-500 italic md:text-gray-400 md:dark:text-gray-500'
                              }`}>
                                <div className="flex flex-wrap items-center gap-2 min-w-0">
                                  <span>
                                    Diagnostic Discount ({halfDiagnosticDiscount ? '50%' : '100%'})
                                    {!repairCompleted && ' — pending repair completion'}
                                  </span>
                                  <label className="flex items-center gap-1 text-xs cursor-pointer not-italic">
                                    <input
                                      type="checkbox"
                                      checked={halfDiagnosticDiscount}
                                      onChange={e => setHalfDiagnosticDiscount(e.target.checked)}
                                      className="rounded"
                                    />
                                    50% only
                                  </label>
                                </div>
                                <span>-${discountAmt.toFixed(2)}</span>
                              </div>
                            )}

                            <div className="flex justify-between text-base font-bold text-white md:text-gray-900 md:dark:text-gray-50 pt-1 border-t border-white/10 md:border-gray-200 md:dark:border-gray-600">
                              <span>Total Work Order</span>
                              <span>${totalWorkOrder.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-400 md:text-gray-600 md:dark:text-gray-400">
                              <span>Amount Previously Paid</span>
                              <span>-${previouslyPaid.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-base font-bold text-amber-300 md:text-yellow-600 md:dark:text-yellow-400 pt-1 border-t border-white/10 md:border-gray-200 md:dark:border-gray-600">
                              <span>Due Today</span>
                              <span>${dueToday.toFixed(2)}</span>
                            </div>
                          </div>

                          {/* Pay / record payment */}
                          {(billingTotals.dueToday > 0 || billingTotals.totalWorkOrder > billingTotals.previouslyPaid) && (
                            <div className="mt-4 md:mt-6 md:pt-4 md:border-t md:border-gray-200 md:dark:border-gray-700">
                              {billingTotals.dueToday > 0 ? (
                                <>
                                <div className="flex flex-col sm:flex-row gap-2 justify-center max-w-sm mx-auto sm:max-w-none">
                                <button
                                  onClick={async () => {
                                    try {
                                      const clientEmail = workOrder.client?.email || workOrder.client_user?.email;
                                      const clientName = workOrder.client_name || `${workOrder.client?.first_name || ''} ${workOrder.client?.last_name || ''}`.trim();

                                      const response = await apiClient('stripe/create-checkout-session', {
                                        method: 'POST',
                                        body: JSON.stringify({
                                          work_order_id: workOrder.id,
                                          client_email: clientEmail,
                                          client_name: clientName,
                                          amount: billingTotals.dueToday,
                                          success_url: `${window.location.origin}/work_orders/${workOrder.id}/mobile?payment=success`,
                                          cancel_url: `${window.location.origin}/work_orders/${workOrder.id}/mobile?payment=cancelled`,
                                          metadata: { work_order_number: workOrder.order_number || workOrder.id.slice(0, 8) }
                                        })
                                      });
                                      if (response.url) { window.location.href = response.url; }
                                      else { alert('Failed to create payment session'); }
                                    } catch (error) {
                                      console.error('Payment error:', error);
                                      alert('Failed to process payment: ' + (error.message || 'Unknown error'));
                                    }
                                  }}
                                  className="flex-1 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white font-semibold text-base shadow-[0_0_24px_rgba(16,185,129,0.25)] active:scale-[0.98] md:px-8 md:py-3 md:rounded-lg md:bg-green-600 md:hover:bg-green-700"
                                >
                                  Pay ${billingTotals.dueToday.toFixed(2)}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowRecordPayment(true)}
                                  className="flex-1 h-12 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-200 font-semibold text-sm active:scale-[0.98] md:border-amber-600 md:text-amber-700 md:dark:text-amber-300"
                                >
                                  Record payment
                                </button>
                              </div>
                              <div className="text-center mt-2">
                                <span className="text-xs text-gray-500 dark:text-gray-400">Pay Now uses Stripe · Record for cash, check, etc.</span>
                              </div>
                                </>
                              ) : (
                                <div className="flex justify-center">
                                  <button
                                    type="button"
                                    onClick={() => setShowRecordPayment(true)}
                                    className="h-11 px-6 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-200 font-semibold text-sm"
                                  >
                                    Record payment
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {fieldPayments.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Recorded payments</h4>
                              {fieldPayments.map((p) => (
                                <div key={p.id} className="flex justify-between text-sm text-gray-300">
                                  <span>
                                    {p.payment_method.replace(/_/g, ' ')}
                                    {p.reference_number ? ` · ${p.reference_number}` : ''}
                                  </span>
                                  <span>${Number(p.amount).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* Admin Controls */}
                    {user?.roles?.includes('admin') && (
                      <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:pt-4 md:border-t md:border-gray-200 md:dark:border-gray-700">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 md:text-sm md:font-medium md:normal-case md:tracking-normal md:text-gray-700 md:dark:text-gray-300">
                          Admin Controls
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Service Billing Status</label>
                            <select className="w-full px-3 py-2 border border-white/15 rounded-lg bg-[#0B1120] text-white text-sm md:border-gray-300 md:dark:border-gray-600 md:rounded-md md:bg-white md:dark:bg-gray-700 md:text-gray-900">
                              <option value="">Select service...</option>
                              {allServices?.map(service => (
                                <option key={service.id} value={service.id}>
                                  {service.name} - {service.billing_status}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">New Billing Status</label>
                            <select className="w-full px-3 py-2 border border-white/15 rounded-lg bg-[#0B1120] text-white text-sm md:border-gray-300 md:dark:border-gray-600 md:rounded-md md:bg-white md:dark:bg-gray-700 md:text-gray-900">
                              <option value="not_billable">Not Billable</option>
                              <option value="billable">Billable</option>
                              <option value="paid">Paid</option>
                              <option value="waived">Waived</option>
                            </select>
                          </div>
                          <div>
                            <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">
                              Update Service Status
                            </button>
                          </div>
                          <div>
                            <button className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm">
                              Waive Diagnostic Fee
                            </button>
                          </div>
                        </div>
                        <div className="mt-4">
                          <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Apply Payment</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Amount"
                              value={paymentAmount}
                              onChange={(e) => setPaymentAmount(e.target.value)}
                              className="flex-1 px-3 py-2 border border-white/15 rounded-lg bg-[#0B1120] text-white text-sm md:border-gray-300 md:dark:border-gray-600 md:rounded-md md:bg-white md:dark:bg-gray-700 md:text-gray-900"
                            />
                            <button 
                              onClick={handleApplyPayment}
                              disabled={isApplyingPayment || !paymentAmount}
                              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                            >
                              {isApplyingPayment ? 'Applying...' : 'Apply Payment'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                    No billable services or items have been added to this work order yet.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status Update Modal */}
        <Modal
          isOpen={showStatusModal}
          onClose={() => setShowStatusModal(false)}
          title="Update Work Order Status"
        >
          <div className="p-4">
            <div className="mb-4">
              <label className="block text-gray-700 dark:text-gray-300 mb-2">Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-white"
              >
                <option value="">Select new status</option>
                <option value="pending">Pending</option>
                <option value="scheduled">Scheduled</option>
                <option value="en_route">En Route</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting_on_parts">Waiting on Parts</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="completed_pending_payment">Completed — Pending Payment</option>
                <option value="pending_estimate_approval">Pending Estimate Approval</option>
                <option value="cancelled">Cancelled</option>
                <option value="parts_on_order">Parts on Order</option>
                <option value="reschedule">Reschedule</option>
                <option value="need_to_contact">Need to Contact</option>
                <option value="unreachable">Unreachable</option>
                <option value="failed">APR — Additional Parts Required</option>
                <option value="recall">Recall / Warranty Return</option>
                <option value="redo">Redo</option>
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 dark:text-gray-300 mb-2">Notes</label>
              <textarea
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-white"
                rows={4}
                placeholder="Add notes about this status change"
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStatusUpdate}
                className="btn-primary"
                disabled={!newStatus || isMutating}
              >
                {isMutating ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </div>
        </Modal>
        
        {/* Delete Modal */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setDeleteModalError(null);
          }}
          title="Delete Work Order"
        >
          <div className="p-4">
            <p className="mb-4 text-gray-700 dark:text-gray-300">
              Are you sure you want to delete this work order? This action cannot be undone.
            </p>
            {deleteModalError && (
              <ErrorAlert message={deleteModalError} />
            )}
            
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="btn-danger"
                disabled={isMutating}
              >
                {isMutating ? 'Deleting...' : 'Delete Work Order'}
              </button>
            </div>
          </div>
        </Modal>

        </div>
        {/* End content card container */}
        </>
        )}

        </div>
      </div>

      {/* Mobile sticky action bar */}
      <div
        className="md:hidden fixed inset-x-0 bottom-0 z-[1188] border-t border-white/10 bg-[#0B1120]/95 backdrop-blur-md px-3 pt-2 flex gap-2"
        style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={() => setShowStatusModal(true)}
          className="flex-1 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-cyan-700 text-xs font-semibold uppercase tracking-wide text-white shadow-[0_0_20px_rgba(34,211,238,0.25)] active:scale-[0.98]"
        >
          Update status
        </button>
        {activeTab === TABS.NOTES && (
          <button
            type="button"
            onClick={() => setNotesAddSheetOpen(true)}
            className="h-10 shrink-0 rounded-xl border border-cyan-500/35 px-3 text-[11px] font-semibold uppercase tracking-wide text-cyan-300"
          >
            Add note
          </button>
        )}
        {activeTab !== TABS.INVOICES && (
          <button
            type="button"
            onClick={() => setActiveTab(TABS.INVOICES)}
            className="h-10 shrink-0 rounded-xl border border-white/15 px-3 text-[11px] font-semibold uppercase tracking-wide text-gray-300"
          >
            Billing
          </button>
        )}
      </div>

      <RecordPaymentSheet
        open={showRecordPayment}
        onClose={() => setShowRecordPayment(false)}
        workOrderId={workOrder?.id}
        dueToday={billingTotals.dueToday}
        suggestedTax={billingTotals.taxOnBillableParts}
        onSuccess={() => {
          refetch();
          alert('Payment recorded.');
        }}
        variant="mobile"
      />

      </div>
    </>
  );
}

WorkOrderDetail.getLayout = function getLayout(page) {
  return <TechDashboardLayout>{page}</TechDashboardLayout>;
};

export async function getServerSideProps(context) {
  const session = await getSession(context.req, context.res);
  
  if (!session) {
    return {
      redirect: {
        destination: '/api/auth/login',
        permanent: false,
      },
    };
  }
  
  return {
    props: {},
  };
}

export default WorkOrderDetail;