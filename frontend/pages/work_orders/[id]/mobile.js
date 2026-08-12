import { useRouter } from 'next/router';
import { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import { getSession } from '@auth0/nextjs-auth0';
import { useUser } from '@auth0/nextjs-auth0/client';
import Head from 'next/head';
import Link from 'next/link';
import { format } from 'date-fns';
import { FaEdit, FaPrint, FaEllipsisH, FaExclamationTriangle, FaCalendarAlt, FaClipboardList, FaToolbox, FaUserAlt, FaFileInvoiceDollar, FaChevronDown, FaChevronUp, FaReceipt, FaCamera, FaLock, FaArrowLeft, FaPlus, FaWrench, FaCalendarPlus, FaStickyNote } from 'react-icons/fa';
import TechDashboardLayout from '../../../components/layouts/TechDashboardLayout';
import StatusBadge from '../../../components/ui/StatusBadge';
import MapsAddressLink from '../../../components/ui/MapsAddressLink';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import MobileActionSheet, { MobileActionSheetButton, MobileActionSheetGridTile } from '../../../components/ui/MobileActionSheet';
import { useWorkOrder, useWorkOrderMutations } from '../../../hooks/useWorkOrders';
import { apiClient } from '../../../utils/api-client';
import { useTheme } from '../../../context/ThemeContext';
import AppointmentScheduler from '../../../components/work_orders/AppointmentScheduler';
import WorkOrderTabPanel from '../../../components/work_orders/WorkOrderTabPanel';
import { resolveWorkOrderServiceAddress } from '../../../utils/appointment-scheduling';
import WorkOrderDetailsAppointmentsList from '../../../components/work_orders/WorkOrderDetailsAppointmentsList';
import WorkOrderNotes from '../../../components/work_orders/WorkOrderNotes';
import WorkOrderNoteTypePicker from '../../../components/work_orders/WorkOrderNoteTypePicker';
import EquipmentDetails from '../../../components/work_orders/EquipmentDetails';
import WorkOrderDebriefing from '../../../components/work_orders/WorkOrderDebriefing';
import WorkOrderPerformancePanel from '../../../components/work_orders/WorkOrderPerformancePanel';
import WorkOrderRedoBar from '../../../components/work_orders/WorkOrderRedoBar';
import PortalSchedulingApprovalBar from '../../../components/work_orders/PortalSchedulingApprovalBar';
import WorkOrderRedoParentLink from '../../../components/work_orders/WorkOrderRedoParentLink';
import WorkOrderCloseModal from '../../../components/work_orders/WorkOrderCloseModal';
import WoMobileGlassSection, {
  WO_MOBILE_FIELD_LABEL,
  WO_MOBILE_FIELD_VALUE,
  WO_MOBILE_SECTION_LABEL,
} from '../../../components/work_orders/WoMobileGlassSection';
import WorkOrderMobileDetailsTab from '../../../components/work_orders/WorkOrderMobileDetailsTab';
import WoMobileTextTabs from '../../../components/work_orders/WoMobileTextTabs';
import { reopenWorkOrder, saveWorkOrderServiceLineEdits, updateServiceBillingStatus, waiveWorkOrderDiagnosticFee, deleteWorkOrderEstimateLine } from '../../../services/api/workOrdersApi';
import RecordPaymentSheet from '../../../components/work_orders/RecordPaymentSheet';
import WorkOrderSquarePaymentSheet from '../../../components/work_orders/WorkOrderSquarePaymentSheet';
import WorkOrderDocumentPdfSheet from '../../../components/work_orders/WorkOrderDocumentPdfSheet';
import EstimateSkuModal from '../../../components/work_orders/EstimateSkuModal';
import RepairOutcomePromptSheet from '../../../components/dma/RepairOutcomePromptSheet';
import WorkOrderExpensesPanel from '../../../components/work_orders/WorkOrderExpensesPanel';
import WorkOrderMileageSection from '../../../components/work_orders/WorkOrderMileageSection';
import JobEconomicsCard from '../../../components/work_orders/JobEconomicsCard';
import PropertyServiceHistory from '../../../components/work_orders/PropertyServiceHistory';
import { getWorkOrderOutcomeStatus } from '../../../services/api/dmaApi';
import { REPAIR_OUTCOME_NOTE_TYPE } from '../../../constants/dmaCodes';
import { hasCompletedRepairAppointment } from '../../../utils/appointmentStatusLabels';
import {
  computeWorkOrderDueToday,
  formatTaxPercent,
  isPartLinePaid,
  isUnscheduledEstimateLine,
  resolveWorkOrderTaxRate,
  round2,
  SERVICE_BILLING_STATUS_OPTIONS,
  taxablePartsSubtotal,
} from '../../../utils/workOrderBilling';
import { formatAppointmentStatus } from '../../../utils/appointmentStatusLabels';
import { useTechDashboardRail } from '../../../components/layouts/TechDashboardLayout';
import { useUserRole } from '../../../utils/auth0-helpers';
import { isWorkOrderClosed, isWorkOrderImmutable, isWorkOrderReadOnly, canEditWorkOrderBilling, canShowCloseOrderAction, canReopenWorkOrder } from '../../../utils/workOrderPermissions';
import { workOrderStatusOptionsForUser } from '../../../utils/workOrderStatusOptions';
import { usePrefetchTechnicians } from '../../../hooks/usePrefetchTechnicians';
import useCurrentTechnicianId from '../../../hooks/useCurrentTechnicianId';
import { useWorkOrderMountedTabs } from '../../../hooks/useWorkOrderMountedTabs';
import { useExpenseCategories, useExpenseVendors } from '../../../hooks/useJobEconomicsReferenceData';
import { usePrefetchDmaSuggestions } from '../../../hooks/useDmaSuggestions';

// Tabs for the detail page
const TABS = {
  DETAILS: 'details',
  APPOINTMENTS: 'appointments',
  NOTES: 'notes',
  MODEL: 'model',
  CLIENT: 'client',
  INVOICES: 'invoices',
  COSTS: 'costs',
};

const TAB_ITEMS = [
  { id: TABS.DETAILS, label: 'Overview', Icon: FaClipboardList },
  { id: TABS.APPOINTMENTS, label: 'Appointments', Icon: FaCalendarAlt },
  { id: TABS.NOTES, label: 'Notes', Icon: FaClipboardList },
  { id: TABS.MODEL, label: 'Equipment', Icon: FaToolbox },
  { id: TABS.CLIENT, label: 'Client', Icon: FaUserAlt },
  { id: TABS.INVOICES, label: 'Billing', Icon: FaFileInvoiceDollar },
  { id: TABS.COSTS, label: 'Costs', Icon: FaReceipt },
];

function computeMobileBillingTotals(workOrder, allServices, halfDiagnosticDiscount) {
  return computeWorkOrderDueToday(workOrder, allServices, halfDiagnosticDiscount);
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
  const { isManager, role } = useUserRole();
  const manualStatusOptions = useMemo(
    () => workOrderStatusOptionsForUser({ role, isManager }),
    [role, isManager],
  );
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [activeTab, setActiveTab] = useState(
    router.query.tab === 'appointments' ? TABS.APPOINTMENTS :
    router.query.tab === 'details' ? TABS.DETAILS :
    TABS.DETAILS
  );
  const { isTabMounted, markTabMounted } = useWorkOrderMountedTabs(activeTab);
  const [statusModalError, setStatusModalError] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isApplyingPayment, setIsApplyingPayment] = useState(false);
  const [clientWorkOrders, setClientWorkOrders] = useState([]);
  const [clientWorkOrdersLoading, setClientWorkOrdersLoading] = useState(false);
  const [halfDiagnosticDiscount, setHalfDiagnosticDiscount] = useState(false);
  const [editingServicePrice, setEditingServicePrice] = useState(null); // { id, price, unit_price, name, billing_status }
  const [editingPartPrice, setEditingPartPrice] = useState(null); // { id, price, cost }
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const [adminBillingServiceId, setAdminBillingServiceId] = useState('');
  const [adminBillingStatus, setAdminBillingStatus] = useState('waived');
  const [isUpdatingBillingStatus, setIsUpdatingBillingStatus] = useState(false);
  const [showRecordPayment, setShowRecordPayment] = useState(false);
  const [showSquarePayment, setShowSquarePayment] = useState(false);
  const [showDocumentPdf, setShowDocumentPdf] = useState(false);
  const [showEstimateSkuModal, setShowEstimateSkuModal] = useState(false);
  const [deletingEstimateLineId, setDeletingEstimateLineId] = useState(null);
  const [fieldPayments, setFieldPayments] = useState([]);
  const [glassSectionsOpen, setGlassSectionsOpen] = useState({
    detailsWorkOrder: true,
    detailsAppointments: false,
    detailsTenant: false,
    detailsServices: false,
    detailsPerformance: false,
    clientInfo: true,
    clientServiceProperty: false,
    clientAllProperties: false,
    clientOtherOrders: false,
  });
  const [notesAddSheetOpen, setNotesAddSheetOpen] = useState(false);
  const [notesAddNoteType, setNotesAddNoteType] = useState(null);
  const [showNoteTypePicker, setShowNoteTypePicker] = useState(false);
  const [notesPhotoSheetOpen, setNotesPhotoSheetOpen] = useState(false);
  const [guidedDiagnosticsOpen, setGuidedDiagnosticsOpen] = useState(false);
  const [showRepairOutcomePrompt, setShowRepairOutcomePrompt] = useState(false);
  const [missingRepairOutcome, setMissingRepairOutcome] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [mobileAddSheetOpen, setMobileAddSheetOpen] = useState(false);
  const [dockReturnTab, setDockReturnTab] = useState(null);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const { theme } = useTheme();

  // Fetch work order details
  const { data: workOrder, isLoading, error, refetch } = useWorkOrder(id);
  const showInitialLoader = isLoading && !workOrder;
  const woClosed = useMemo(() => isWorkOrderClosed(workOrder), [workOrder]);
  const woImmutable = useMemo(() => isWorkOrderImmutable(workOrder), [workOrder]);
  const woRedoReadOnly = useMemo(() => isWorkOrderReadOnly(workOrder), [workOrder]);
  const woReadOnly = woClosed || woImmutable || woRedoReadOnly;
  const billingEditable = useMemo(
    () => canEditWorkOrderBilling({ role, workOrder }),
    [role, workOrder]
  );

  const handleDeleteEstimateLine = async (serviceLineId, serviceName) => {
    if (!window.confirm(`Remove "${serviceName || 'this SKU'}" from the estimate?`)) return;
    setDeletingEstimateLineId(serviceLineId);
    try {
      await deleteWorkOrderEstimateLine(serviceLineId);
      refetch();
    } catch (err) {
      alert(err.message || 'Failed to remove estimate line');
    } finally {
      setDeletingEstimateLineId(null);
    }
  };
  const showCloseAction = useMemo(
    () => canShowCloseOrderAction({ role, workOrder }),
    [role, workOrder]
  );
  const showReopenAction = useMemo(
    () => canReopenWorkOrder({ role, workOrder }),
    [role, workOrder]
  );

  usePrefetchTechnicians();
  useCurrentTechnicianId();
  useExpenseCategories();
  useExpenseVendors();
  usePrefetchDmaSuggestions(workOrder);

  useEffect(() => {
    markTabMounted(activeTab);
  }, [activeTab, markTabMounted]);

  const refreshOutcomeStatus = useCallback(async () => {
    if (!workOrder?.id || workOrder.status !== 'completed') {
      setMissingRepairOutcome(false);
      return;
    }
    try {
      const status = await getWorkOrderOutcomeStatus(workOrder.id);
      setMissingRepairOutcome(!status?.has_outcome);
    } catch {
      setMissingRepairOutcome(false);
    }
  }, [workOrder?.id, workOrder?.status]);

  useEffect(() => {
    refreshOutcomeStatus();
  }, [refreshOutcomeStatus]);

  const prevNotesAddSheetOpen = useRef(false);
  useEffect(() => {
    if (prevNotesAddSheetOpen.current && !notesAddSheetOpen) {
      refreshOutcomeStatus();
    }
    prevNotesAddSheetOpen.current = notesAddSheetOpen;
  }, [notesAddSheetOpen, refreshOutcomeStatus]);

  const openNoteWithType = useCallback((type) => {
    markTabMounted(TABS.NOTES);
    setActiveTab(TABS.NOTES);
    setNotesAddNoteType(type);
    setNotesAddSheetOpen(true);
  }, [markTabMounted]);

  const openRepairOutcomeNote = useCallback(() => {
    setShowRepairOutcomePrompt(false);
    openNoteWithType(REPAIR_OUTCOME_NOTE_TYPE);
  }, [openNoteWithType]);

  const runAfterTabMount = useCallback((tabId, run) => {
    if (activeTab !== tabId) {
      setDockReturnTab(activeTab);
    }
    markTabMounted(tabId);
    setActiveTab(tabId);
    window.setTimeout(run, 120);
  }, [markTabMounted, activeTab]);

  const selectWorkOrderTab = useCallback((tabId) => {
    setDockReturnTab(null);
    setActiveTab(tabId);
  }, []);

  const handleMobileDockBack = useCallback(() => {
    if (dockReturnTab) {
      setActiveTab(dockReturnTab);
      setDockReturnTab(null);
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/work_orders/test');
  }, [router, dockReturnTab]);

  const mobileMoreRef = useRef(null);
  const moreButtonRef = useRef(null);
  const appointmentSchedulerRef = useRef(null);
  const equipmentDetailsRef = useRef(null);

  /** HUD grid double-tap for icon rail - attach after data loads */
  const tacticalColumnRef = useRef(null);
  const { openRail } = useTechDashboardRail() || {};
  const headerCardRef = useRef(null);
  const [hudGridShift, setHudGridShift] = useState({ x: 0, y: 0 });

  // Attach double-tap listener AFTER work order loads
  useEffect(() => {
    if (showInitialLoader || error || !tacticalColumnRef.current || !openRail) return;
    
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
  }, [showInitialLoader, error, openRail]);

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
    if (!mobileMoreOpen) return undefined;
    function onKeyDown(e) {
      if (e.key === 'Escape') setMobileMoreOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileMoreOpen]);



  // Services come directly from the work order
  const allServices = workOrder?.services || [];

  const toggleGlassSection = useCallback((key) => {
    setGlassSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const detailsWorkOrderSummary = useMemo(() => {
    const client =
      workOrder?.client?.company_name ||
      workOrder?.client_name ||
      `${workOrder?.client?.first_name || ''} ${workOrder?.client?.last_name || ''}`.trim();
    const addr = workOrder ? resolveWorkOrderServiceAddress(workOrder) : null;
    return client || addr || 'Order summary';
  }, [workOrder]);

  const detailsTenantSummary = useMemo(() => {
    const prop = workOrder?.property;
    if (!prop) return '';
    return (
      [prop.unit_number && `Unit ${prop.unit_number}`, prop.gate_code && `Gate ${prop.gate_code}`, prop.tenant_name]
        .filter(Boolean)[0] || 'Access details'
    );
  }, [workOrder?.property]);

  const detailsServicesSummary = useMemo(() => {
    const s = allServices?.length || 0;
    const p = workOrder?.parts?.length || 0;
    if (!s && !p) return 'No line items';
    return [
      s ? `${s} service${s === 1 ? '' : 's'}` : null,
      p ? `${p} part${p === 1 ? '' : 's'}` : null,
    ]
      .filter(Boolean)
      .join(', ');
  }, [allServices, workOrder?.parts]);

  const appointmentsSummary = useMemo(() => {
    const n = workOrder?.appointments?.length || 0;
    if (!n) return 'Not scheduled';
    return `${n} visit${n === 1 ? '' : 's'}`;
  }, [workOrder?.appointments]);

  const clientInfoSummary = useMemo(() => {
    const name = `${workOrder?.client_user?.first_name || workOrder?.client?.first_name || ''} ${workOrder?.client_user?.last_name || workOrder?.client?.last_name || ''}`.trim();
    return name || workOrder?.client?.company_name || 'Client profile';
  }, [workOrder]);

  const billingTotals = useMemo(
    () => computeMobileBillingTotals(workOrder, allServices, halfDiagnosticDiscount),
    [workOrder, allServices, halfDiagnosticDiscount]
  );
  const resolvedServiceAddress = useMemo(
    () => (workOrder ? resolveWorkOrderServiceAddress(workOrder) : null),
    [workOrder]
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
      (async () => {
        await refetch();
        try {
          const wo = await apiClient(`work-orders/${id}`);
          const status = await getWorkOrderOutcomeStatus(id);
          if (wo?.status === 'completed' && !status?.has_outcome) {
            setMissingRepairOutcome(true);
            setShowRepairOutcomePrompt(true);
          } else {
            alert('Payment successful! Your work order has been updated.');
          }
        } catch {
          alert('Payment successful! Your work order has been updated.');
        }
        router.replace(`/work_orders/${id}/mobile`, undefined, { shallow: true });
      })();
    } else if (payment === 'canceled' || payment === 'cancelled') {
      alert('Payment was canceled. You can try again anytime.');
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

  const handleReopen = async () => {
    if (!window.confirm('Reopen this work order for admin edits?')) return;
    setMobileMoreOpen(false);
    setLifecycleBusy(true);
    try {
      await reopenWorkOrder(id);
      await refetch();
    } catch (err) {
      window.alert(err.message || 'Reopen failed');
    } finally {
      setLifecycleBusy(false);
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

        {showInitialLoader && (
          <div className="py-6">
            <LoadingSpinner size="large" />
          </div>
        )}

        {error && !workOrder && (
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

        {!showInitialLoader && workOrder && (
          <>
        {missingRepairOutcome && (
          <button
            type="button"
            onClick={openRepairOutcomeNote}
            className="mb-4 w-full rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-left"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
              Repair outcome missing
            </p>
            <p className="mt-1 text-sm text-amber-100/90">
              This job is complete but not in Repair Memory yet. Tap to log what you fixed.
            </p>
          </button>
        )}
        {/* Header card */}
        <div className="relative mb-4">
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
                        <StatusBadge status={workOrder.status === 'redo' ? 'redo' : (workOrder.is_closed ? 'closed' : workOrder.status)} />
                        <WorkOrderRedoParentLink workOrder={workOrder} variant="mobile" />
                        {user && (
                          <WorkOrderRedoBar
                            compact
                            variant="mobile"
                            workOrder={workOrder}
                            workOrderId={id}
                            user={user}
                            onRefresh={refetch}
                          />
                        )}
                      </div>
                      <p className="text-xs md:text-sm text-gray-400 mt-1">
                        Created {format(new Date(workOrder.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
            {/* Mobile ⋯ — opens portaled action sheet (avoids hud-grid pointer-events traps) */}
            <div className="relative shrink-0 md:hidden" ref={mobileMoreRef}>
              <button
                ref={moreButtonRef}
                type="button"
                onClick={() => setMobileMoreOpen(true)}
                className="touch-target inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/12 bg-[#0D1525] text-gray-300 active:bg-white/5"
                aria-expanded={mobileMoreOpen}
                aria-label="More actions"
              >
                <FaEllipsisH className="text-lg" />
              </button>
            </div>
                    </div>

                  {/* Desktop actions */}
                  <div className="hidden md:flex flex-wrap gap-2">
                    {!woReadOnly && (
                    <Link href={`/work_orders/${id}/womobile_edit`} className="btn-primary flex items-center h-10" title="Edit work order">
                      <FaEdit className="mr-2" />
                      Edit
                    </Link>
                    )}
                    <button type="button" onClick={() => window.print()} className="btn-white flex items-center h-10" title="Print work order">
                      <FaPrint className="mr-2" />
                      Print
                    </button>
                    {!woReadOnly && (
                    <button
                      type="button"
                      onClick={() => setShowStatusModal(true)}
                      className="btn-secondary flex items-center h-10"
                      title="Update status"
                    >
                      Update Status
                    </button>
                    )}
                    {showCloseAction && (
                      <button
                        type="button"
                        onClick={() => setShowCloseModal(true)}
                        className="btn-primary flex items-center h-10"
                        title="Close work order"
                      >
                        Close Order
                      </button>
                    )}
                    {showReopenAction && (
                      <button
                        type="button"
                        onClick={handleReopen}
                        disabled={lifecycleBusy}
                        className="btn-secondary flex items-center h-10"
                        title="Reopen for admin edits"
                      >
                        Reopen
                      </button>
                    )}
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


        {user && (
          <WorkOrderRedoBar
            variant="mobile"
            workOrder={workOrder}
            workOrderId={id}
            user={user}
            onRefresh={refetch}
          />
        )}

        <PortalSchedulingApprovalBar workOrder={workOrder} onUpdated={refetch} />

        {/* {woClosed && <WorkOrderReadOnlyBanner className="mb-4" />} */}

        <div className="md:hidden static mb-2">
          <WoMobileTextTabs
            items={TAB_ITEMS.map(({ id, label }) => ({ id, label }))}
            activeId={activeTab}
            onSelect={selectWorkOrderTab}
          />
        </div>

        {/* Content card container — tighter outer gutter on mobile Details */}
        <div
          className={`rounded-lg overflow-visible md:p-3 ${
            activeTab === TABS.DETAILS ? 'px-2 py-2' : 'p-3'
          }`}
          style={{ background: 'rgba(13, 21, 37, 0.25)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)' }}
          data-hud-card
        >

        {/* Desktop tabs */}
        <div className="hidden md:block border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="-mb-px flex flex-wrap gap-x-4 gap-y-1">
            {TAB_ITEMS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => selectWorkOrderTab(id)}
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
        <div className="min-w-0 relative z-0">
          {/* Details Tab */}
          <WorkOrderTabPanel tab={TABS.DETAILS} activeTab={activeTab} isMounted={isTabMounted(TABS.DETAILS)} className="px-0 py-2 min-w-0 md:px-1 md:space-y-3">
          <>
              <div className="md:hidden">
                <WorkOrderMobileDetailsTab
                  workOrder={workOrder}
                  resolvedServiceAddress={resolvedServiceAddress}
                  allServices={allServices}
                  glassSectionsOpen={glassSectionsOpen}
                  toggleGlassSection={toggleGlassSection}
                  detailsTenantSummary={detailsTenantSummary}
                  detailsServicesSummary={detailsServicesSummary}
                  appointmentsSummary={appointmentsSummary}
                  onOpenEquipmentTab={() => selectWorkOrderTab(TABS.MODEL)}
                />
              </div>
              <div className="hidden md:block space-y-3">
              <WoMobileGlassSection
                title="Work Order Details"
                summary={detailsWorkOrderSummary}
                isOpen={glassSectionsOpen.detailsWorkOrder}
                onToggle={() => toggleGlassSection('detailsWorkOrder')}
              >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-4">
                    <div>
                      <h3 className={WO_MOBILE_FIELD_LABEL}>Client</h3>
                      <p className={`mt-1 ${WO_MOBILE_FIELD_VALUE}`}>
                        {workOrder.client?.company_name || workOrder.client_name || 
                        `${workOrder.client?.first_name || ''} ${workOrder.client?.last_name || ''}`.trim() || 
                        'No client assigned'}
                      </p>
                    </div>
                    
                    <div className="md:col-span-2">
                      <h3 className={WO_MOBILE_FIELD_LABEL}>Appointments</h3>
                      <WorkOrderDetailsAppointmentsList appointments={workOrder.appointments} />
                    </div>
                    
                    {workOrder.priority && workOrder.priority !== 'medium' && (
                      <div>
                        <h3 className={WO_MOBILE_FIELD_LABEL}>Priority</h3>
                        <p className={`mt-1 ${WO_MOBILE_FIELD_VALUE} capitalize`}>{workOrder.priority}</p>
                      </div>
                    )}
                    
                    <div>
                      <h3 className={WO_MOBILE_FIELD_LABEL}>Service Location</h3>
                      <MapsAddressLink address={resolvedServiceAddress} />
                    </div>
                    
                    <div className="md:col-span-2">
                      <h3 className={WO_MOBILE_FIELD_LABEL}>Description</h3>
                      <p className={`mt-1 ${WO_MOBILE_FIELD_VALUE} whitespace-pre-line`}>{workOrder.description || 'No description provided'}</p>
                    </div>
                  </div>
              </WoMobileGlassSection>
              
              {/* Tenant & Property Access */}
              {workOrder.property && (workOrder.property.tenant_name || workOrder.property.tenant_phone || workOrder.property.unit_number || workOrder.property.gate_code || workOrder.property.access_instructions) && (
                <WoMobileGlassSection
                  title="Tenant & Property Access"
                  summary={detailsTenantSummary}
                  isOpen={glassSectionsOpen.detailsTenant}
                  onToggle={() => toggleGlassSection('detailsTenant')}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-4">
                      {/* Tenant Contact - Lead Information */}
                      {(workOrder.property.tenant_name || workOrder.property.tenant_phone) && (
                        <div className="md:col-span-2">
                          <h3 className={`${WO_MOBILE_SECTION_LABEL} mb-3`}>Tenant / Contact at Property</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {workOrder.property.tenant_name && (
                              <div>
                                <h4 className={WO_MOBILE_FIELD_LABEL}>Name</h4>
                                <p className={`mt-1 ${WO_MOBILE_FIELD_VALUE} font-medium`}>
                                  {workOrder.property.tenant_name}
                                </p>
                              </div>
                            )}
                            {workOrder.property.tenant_phone && (
                              <div>
                                <h4 className={WO_MOBILE_FIELD_LABEL}>Phone</h4>
                                <a 
                                  href={`tel:${workOrder.property.tenant_phone}`}
                                  className="mt-1 text-sm text-cyan-400 hover:underline font-medium inline-block"
                                >
                                  {workOrder.property.tenant_phone}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {workOrder.property.unit_number && (
                        <div className={`${(workOrder.property.tenant_name || workOrder.property.tenant_phone) ? 'md:col-span-2 pt-4 border-t border-white/10' : ''}`}>
                          <h3 className={WO_MOBILE_FIELD_LABEL}>Unit Number</h3>
                          <p className={`mt-1 ${WO_MOBILE_FIELD_VALUE}`}>
                            {workOrder.property.unit_number}
                          </p>
                        </div>
                      )}
                      
                      {workOrder.property.gate_code && (
                        <div className={`${(workOrder.property.tenant_name || workOrder.property.tenant_phone || workOrder.property.unit_number) ? 'pt-4 border-t border-white/10' : ''}`}>
                          <h3 className={WO_MOBILE_FIELD_LABEL}>Gate Code</h3>
                          <p className={`mt-1 ${WO_MOBILE_FIELD_VALUE} font-mono bg-white/[0.06] px-2 py-1 rounded inline-block`}>
                            {workOrder.property.gate_code}
                          </p>
                        </div>
                      )}
                      
                      {workOrder.property.access_instructions && (
                        <div className={`md:col-span-2 ${(workOrder.property.tenant_name || workOrder.property.tenant_phone || workOrder.property.unit_number || workOrder.property.gate_code) ? 'pt-4 border-t border-white/10' : ''}`}>
                          <h3 className={WO_MOBILE_FIELD_LABEL}>Access Instructions</h3>
                          <p className={`mt-2 ${WO_MOBILE_FIELD_VALUE} border border-cyan-500/20 bg-cyan-500/5 rounded-lg p-3`}>
                            {workOrder.property.access_instructions}
                          </p>
                        </div>
                      )}
                    </div>
                </WoMobileGlassSection>
              )}
              
              {/* Services and Items */}
              {(allServices?.length > 0 || workOrder.parts?.length > 0) && (
                <WoMobileGlassSection
                  title="Services & Items"
                  summary={detailsServicesSummary}
                  isOpen={glassSectionsOpen.detailsServices}
                  onToggle={() => toggleGlassSection('detailsServices')}
                >
                    {/* Services */}
                    {allServices?.length > 0 && (
                      <div className="mb-4">
                        <h3 className={`${WO_MOBILE_SECTION_LABEL} mb-3`}>Services</h3>
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
                        <h3 className={`${WO_MOBILE_SECTION_LABEL} mb-3`}>Parts</h3>
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
                </WoMobileGlassSection>
              )}

              <WoMobileGlassSection
                title="Performance"
                summary="On-site, travel & outcomes"
                isOpen={glassSectionsOpen.detailsPerformance}
                onToggle={() => toggleGlassSection('detailsPerformance')}
              >
                <WorkOrderPerformancePanel workOrderId={workOrder.id} variant="mobile" embedded />
              </WoMobileGlassSection>

              <WorkOrderDebriefing workOrderId={workOrder.id} variant="mobile" />
              </div>
            </>
          </WorkOrderTabPanel>

          {workOrder && (
            <WorkOrderTabPanel
              tab={TABS.APPOINTMENTS}
              activeTab={activeTab}
              isMounted={isTabMounted(TABS.APPOINTMENTS)}
              className="px-1 py-2 md:p-6 min-w-0"
            >
              <AppointmentScheduler
                ref={appointmentSchedulerRef}
                workOrderId={id}
                workOrder={workOrder}
                workOrderAddress={workOrder.service_location?.address}
                serviceLocation={workOrder.service_location}
                workOrderProperty={workOrder.property}
                propertyId={workOrder.property_id}
                clientProperties={workOrder.client_properties}
                editWorkOrderHref={`/work_orders/${id}/womobile_edit`}
                key={`appointments-${id}`}
                variant="mobile"
                onAppointmentChange={() => {
                  refetch();
                }}
              />
            </WorkOrderTabPanel>
          )}
          
          <WorkOrderTabPanel
            tab={TABS.COSTS}
            activeTab={activeTab}
            isMounted={isTabMounted(TABS.COSTS)}
            className="px-1 py-2 space-y-4 min-w-0"
          >
              {isManager && workOrder?.id && (
                <JobEconomicsCard workOrderId={workOrder.id} variant="mobile" />
              )}
              <WorkOrderExpensesPanel workOrderId={workOrder.id} variant="mobile" />
              <WorkOrderMileageSection workOrder={workOrder} variant="mobile" />
          </WorkOrderTabPanel>
          
          <WorkOrderTabPanel
            tab={TABS.NOTES}
            activeTab={activeTab}
            isMounted={isTabMounted(TABS.NOTES)}
            className="px-1 py-2 md:p-6 min-w-0"
          >
              <WorkOrderNotes
                workOrderId={workOrder.id}
                workOrder={workOrder}
                variant="mobile"
                addSheetOpen={notesAddSheetOpen}
                onAddSheetOpenChange={(open) => {
                  setNotesAddSheetOpen(open);
                  if (!open) setNotesAddNoteType(null);
                }}
                addNoteType={notesAddNoteType}
                photoSheetOpen={notesPhotoSheetOpen}
                onPhotoSheetOpenChange={setNotesPhotoSheetOpen}
                onGuidedDiagnosticsOpenChange={(open) => {
                  setGuidedDiagnosticsOpen(open);
                  if (!open) setNotesAddNoteType(null);
                }}
              />
          </WorkOrderTabPanel>
          
          <WorkOrderTabPanel
            tab={TABS.MODEL}
            activeTab={activeTab}
            isMounted={isTabMounted(TABS.MODEL)}
            className="px-1 py-2 md:p-6 min-w-0 md:bg-white md:dark:bg-gray-800 md:shadow md:rounded-lg md:overflow-hidden md:mb-6"
          >
              <div className="hidden md:block px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Equipment Details</h2>
              </div>
              <div className="md:px-6 md:py-5">
                <EquipmentDetails
                  ref={equipmentDetailsRef}
                  workOrderId={workOrder.id}
                  workOrder={workOrder}
                  onUpdate={refetch}
                  variant="mobile"
                />
              </div>
          </WorkOrderTabPanel>
          
          <WorkOrderTabPanel tab={TABS.CLIENT} activeTab={activeTab} isMounted={isTabMounted(TABS.CLIENT)} className="px-1 py-2 space-y-3 min-w-0">
              <WoMobileGlassSection
                title="Client Information"
                summary={clientInfoSummary}
                isOpen={glassSectionsOpen.clientInfo}
                onToggle={() => toggleGlassSection('clientInfo')}
              >
                  {(workOrder.client_user || workOrder.client) ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-4">
                      <div>
                        <h3 className={WO_MOBILE_FIELD_LABEL}>Name</h3>
                        <p className={`mt-1 ${WO_MOBILE_FIELD_VALUE}`}>
                          {`${(workOrder.client_user?.first_name || workOrder.client?.first_name || '')} ${(workOrder.client_user?.last_name || workOrder.client?.last_name || '')}`.trim() || 'N/A'}
                        </p>
                      </div>
                      {workOrder.client?.company_name && (
                        <div>
                          <h3 className={WO_MOBILE_FIELD_LABEL}>Company</h3>
                          <p className={`mt-1 ${WO_MOBILE_FIELD_VALUE}`}>
                            {workOrder.client.company_name}
                          </p>
                        </div>
                      )}
                      <div>
                        <h3 className={WO_MOBILE_FIELD_LABEL}>Email</h3>
                        <p className={`mt-1 ${WO_MOBILE_FIELD_VALUE}`}>
                          {workOrder.client_user?.email || workOrder.client?.email || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <h3 className={WO_MOBILE_FIELD_LABEL}>Phone</h3>
                        <p className={`mt-1 ${WO_MOBILE_FIELD_VALUE}`}>
                          {workOrder.client?.phone || workOrder.client?.mobile || 'N/A'}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <Link href={`/clients/${workOrder.client_id}/mobile`} className="text-cyan-400 hover:text-cyan-300 text-sm">
                          View Full Client Profile →
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4 text-sm">
                      No client information available.
                    </p>
                  )}
              </WoMobileGlassSection>

              {workOrder.property && (
                <WoMobileGlassSection
                  title="Service Property"
                  summary={resolvedServiceAddress || 'Property on file'}
                  isOpen={glassSectionsOpen.clientServiceProperty}
                  onToggle={() => toggleGlassSection('clientServiceProperty')}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-4">
                      <div className="md:col-span-2">
                        <h3 className={WO_MOBILE_FIELD_LABEL}>Address</h3>
                        <MapsAddressLink
                          address={resolvedServiceAddress}
                          emptyLabel="N/A"
                        />
                      </div>
                      {workOrder.property.property_type && (
                        <div>
                          <h3 className={WO_MOBILE_FIELD_LABEL}>Property Type</h3>
                          <p className={`mt-1 ${WO_MOBILE_FIELD_VALUE} capitalize`}>
                            {workOrder.property.property_type}
                          </p>
                        </div>
                      )}
                      {workOrder.property.gate_code && (
                        <div>
                          <h3 className={WO_MOBILE_FIELD_LABEL}>Gate Code</h3>
                          <p className={`mt-1 ${WO_MOBILE_FIELD_VALUE} font-mono`}>
                            {workOrder.property.gate_code}
                          </p>
                        </div>
                      )}
                      {workOrder.property.access_instructions && (
                        <div className="md:col-span-2">
                          <h3 className={WO_MOBILE_FIELD_LABEL}>Access Instructions</h3>
                          <p className={`mt-1 ${WO_MOBILE_FIELD_VALUE}`}>
                            {workOrder.property.access_instructions}
                          </p>
                        </div>
                      )}
                      {(workOrder.property.tenant_name || workOrder.property.tenant_phone || workOrder.property.tenant_email) && (
                        <div className="md:col-span-2 pt-4 border-t border-white/10">
                          <h3 className={`${WO_MOBILE_SECTION_LABEL} mb-3`}>Tenant Information</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {workOrder.property.tenant_name && (
                              <div>
                                <p className={WO_MOBILE_FIELD_LABEL}>Name</p>
                                <p className={`mt-1 ${WO_MOBILE_FIELD_VALUE}`}>{workOrder.property.tenant_name}</p>
                              </div>
                            )}
                            {workOrder.property.tenant_phone && (
                              <div>
                                <p className={WO_MOBILE_FIELD_LABEL}>Phone</p>
                                <p className={`mt-1 ${WO_MOBILE_FIELD_VALUE}`}>{workOrder.property.tenant_phone}</p>
                              </div>
                            )}
                            {workOrder.property.tenant_email && (
                              <div>
                                <p className={WO_MOBILE_FIELD_LABEL}>Email</p>
                                <p className={`mt-1 ${WO_MOBILE_FIELD_VALUE}`}>{workOrder.property.tenant_email}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                </WoMobileGlassSection>
              )}

              {(workOrder.property_id || workOrder.property?.id) && (
                <PropertyServiceHistory
                  propertyId={workOrder.property_id || workOrder.property?.id}
                  variant="mobile"
                />
              )}

              {workOrder.client_properties && workOrder.client_properties.length > 0 && (
                <WoMobileGlassSection
                  title={`All Properties (${workOrder.client_properties.length})`}
                  summary={`${workOrder.client_properties.length} on file`}
                  isOpen={glassSectionsOpen.clientAllProperties}
                  onToggle={() => toggleGlassSection('clientAllProperties')}
                >
                    <div className="space-y-3">
                      {workOrder.client_properties.map((property) => (
                        <div key={property.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium ${WO_MOBILE_FIELD_VALUE}`}>
                                {property.address}
                                {property.unit_number && ` - Unit ${property.unit_number}`}
                              </p>
                              {property.property_type && (
                                <p className="text-sm text-gray-500 capitalize mt-1">
                                  {property.property_type}
                                </p>
                              )}
                            </div>
                            {workOrder.property_id === property.id && (
                              <span className="ml-2 px-2 py-1 text-xs font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/25 rounded shrink-0">
                                Service Location
                              </span>
                            )}
                          </div>
                          {(property.gate_code || property.tenant_name) && (
                            <div className="mt-2 pt-2 border-t border-white/10">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                {property.gate_code && (
                                  <p className="text-gray-500">
                                    Gate: <span className="font-mono text-gray-200">{property.gate_code}</span>
                                  </p>
                                )}
                                {property.tenant_name && (
                                  <p className="text-gray-500">
                                    Tenant: <span className="text-gray-200">{property.tenant_name}</span>
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                </WoMobileGlassSection>
              )}

              <WoMobileGlassSection
                title="Other Work Orders"
                summary={
                  clientWorkOrdersLoading
                    ? 'Loading…'
                    : clientWorkOrders.length
                      ? `${clientWorkOrders.length} other order${clientWorkOrders.length === 1 ? '' : 's'}`
                      : 'None on file'
                }
                isOpen={glassSectionsOpen.clientOtherOrders}
                onToggle={() => toggleGlassSection('clientOtherOrders')}
              >
                  {clientWorkOrdersLoading ? (
                    <div className="flex justify-center py-6"><LoadingSpinner /></div>
                  ) : clientWorkOrders.length === 0 ? (
                    <p className="text-gray-500 text-center py-4 text-sm">No other work orders for this client.</p>
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
              </WoMobileGlassSection>
          </WorkOrderTabPanel>
          
          <WorkOrderTabPanel
            tab={TABS.INVOICES}
            activeTab={activeTab}
            isMounted={isTabMounted(TABS.INVOICES)}
            className="mb-6 min-w-0 overflow-x-hidden md:rounded-lg md:border md:border-gray-200 md:dark:border-gray-700 md:bg-white md:dark:bg-gray-800 md:shadow"
          >
              <div className="flex flex-col gap-3 mb-3 px-0.5 md:mb-0 md:border-b md:border-gray-200 md:dark:border-gray-700 md:px-6 md:py-5 md:bg-gray-50 md:dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 md:text-lg md:font-medium md:normal-case md:tracking-normal md:text-gray-900 md:dark:text-white">
                  Billing
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  {!woReadOnly && (
                    <button
                      type="button"
                      onClick={() => setShowEstimateSkuModal(true)}
                      className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide rounded-lg border border-cyan-500/35 text-cyan-300 transition-colors md:px-3 md:py-1.5 md:text-sm md:normal-case md:tracking-normal md:rounded md:border md:border-cyan-200 md:dark:border-cyan-800 md:text-cyan-700 md:dark:text-cyan-300 md:bg-cyan-50 md:dark:bg-cyan-900/30"
                    >
                      Add estimate SKU
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowDocumentPdf(true)}
                    className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide rounded-lg border border-cyan-500/35 text-cyan-300 transition-colors md:px-3 md:py-1.5 md:text-sm md:normal-case md:tracking-normal md:rounded md:border-0 md:bg-cyan-600 md:text-white md:hover:bg-cyan-700"
                  >
                    PDF
                  </button>
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
                                        {isUnscheduledEstimateLine(item) && (
                                          <span className="ml-1 inline-flex px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide rounded bg-slate-500/30 text-slate-300">
                                            Unscheduled
                                          </span>
                                        )}
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
                                {isEditingThis ? (
                                  <div className="mt-3">
                                    <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">
                                      Billing status
                                    </label>
                                    <select
                                      className="w-full px-2 py-1.5 text-sm border border-cyan-500/40 rounded-lg bg-[#0B1120] text-white"
                                      value={editingServicePrice.billing_status}
                                      onChange={(e) =>
                                        setEditingServicePrice((prev) => ({
                                          ...prev,
                                          billing_status: e.target.value,
                                        }))
                                      }
                                    >
                                      {SERVICE_BILLING_STATUS_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                ) : null}
                                <div className="mt-3 pt-2 border-t border-white/10 flex justify-end">
                                  {isEditingThis ? (
                                    <div className="flex gap-2 w-full">
                                      <button
                                        type="button"
                                        disabled={isSavingPrice}
                                        onClick={async () => {
                                          setIsSavingPrice(true);
                                          try {
                                            await saveWorkOrderServiceLineEdits(item.id, {
                                              name: editingServicePrice.name,
                                              unit_price: editingServicePrice.unit_price,
                                              price: editingServicePrice.price,
                                              billing_status: editingServicePrice.billing_status,
                                              previousBillingStatus: item.billing_status,
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
                                    <div className="flex items-center justify-end gap-3">
                                      {billingEditable ? (
                                        <button
                                          type="button"
                                          onClick={() => setEditingServicePrice({
                                            id: item.id,
                                            name: item.name,
                                            unit_price: item.unit_price,
                                            price: item.price,
                                            billing_status: item.billing_status || 'not_billable',
                                          })}
                                          className="text-xs font-semibold uppercase tracking-wide text-cyan-300"
                                        >
                                          Edit line
                                        </button>
                                      ) : null}
                                      {!woReadOnly && isUnscheduledEstimateLine(item) ? (
                                        <button
                                          type="button"
                                          disabled={deletingEstimateLineId === item.id}
                                          onClick={() => handleDeleteEstimateLine(item.id, item.name)}
                                          className="text-xs font-semibold uppercase tracking-wide text-red-400 disabled:opacity-50"
                                        >
                                          {deletingEstimateLineId === item.id ? 'Removing…' : 'Remove'}
                                        </button>
                                      ) : null}
                                    </div>
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
                                          {isUnscheduledEstimateLine(item) && (
                                            <span className="ml-2 inline-flex px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                              Unscheduled
                                            </span>
                                          )}
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
                                      {isEditingThis ? (
                                        <select
                                          className="w-full min-w-[8rem] px-2 py-1 text-xs border border-blue-400 rounded dark:bg-gray-700 dark:text-white"
                                          value={editingServicePrice.billing_status}
                                          onChange={(e) =>
                                            setEditingServicePrice((prev) => ({
                                              ...prev,
                                              billing_status: e.target.value,
                                            }))
                                          }
                                        >
                                          {SERVICE_BILLING_STATUS_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                          ))}
                                        </select>
                                      ) : (
                                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                        isPaid ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                        isBillable ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                        isWaived ? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' :
                                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                      }`}>
                                        {isPaid ? 'Paid' : isBillable ? 'Due Today' : isWaived ? 'Waived' : 'Not Billable'}
                                      </span>
                                      )}
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
                                                await saveWorkOrderServiceLineEdits(item.id, {
                                                  name: editingServicePrice.name,
                                                  unit_price: editingServicePrice.unit_price,
                                                  price: editingServicePrice.price,
                                                  billing_status: editingServicePrice.billing_status,
                                                  previousBillingStatus: item.billing_status,
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
                                        <div className="flex items-center justify-end gap-2">
                                          {billingEditable ? (
                                            <button
                                              onClick={() => setEditingServicePrice({
                                                id: item.id,
                                                name: item.name,
                                                unit_price: item.unit_price,
                                                price: item.price,
                                                billing_status: item.billing_status || 'not_billable',
                                              })}
                                              className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400"
                                              title="Edit line"
                                            >✏️</button>
                                          ) : null}
                                          {!woReadOnly && isUnscheduledEstimateLine(item) ? (
                                            <button
                                              type="button"
                                              disabled={deletingEstimateLineId === item.id}
                                              onClick={() => handleDeleteEstimateLine(item.id, item.name)}
                                              className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 disabled:opacity-50"
                                              title="Remove estimate line"
                                            >
                                              {deletingEstimateLineId === item.id ? '…' : '✕'}
                                            </button>
                                          ) : null}
                                        </div>
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
                            const isPaid = isPartLinePaid(part, billingTotals.dueToday);
                            const isPartial = !isPaid && (isUpfront50 || (isInstalled && upfrontCollected > 0));
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
                                    ) : billingEditable ? (
                                      <button
                                        type="button"
                                        onClick={() => setEditingPartPrice({ id: part.id, price })}
                                        className="h-9 px-3 rounded-lg border border-cyan-500/35 text-xs font-semibold uppercase tracking-wide text-cyan-300"
                                      >
                                        Edit
                                      </button>
                                    ) : null}
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
                                const isPaid = isPartLinePaid(part, billingTotals.dueToday);
                                const isPartial = !isPaid && (isUpfront50 || (isInstalled && upfrontCollected > 0));
                                
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
                                      ) : billingEditable ? (
                                        <button
                                          onClick={() => setEditingPartPrice({ id: part.id, price: price })}
                                          className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400"
                                          title="Edit price"
                                        >✏️</button>
                                      ) : null}
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
                      const taxRate = resolveWorkOrderTaxRate(workOrder);
                      const taxPct = formatTaxPercent(taxRate);

                      // All services regardless of billing status
                      const servicesSubtotal = (allServices || []).reduce((sum, s) => sum + parseFloat(s.price || 0), 0);

                      // All parts on the work order (matches services subtotal behavior)
                      const partsSubtotal = (workOrder.parts || [])
                        .reduce((sum, p) => sum + parseFloat(p.price || 0), 0);

                      const subtotal = servicesSubtotal + partsSubtotal;

                      // Tax on quoted parts (excludes not_installed)
                      const taxableParts = taxablePartsSubtotal(workOrder);
                      const taxOnParts = round2(taxableParts * taxRate);
                      const grossTotal = round2(subtotal + taxOnParts);

                      // Diagnostic discount — shown always if repair SKU exists, grayed if repair not yet completed
                      const hasRepairSku = (allServices || []).some(s =>
                        s.name?.toLowerCase().includes('repair') ||
                        s.service_definition?.service_type === 'repair'
                      );
                      const repairCompleted = hasCompletedRepairAppointment(workOrder.appointments, {
                        catalogServices: allServices,
                        workOrderServices: allServices,
                      });
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
                              <span className="text-xs text-gray-500">
                                Tax Rate{workOrder.tax_county_name ? ` (${workOrder.tax_county_name})` : ''}
                              </span>
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
                          {!woClosed && (billingTotals.dueToday > 0 || billingTotals.totalWorkOrder > billingTotals.previouslyPaid) && (
                            <div className="mt-4 md:mt-6 md:pt-4 md:border-t md:border-gray-200 md:dark:border-gray-700">
                              {billingTotals.dueToday > 0 ? (
                                <>
                                <div className="flex flex-col sm:flex-row gap-2 justify-center max-w-sm mx-auto sm:max-w-none">
                                <button
                                  type="button"
                                  onClick={() => setShowSquarePayment(true)}
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
                                <span className="text-xs text-gray-500 dark:text-gray-400">Pay Now uses Square · Record for cash, check, etc.</span>
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
                    {billingEditable && (
                      <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:pt-4 md:border-t md:border-gray-200 md:dark:border-gray-700">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 md:text-sm md:font-medium md:normal-case md:tracking-normal md:text-gray-700 md:dark:text-gray-300">
                          Billing Overrides
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Service line</label>
                            <select
                              className="w-full px-3 py-2 border border-white/15 rounded-lg bg-[#0B1120] text-white text-sm md:border-gray-300 md:dark:border-gray-600 md:rounded-md md:bg-white md:dark:bg-gray-700 md:text-gray-900"
                              value={adminBillingServiceId}
                              onChange={(e) => setAdminBillingServiceId(e.target.value)}
                            >
                              <option value="">Select service...</option>
                              {allServices?.map(service => (
                                <option key={service.id} value={service.id}>
                                  {service.name} - {service.billing_status}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">New billing status</label>
                            <select
                              className="w-full px-3 py-2 border border-white/15 rounded-lg bg-[#0B1120] text-white text-sm md:border-gray-300 md:dark:border-gray-600 md:rounded-md md:bg-white md:dark:bg-gray-700 md:text-gray-900"
                              value={adminBillingStatus}
                              onChange={(e) => setAdminBillingStatus(e.target.value)}
                            >
                              {SERVICE_BILLING_STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <button
                              type="button"
                              disabled={!adminBillingServiceId || isUpdatingBillingStatus}
                              onClick={async () => {
                                setIsUpdatingBillingStatus(true);
                                try {
                                  await updateServiceBillingStatus(adminBillingServiceId, adminBillingStatus);
                                  setAdminBillingServiceId('');
                                  refetch();
                                } catch (err) {
                                  alert(err.message || 'Failed to update billing status');
                                } finally {
                                  setIsUpdatingBillingStatus(false);
                                }
                              }}
                              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
                            >
                              {isUpdatingBillingStatus ? 'Updating…' : 'Update service status'}
                            </button>
                          </div>
                          <div>
                            <button
                              type="button"
                              disabled={isUpdatingBillingStatus}
                              onClick={async () => {
                                setIsUpdatingBillingStatus(true);
                                try {
                                  await waiveWorkOrderDiagnosticFee(workOrder.id);
                                  refetch();
                                } catch (err) {
                                  alert(err.message || 'Failed to waive diagnostic fee');
                                } finally {
                                  setIsUpdatingBillingStatus(false);
                                }
                              }}
                              className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
                            >
                              Waive diagnostic fee
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
                  <div className="text-center py-8 space-y-4">
                    <p className="text-gray-500 dark:text-gray-400">
                      No billable services or items have been added to this work order yet.
                    </p>
                    {!woReadOnly && (
                      <button
                        type="button"
                        onClick={() => setShowEstimateSkuModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-cyan-300 border border-cyan-500/35 rounded-lg md:text-cyan-700 md:dark:text-cyan-300 md:bg-cyan-50 md:dark:bg-cyan-900/30"
                      >
                        Add estimate SKU
                      </button>
                    )}
                  </div>
                )}
              </div>
          </WorkOrderTabPanel>
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
                {manualStatusOptions.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
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
            
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="btn-secondary w-full sm:w-auto touch-manipulation"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStatusUpdate}
                className="btn-primary w-full sm:w-auto touch-manipulation"
                disabled={!newStatus || isMutating}
              >
                {isMutating ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </div>
        </Modal>
        
        {/* Delete confirmation — portaled bottom sheet (reliable taps on iOS) */}
        <MobileActionSheet
          open={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setDeleteModalError(null);
          }}
          title="Delete work order?"
          zIndex={20100}
        >
          <p className="text-sm text-gray-300 mb-4 leading-relaxed">
            This permanently removes work order #{workOrder?.order_number}. This cannot be undone.
          </p>
          {deleteModalError && (
            <div className="mb-4">
              <ErrorAlert message={deleteModalError} />
            </div>
          )}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isMutating}
              className="flex w-full min-h-[56px] items-center justify-center rounded-xl bg-red-600 text-lg font-semibold text-white touch-manipulation active:scale-[0.99] disabled:opacity-60"
            >
              {isMutating ? 'Deleting…' : 'Delete work order'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteModalError(null);
              }}
              className="flex w-full min-h-[52px] items-center justify-center rounded-xl border border-white/15 text-base font-medium text-gray-300 touch-manipulation active:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </MobileActionSheet>

        <MobileActionSheet
          open={mobileMoreOpen}
          onClose={() => setMobileMoreOpen(false)}
          title="Work order actions"
          zIndex={20050}
        >
          <div className="space-y-2">
            {!woReadOnly && (
              <MobileActionSheetButton
                href={`/work_orders/${id}/womobile_edit`}
                onClick={() => setMobileMoreOpen(false)}
              >
                <FaEdit className="opacity-70 shrink-0" /> Edit work order
              </MobileActionSheetButton>
            )}
            {!woReadOnly && (
              <MobileActionSheetButton
                onClick={() => {
                  setMobileMoreOpen(false);
                  setShowNoteTypePicker(true);
                }}
              >
                <FaClipboardList className="opacity-70 shrink-0" /> Add note
              </MobileActionSheetButton>
            )}
            <MobileActionSheetButton
              onClick={() => {
                setMobileMoreOpen(false);
                window.print();
              }}
            >
              <FaPrint className="opacity-70 shrink-0" /> Print
            </MobileActionSheetButton>
            {!woReadOnly && (
              <MobileActionSheetButton
                onClick={() => {
                  setMobileMoreOpen(false);
                  setDeleteModalError(null);
                  setShowStatusModal(true);
                }}
              >
                <FaExclamationTriangle className="opacity-70 shrink-0" /> Update status
              </MobileActionSheetButton>
            )}
            {showReopenAction && (
              <MobileActionSheetButton disabled={lifecycleBusy} onClick={handleReopen}>
                <FaLock className="opacity-70 shrink-0" /> Reopen order
              </MobileActionSheetButton>
            )}
            {isManager && (
              <MobileActionSheetButton
                variant="danger"
                onClick={() => {
                  setMobileMoreOpen(false);
                  setDeleteModalError(null);
                  setShowDeleteModal(true);
                }}
              >
                Delete work order
              </MobileActionSheetButton>
            )}
          </div>
        </MobileActionSheet>

        </div>
        {/* End content card container */}
        </>
        )}

        </div>
      </div>

      {/* Mobile bottom dock — hidden while note/photo sheets are open */}
      {!(notesPhotoSheetOpen || notesAddSheetOpen || guidedDiagnosticsOpen) && (
      <div
        className="md:hidden fixed inset-x-0 bottom-0 z-[1188] border-t border-white/10 bg-[#0B1120]/95 backdrop-blur-md px-3 pt-2 touch-manipulation"
        style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
        data-touch-surface
      >
        {activeTab === TABS.NOTES && !woReadOnly ? (
          <div
            className={`grid gap-2 items-center ${
              showCloseAction ? 'grid-cols-[4.75rem_1fr_2.75rem_4.75rem]' : 'grid-cols-[4.75rem_1fr_2.75rem]'
            }`}
          >
            <button
              type="button"
              onClick={handleMobileDockBack}
              className="h-10 w-full rounded-xl border border-white/15 text-[11px] font-semibold uppercase tracking-wide text-gray-300 flex items-center justify-center gap-1 active:scale-[0.98]"
              aria-label="Back"
            >
              <FaArrowLeft className="h-3.5 w-3.5 shrink-0" />
              Back
            </button>
            <button
              type="button"
              onClick={() => setShowNoteTypePicker(true)}
              className="h-10 w-full rounded-xl bg-gradient-to-br from-cyan-600 to-cyan-700 text-white shadow-[0_0_20px_rgba(34,211,238,0.25)] flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wide active:scale-[0.98]"
            >
              <FaStickyNote className="h-4 w-4 shrink-0" aria-hidden />
              Add note
            </button>
            <button
              type="button"
              onClick={() => setNotesPhotoSheetOpen(true)}
              className="h-10 w-full rounded-xl border border-cyan-500/35 text-cyan-300 flex items-center justify-center active:scale-[0.98]"
              aria-label="Add photo"
            >
              <FaCamera className="h-4 w-4" aria-hidden />
            </button>
            {showCloseAction ? (
              <button
                type="button"
                onClick={() => setShowCloseModal(true)}
                className="h-10 w-full rounded-xl border border-emerald-500/40 bg-emerald-600/90 text-[11px] font-semibold uppercase tracking-wide text-white active:scale-[0.98]"
              >
                Close
              </button>
            ) : null}
          </div>
        ) : (
        <div className="grid grid-cols-[4.75rem_1fr_4.75rem] gap-2 items-center">
          <button
            type="button"
            onClick={handleMobileDockBack}
            className="h-10 w-full rounded-xl border border-white/15 text-[11px] font-semibold uppercase tracking-wide text-gray-300 flex items-center justify-center gap-1 active:scale-[0.98]"
            aria-label="Back"
          >
            <FaArrowLeft className="h-3.5 w-3.5 shrink-0" />
            Back
          </button>
          <button
            type="button"
            onClick={() => setMobileAddSheetOpen(true)}
            className="h-10 w-full rounded-xl bg-gradient-to-br from-cyan-600 to-cyan-700 text-white shadow-[0_0_20px_rgba(34,211,238,0.25)] flex items-center justify-center active:scale-[0.98]"
            aria-label="Add"
          >
            <FaPlus className="h-5 w-5" />
          </button>
          {showCloseAction ? (
            <button
              type="button"
              onClick={() => setShowCloseModal(true)}
              className="h-10 w-full rounded-xl border border-emerald-500/40 bg-emerald-600/90 text-[11px] font-semibold uppercase tracking-wide text-white active:scale-[0.98]"
            >
              Close
            </button>
          ) : (
            <div className="h-10 w-full" aria-hidden />
          )}
        </div>
        )}
      </div>
      )}

      <MobileActionSheet
        open={mobileAddSheetOpen}
        onClose={() => setMobileAddSheetOpen(false)}
        title="Add to work order"
        zIndex={20060}
      >
        <div className="grid grid-cols-3 gap-2.5">
          <MobileActionSheetGridTile
            disabled={woReadOnly}
            label="Service"
            icon={<FaWrench aria-hidden />}
            onClick={() => {
              setMobileAddSheetOpen(false);
              runAfterTabMount(TABS.APPOINTMENTS, () => {
                const result = appointmentSchedulerRef.current?.openServiceEditForTargetVisit?.();
                if (result?.ok === false && result.reason === 'no_visit') {
                  setShowEstimateSkuModal(true);
                }
              });
            }}
          />
          <MobileActionSheetGridTile
            disabled={woReadOnly}
            label="Schedule"
            icon={<FaCalendarPlus aria-hidden />}
            onClick={() => {
              setMobileAddSheetOpen(false);
              runAfterTabMount(TABS.APPOINTMENTS, () => {
                appointmentSchedulerRef.current?.scheduleNewVisit?.();
              });
            }}
          />
          <MobileActionSheetGridTile
            disabled={woReadOnly}
            label="SKU"
            icon={<FaClipboardList aria-hidden />}
            onClick={() => {
              setMobileAddSheetOpen(false);
              setShowEstimateSkuModal(true);
            }}
          />
          <MobileActionSheetGridTile
            disabled={woReadOnly}
            label="Part"
            icon={<FaToolbox aria-hidden />}
            onClick={() => {
              setMobileAddSheetOpen(false);
              runAfterTabMount(TABS.MODEL, () => {
                equipmentDetailsRef.current?.openAddPartForm?.();
              });
            }}
          />
          <MobileActionSheetGridTile
            disabled={woReadOnly}
            label="Note"
            icon={<FaStickyNote aria-hidden />}
            onClick={() => {
              setMobileAddSheetOpen(false);
              setShowNoteTypePicker(true);
            }}
          />
          <MobileActionSheetGridTile
            disabled={woReadOnly}
            label="Photo"
            icon={<FaCamera aria-hidden />}
            onClick={() => {
              setMobileAddSheetOpen(false);
              runAfterTabMount(TABS.NOTES, () => {
                setNotesPhotoSheetOpen(true);
              });
            }}
          />
        </div>
      </MobileActionSheet>

      <EstimateSkuModal
        isOpen={showEstimateSkuModal}
        onClose={() => setShowEstimateSkuModal(false)}
        workOrderId={workOrder?.id}
        existingWorkOrderServices={allServices}
        onSuccess={() => refetch()}
        variant="mobile"
      />

      <WorkOrderSquarePaymentSheet
        open={showSquarePayment}
        onClose={() => setShowSquarePayment(false)}
        workOrderId={workOrder?.id}
        dueToday={billingTotals.dueToday}
        taxAmount={billingTotals.taxOnBillableParts}
        halfDiagnosticDiscount={halfDiagnosticDiscount}
        onSuccess={async (result) => {
          await refetch();
          if (result?.needs_repair_outcome) {
            setShowRepairOutcomePrompt(true);
          }
          refreshOutcomeStatus();
        }}
        variant="mobile"
      />

      <RecordPaymentSheet
        open={showRecordPayment}
        onClose={() => setShowRecordPayment(false)}
        workOrderId={workOrder?.id}
        dueToday={billingTotals.dueToday}
        suggestedTax={billingTotals.taxOnBillableParts}
        onSuccess={async (result) => {
          await refetch();
          if (result?.needs_repair_outcome) {
            setShowRepairOutcomePrompt(true);
          }
          refreshOutcomeStatus();
        }}
        variant="mobile"
      />

      <WorkOrderDocumentPdfSheet
        open={showDocumentPdf}
        onClose={() => setShowDocumentPdf(false)}
        workOrderId={workOrder?.id}
        orderNumber={workOrder?.order_number}
        clientEmail={workOrder?.client_user?.email || workOrder?.client?.email || ''}
        hasPayments={fieldPayments.length > 0}
        isPaidInFull={billingTotals.dueToday <= 0 && billingTotals.previouslyPaid > 0}
      />

      <RepairOutcomePromptSheet
        open={showRepairOutcomePrompt}
        onClose={() => setShowRepairOutcomePrompt(false)}
        onAddOutcome={openRepairOutcomeNote}
        variant="mobile"
      />

      <WorkOrderNoteTypePicker
        open={showNoteTypePicker}
        onClose={() => setShowNoteTypePicker(false)}
        onSelect={openNoteWithType}
        variant="mobile"
      />

      <WorkOrderCloseModal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        workOrderId={id}
        isClosed={Boolean(workOrder?.is_closed)}
        onSuccess={refetch}
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