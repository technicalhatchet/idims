import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { formatSolomonDateTime } from '../../../utils/solomonFormat';
import SolomonErrorBoundary from '../../../components/solomon/SolomonErrorBoundary';
import { FaFilePdf } from 'react-icons/fa';
import SolomonHead from '../../../components/solomon/SolomonHead';
import SolomonMobileShell from '../../../components/solomon/SolomonMobileShell';
import SolomonPageMain from '../../../components/solomon/SolomonPageMain';
import DiagnosticResultsForm from '../../../components/work_orders/DiagnosticResultsForm';
import DiagnosticResultsViewer from '../../../components/work_orders/DiagnosticResultsViewer';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import {
  getDmaRepairRecord,
  linkDmaDiagnosticToOutcome,
  listDmaRepairRecords,
  unlinkDmaDiagnosticFromOutcome,
} from '../../../services/api/dmaApi';
import {
  fetchStandaloneDiagnostic,
  deleteStandaloneDiagnosticOffline,
} from '../../../lib/solomonOfflineWrites';
import SolomonWizardHeader from '../../../components/solomon/SolomonWizardHeader';
import { SYNC_EVENT, SOLOMON_DIAGNOSTIC_SYNCED_EVENT } from '../../../lib/offlineMutations';
import {
  diagnosticDraftScopeId,
  isPendingDiagnosticId,
} from '../../../utils/standaloneDiagnostic';
import { openStandaloneDiagnosticPdf } from '../../../utils/workOrderPdf';
import { useSolomonAuth } from '../../../hooks/useSolomonAuth';
import { useSolomonDiagnosticProgress } from '../../../hooks/useSolomonDiagnosticProgress';
import { importDmaDiagnosticToWorkOrder } from '../../../services/api/dmaApi';
import SolomonWorkOrderImportSheet, { SolomonImportedWorkOrderLink } from '../../../components/solomon/SolomonWorkOrderImportSheet';
import SolomonDiagnosticReasoningView from '../../../components/solomon/SolomonDiagnosticReasoningView';
import SolomonEquipmentBar from '../../../components/solomon/SolomonEquipmentBar';
import {
  buildInitialDiagnosticStateForTemplate,
  getDiagnosticTemplate,
  listDiagnosticTemplates,
} from '../../../constants/diagnosticTemplates';
import { SOLOMON_DIY_APPLIANCES, templateIdToDiySubtype } from '../../../constants/solomonDiyAppliances';
import { solomonCopy } from '../../../utils/solomonDiyCopy';
import { confirmSolomonTemplateChange } from '../../../utils/solomonTemplateChange';
import {
  resolveSolomonDiagnosticStatus,
  solomonDiagnosticDetailPanelClass,
  SolomonDiagnosticStatusBadge,
} from '../../../components/solomon/solomonDiagnosticStatus';

export default function SolomonDiagnosticDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [row, setRow] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editPayload, setEditPayload] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [pdfError, setPdfError] = useState(null);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [outcomeOptions, setOutcomeOptions] = useState([]);
  const [linkError, setLinkError] = useState(null);
  const [queuedMessage, setQueuedMessage] = useState(null);
  const [insightPeeks, setInsightPeeks] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { isStaff, isDiyer } = useSolomonAuth();
  const [editEquipment, setEditEquipment] = useState({
    equipment_make: '',
    equipment_model: '',
    equipment_serial: '',
    equipment_subtype: '',
  });
  const continueOpenedRef = useRef(false);

  useEffect(() => {
    if (!row) return;
    setEditEquipment({
      equipment_make: row.equipment_make || '',
      equipment_model: row.equipment_model || '',
      equipment_serial: row.equipment_serial || '',
      equipment_subtype: row.equipment_subtype || '',
    });
  }, [row]);

  const templateOptions = useMemo(() => {
    if (isDiyer) {
      return SOLOMON_DIY_APPLIANCES.map((item) => ({
        value: item.templateId,
        label: item.label,
      }));
    }
    return listDiagnosticTemplates().map((item) => ({ value: item.id, label: item.label }));
  }, [isDiyer]);

  const copy = (key) => solomonCopy(isDiyer, key);

  const {
    persistProgress,
    persistFinal,
  } = useSolomonDiagnosticProgress({
    equipment: editEquipment,
    initialDiagnosticId: typeof id === 'string' ? id : null,
    status: row?.status || 'in_progress',
  });

  const handleProgressSave = useCallback(
    (nextPayload) => persistProgress(nextPayload),
    [persistProgress],
  );

  const handleEditTemplateChange = useCallback(
    (nextTemplateId) => {
      if (!editPayload || !nextTemplateId || nextTemplateId === editPayload.templateId) return;
      if (!getDiagnosticTemplate(nextTemplateId)) return;
      if (!confirmSolomonTemplateChange(editPayload, isDiyer)) return;

      const nextPayload = buildInitialDiagnosticStateForTemplate(nextTemplateId);
      setEditPayload(nextPayload);
      setEditEquipment((prev) => ({
        ...prev,
        equipment_subtype: templateIdToDiySubtype(nextTemplateId),
      }));
      persistProgress(nextPayload, { immediate: true });
    },
    [editPayload, isDiyer, persistProgress],
  );

  useEffect(() => {
    if (!isEditing || !editPayload) return undefined;
    const timer = setTimeout(() => {
      persistProgress(editPayload, { immediate: true });
    }, 1200);
    return () => clearTimeout(timer);
  }, [
    editEquipment.equipment_make,
    editEquipment.equipment_model,
    editEquipment.equipment_serial,
    editEquipment.equipment_subtype,
    isEditing,
    editPayload,
    persistProgress,
  ]);
  const [importOpen, setImportOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importedOrderNumber, setImportedOrderNumber] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const onSync = () => setReloadKey((k) => k + 1);
    const onDiagnosticSynced = (e) => {
      if (e.detail?.tempId === id && e.detail?.id) {
        router.replace(`/solomon/diagnostics/${e.detail.id}`);
      }
    };
    window.addEventListener(SYNC_EVENT, onSync);
    window.addEventListener(SOLOMON_DIAGNOSTIC_SYNCED_EVENT, onDiagnosticSynced);
    return () => {
      window.removeEventListener(SYNC_EVENT, onSync);
      window.removeEventListener(SOLOMON_DIAGNOSTIC_SYNCED_EVENT, onDiagnosticSynced);
    };
  }, [id, router]);

  const load = useCallback(async () => {
    if (!id) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await fetchStandaloneDiagnostic(id);
      setRow(data);
      setError(null);
      if (data.outcome_id && !data.pendingSync && !isPendingDiagnosticId(data.id)) {
        const oc = await getDmaRepairRecord(data.outcome_id);
        setOutcome(oc);
      } else {
        setOutcome(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to load diagnostic');
      setRow(null);
    } finally {
      setIsLoading(false);
    }
  }, [id, reloadKey]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (router.query.continue !== '1' || !row?.payload || continueOpenedRef.current) return;
    continueOpenedRef.current = true;
    setEditPayload(row.payload);
    setSaveError(null);
    setIsEditing(true);
  }, [router.query.continue, row]);

  const handleSave = async (finalPayload) => {
    setIsSaving(true);
    setSaveError(null);
    setQueuedMessage(null);
    try {
      const updated = await persistFinal(finalPayload);
      if (!updated?.id) {
        throw new Error('Could not save on your device. Try again.');
      }
      setRow(updated);
      setIsEditing(false);
      setEditPayload(null);
      if (updated.queued) {
        setQueuedMessage('Saved on device — will sync when you’re back online.');
      }
    } catch (err) {
      setSaveError(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnlink = async () => {
    if (!window.confirm('Unlink this diagnostic from the repair outcome?')) return;
    try {
      const updated = await unlinkDmaDiagnosticFromOutcome(id);
      setRow(updated);
      setOutcome(null);
    } catch (err) {
      setError(err.message || 'Failed to unlink');
    }
  };

  const openLinkPicker = async () => {
    setLinkError(null);
    try {
      const res = await listDmaRepairRecords({ limit: 50 });
      setOutcomeOptions(res.items || []);
      setLinkPickerOpen(true);
    } catch (err) {
      setLinkError(err.message || 'Failed to load outcomes');
    }
  };

  const handleLinkOutcome = async (outcomeId) => {
    try {
      const updated = await linkDmaDiagnosticToOutcome(id, outcomeId);
      setRow(updated);
      const oc = await getDmaRepairRecord(outcomeId);
      setOutcome(oc);
      setLinkPickerOpen(false);
    } catch (err) {
      setLinkError(err.message || 'Failed to link');
    }
  };

  const handleStartEdit = () => {
    setEditPayload(row?.payload || null);
    setSaveError(null);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditPayload(null);
    setSaveError(null);
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this diagnostic? This cannot be undone.')) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteStandaloneDiagnosticOffline(id);
      router.push('/solomon/diagnostics');
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete');
      setIsDeleting(false);
    }
  };

  const handlePdf = async () => {
    if (isPendingDiagnosticId(id) || row?.pendingSync) {
      setPdfError('PDF is available after this diagnostic syncs online.');
      return;
    }
    setPdfError(null);
    try {
      await openStandaloneDiagnosticPdf(id);
    } catch (err) {
      setPdfError(err.message || 'PDF failed');
    }
  };

  const handleImportSelect = async (workOrder) => {
    if (!workOrder?.id) return;
    setIsImporting(true);
    setImportError(null);
    try {
      const res = await importDmaDiagnosticToWorkOrder(id, workOrder.id);
      setRow((prev) => ({
        ...prev,
        imported_work_order_id: res.imported_work_order_id || workOrder.id,
      }));
      setImportedOrderNumber(workOrder.order_number);
      setImportOpen(false);
    } catch (err) {
      setImportError(err.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <SolomonHead title="Diagnostic" />
        <SolomonPageMain className="flex justify-center py-20">
          <LoadingSpinner />
        </SolomonPageMain>
      </>
    );
  }

  if (error || !row) {
    return (
      <>
        <SolomonHead title="Diagnostic" />
        <SolomonPageMain>
          <ErrorAlert message={error || 'Not found'} />
          <Link href="/solomon/diagnostics" className="text-cyan-400 text-sm mt-4 block">← Diagnostics</Link>
        </SolomonPageMain>
      </>
    );
  }

  const label = row.template_label || row.template_id || 'Diagnostic';
  const when = formatSolomonDateTime(row.updated_at, 'MMM d, yyyy h:mm a');
  const isPending = row.pendingSync || isPendingDiagnosticId(id);
  const needsOutcome =
    !outcome
    && !isPending
    && row.status !== 'abandoned'
    && row.status === 'completed';

  const lifecycleStatus = resolveSolomonDiagnosticStatus(row);

  if (isEditing && editPayload) {
    const draftScope = diagnosticDraftScopeId(id);
    const templateLabel = getDiagnosticTemplate(editPayload?.templateId)?.label;
    return (
      <>
        <SolomonHead title="Edit diagnostic" />
        <SolomonMobileShell
          header={
            <SolomonWizardHeader
              left={
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-sm text-cyan-400 hover:text-cyan-300 p-1 -ml-1"
                >
                  Cancel
                </button>
              }
              right={
                saveError ? <span className="text-xs text-red-400 truncate">{saveError}</span> : null
              }
            />
          }
        >
          <SolomonEquipmentBar
            equipment={editEquipment}
            onEquipmentChange={setEditEquipment}
            templateId={editPayload.templateId}
            templateOptions={templateOptions}
            onTemplateChange={handleEditTemplateChange}
            templateLabel={templateLabel}
            isDiyer={isDiyer}
            copy={copy}
            insightPeeks={insightPeeks}
            lifecycleDiagnostic={row}
          />

          <DiagnosticResultsForm
            payload={editPayload}
            onChange={setEditPayload}
            workOrderId={draftScope}
            draftNoteId={id}
            variant="mobile"
            readOnly={false}
            isSaving={isSaving}
            onSave={handleSave}
            onProgressSave={handleProgressSave}
            audience={isDiyer ? 'diy' : 'tech'}
            hideTemplateSelector
            insightPeekPlacement="external"
            solomonMobileLayout
            onInsightPeeksChange={setInsightPeeks}
          />
        </SolomonMobileShell>
      </>
    );
  }

  return (
    <SolomonErrorBoundary>
      <SolomonHead title={label} />
      <SolomonPageMain>
        <Link href="/solomon/diagnostics" className="text-xs text-cyan-400 hover:text-cyan-300">← Diagnostics</Link>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">{label}</h1>
            {when ? <p className="text-sm text-gray-500 mt-1">{when}</p> : null}
          </div>
          <SolomonDiagnosticStatusBadge status={lifecycleStatus} />
        </div>
        {isPending ? (
          <p className="text-xs text-sky-300/90 mt-2">Pending sync — saved on your device.</p>
        ) : null}
        {queuedMessage ? <p className="text-xs text-amber-300/90 mt-2">{queuedMessage}</p> : null}
        {row.imported_work_order_id ? (
          <p className="text-xs mt-2">
            <SolomonImportedWorkOrderLink
              workOrderId={row.imported_work_order_id}
              orderNumber={importedOrderNumber}
            />
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 mt-4">
          {isStaff && !isPending ? (
            <button
              type="button"
              onClick={() => { setImportOpen(true); setImportError(null); }}
              disabled={Boolean(row.imported_work_order_id) || isImporting}
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 disabled:opacity-40"
            >
              {row.imported_work_order_id ? 'Imported' : 'Import to WO'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={handlePdf}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm disabled:opacity-40"
          >
            <FaFilePdf /> PDF
          </button>
          <button
            type="button"
            onClick={handleStartEdit}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-300 disabled:opacity-40"
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
        {deleteError ? <p className="text-sm text-red-400 mt-2">{deleteError}</p> : null}
        {pdfError ? <p className="text-sm text-red-400 mt-2">{pdfError}</p> : null}

        {needsOutcome ? (
          <section className={`mt-4 p-4 ${solomonDiagnosticDetailPanelClass(lifecycleStatus)}`}>
            <p className={`text-[10px] uppercase tracking-[0.2em] ${lifecycleStatus.labelTextClass}`}>
              {isDiyer ? 'What happened next?' : 'Record outcome'}
            </p>
            <p className="text-sm text-white/80 mt-2">
              {isDiyer
                ? 'Your diagnostic notes are saved. Add what you tried and whether it fixed the problem.'
                : 'Diagnostic session saved. Link or create a repair outcome to close the loop.'}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Link
                href={`/solomon/outcomes/new?diagnostic_id=${id}`}
                className="rounded-lg bg-[#EF8209] px-3 py-2 text-sm font-medium"
              >
                {isDiyer ? 'Add repair note' : 'Create outcome'}
              </Link>
              <button
                type="button"
                onClick={openLinkPicker}
                className="rounded-lg border border-white/15 px-3 py-2 text-sm"
              >
                Link existing
              </button>
            </div>
          </section>
        ) : null}

        <section className={`mt-6 p-4 ${solomonDiagnosticDetailPanelClass(lifecycleStatus)}`}>
          <p className={`text-[10px] uppercase tracking-[0.2em] mb-3 ${lifecycleStatus.labelTextClass}`}>Repair outcome</p>
          {outcome ? (
            <div>
              <Link href={`/solomon/outcomes/${outcome.id}`} className="text-white font-medium hover:text-cyan-300">
                {outcome.confirmed_fix?.slice(0, 80) || 'View outcome'}
              </Link>
              <button type="button" onClick={handleUnlink} className="text-xs text-gray-400 mt-2 block hover:text-white">
                Unlink
              </button>
            </div>
          ) : isPending ? (
            <p className="text-sm text-gray-400">
              Link or create outcomes after this diagnostic syncs online.
            </p>
          ) : (
            <div className="space-y-2">
              <Link
                href={`/solomon/outcomes/new?diagnostic_id=${id}`}
                className="block rounded-lg bg-[#EF8209] px-3 py-2 text-sm text-center font-medium"
              >
                Create repair outcome
              </Link>
              <button type="button" onClick={openLinkPicker} className="w-full rounded-lg border border-white/15 px-3 py-2 text-sm">
                Link to existing outcome
              </button>
              {linkError ? <p className="text-xs text-red-400">{linkError}</p> : null}
            </div>
          )}
        </section>

        {row.payload ? (
          <div className="mt-6">
            <SolomonDiagnosticReasoningView payload={row.payload} variant="mobile" mobileSheetLayout />
          </div>
        ) : null}

        <div className="mt-6">
          {row.payload ? (
            <DiagnosticResultsViewer payload={row.payload} variant="mobile" />
          ) : (
            <p className="text-sm text-gray-500">Diagnostic data is stored on your device and will appear after sync.</p>
          )}
        </div>

        {linkPickerOpen ? (
          <div className="fixed inset-0 z-[300] bg-black/70 flex items-end sm:items-center justify-center p-4">
            <div className="bg-[#0D1525] border border-white/10 rounded-xl max-w-md w-full max-h-[70vh] overflow-hidden flex flex-col">
              <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <p className="font-medium">Link to outcome</p>
                <button type="button" onClick={() => setLinkPickerOpen(false)} className="text-gray-400">✕</button>
              </div>
              <div className="overflow-y-auto p-2 space-y-1">
                {outcomeOptions.length === 0 ? (
                  <p className="text-sm text-gray-500 p-4 text-center">No outcomes yet.</p>
                ) : (
                  outcomeOptions.map((oc) => (
                    <button
                      key={oc.id}
                      type="button"
                      onClick={() => handleLinkOutcome(oc.id)}
                      className="w-full text-left rounded-lg px-3 py-2 hover:bg-white/5 text-sm"
                    >
                      <span className="line-clamp-2">{oc.confirmed_fix}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}

        <SolomonWorkOrderImportSheet
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onSelect={handleImportSelect}
          isImporting={isImporting}
          error={importError}
          title="Import diagnostic to work order"
          description="Adds a private Diagnostic Results note with this wizard data."
        />
      </SolomonPageMain>
    </SolomonErrorBoundary>
  );
}
