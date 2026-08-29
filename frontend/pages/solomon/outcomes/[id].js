import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { format } from 'date-fns';
import SolomonHead from '../../../components/solomon/SolomonHead';
import SolomonPageMain from '../../../components/solomon/SolomonPageMain';
import SolomonPageHeader from '../../../components/solomon/SolomonPageHeader';
import DmaFieldRecordForm from '../../../components/dma/DmaFieldRecordForm';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import { DmaTagPills } from '../../../components/dma/DmaTagPicker';
import {
  deleteDmaRepairRecord,
  getDmaRepairRecord,
  importDmaRecordToWorkOrder,
  listDmaStandaloneDiagnostics,
  updateDmaRepairRecord,
} from '../../../services/api/dmaApi';
import {
  formatDmaEquipment,
  formValuesToPayload,
  recordToFormValues,
} from '../../../constants/dmaEquipmentOptions';
import { useSolomonAuth } from '../../../hooks/useSolomonAuth';
import { solomonCopy } from '../../../utils/solomonDiyCopy';
import SolomonWorkOrderImportSheet, { SolomonImportedWorkOrderLink } from '../../../components/solomon/SolomonWorkOrderImportSheet';
import {
  resolveSolomonDiagnosticStatus,
  resolveSolomonOutcomeStatus,
  solomonDiagnosticDetailPanelClass,
  solomonDiagnosticListCardClass,
  SolomonDiagnosticStatusBadge,
} from '../../../components/solomon/solomonDiagnosticStatus';

export default function SolomonOutcomeDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { isDiyer, isStaff } = useSolomonAuth();
  const copy = (key) => solomonCopy(isDiyer, key);
  const [importOpen, setImportOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importedOrderNumber, setImportedOrderNumber] = useState(null);
  const [record, setRecord] = useState(null);
  const [diagnostics, setDiagnostics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const data = await getDmaRepairRecord(id);
      const diagRes = await listDmaStandaloneDiagnostics({ outcome_id: id, limit: 50 });
      setRecord(data);
      setDiagnostics(diagRes.items || []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load outcome');
      setRecord(null);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const formInitial = useMemo(() => recordToFormValues(record), [record]);

  const handleUpdate = async (values) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await updateDmaRepairRecord(id, formValuesToPayload(values));
      setRecord(updated);
      setIsEditing(false);
    } catch (err) {
      setSaveError(err.message || 'Failed to update');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this repair outcome permanently?')) return;
    try {
      await deleteDmaRepairRecord(id);
      router.push('/solomon/outcomes');
    } catch (err) {
      setError(err.message || 'Failed to delete');
    }
  };

  const handleImportSelect = async (workOrder) => {
    if (!workOrder?.id) return;
    setIsImporting(true);
    setImportError(null);
    try {
      const res = await importDmaRecordToWorkOrder(id, workOrder.id);
      setRecord((prev) => ({
        ...prev,
        imported_work_order_id: res.imported_work_order_id || workOrder.id,
      }));
      setImportedOrderNumber(workOrder.order_number);
      setImportOpen(false);
      await load();
    } catch (err) {
      setImportError(err.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <SolomonHead title="Outcome" />
        <SolomonPageMain className="flex justify-center py-20">
          <SolomonPageHeader back="arrow" backHref="/solomon/outcomes" backLabel="Back to outcomes" />
          <LoadingSpinner />
        </SolomonPageMain>
      </>
    );
  }

  if (error || !record) {
    return (
      <>
        <SolomonHead title="Outcome" />
        <SolomonPageMain>
          <SolomonPageHeader back="arrow" backHref="/solomon/outcomes" backLabel="Back to outcomes" />
          <ErrorAlert message={error || 'Not found'} />
        </SolomonPageMain>
      </>
    );
  }

  const outcomeStatus = resolveSolomonOutcomeStatus(record);

  return (
    <>
      <SolomonHead title="Repair outcome" />
      <SolomonPageMain>
        <SolomonPageHeader back="arrow" backHref="/solomon/outcomes" backLabel="Back to outcomes" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">{formatDmaEquipment(record)}</h1>
            {record.updated_at ? (
              <p className="text-sm text-gray-500 mt-1">{format(new Date(record.updated_at), 'MMM d, yyyy')}</p>
            ) : null}
          </div>
          <SolomonDiagnosticStatusBadge status={outcomeStatus} />
        </div>
        {record.moderation_status === 'pending' ? (
          <p className="text-xs text-amber-300/90 mt-2">
            Pending review — only you can see this until it is approved for the repair knowledge pool.
          </p>
        ) : null}
        {record.moderation_status === 'rejected' ? (
          <p className="text-xs text-red-300/90 mt-2">
            This outcome was not approved for the shared pool. You can still edit your private notes.
          </p>
        ) : null}

        {record.imported_work_order_id ? (
          <p className="text-xs mt-2">
            <SolomonImportedWorkOrderLink
              workOrderId={record.imported_work_order_id}
              orderNumber={importedOrderNumber}
            />
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 mt-4">
          {isStaff ? (
            <button
              type="button"
              onClick={() => { setImportOpen(true); setImportError(null); }}
              disabled={Boolean(record.imported_work_order_id) || isImporting}
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 disabled:opacity-40"
            >
              {record.imported_work_order_id ? 'Imported' : 'Import to WO'}
            </button>
          ) : null}
          <button type="button" onClick={() => setIsEditing((v) => !v)} className="rounded-lg border border-white/15 px-3 py-2 text-sm">
            {isEditing ? 'Cancel edit' : 'Edit'}
          </button>
          <button type="button" onClick={handleDelete} className="rounded-lg border border-red-500/30 text-red-300 px-3 py-2 text-sm">
            Delete
          </button>
        </div>

        {isEditing ? (
          <div className="mt-6">
            <DmaFieldRecordForm
              initialValues={formInitial}
              onSubmit={handleUpdate}
              isSaving={isSaving}
              error={saveError}
              submitLabel="Save changes"
              variant={isDiyer ? 'diy' : 'default'}
            />
          </div>
        ) : (
          <div className={`mt-6 p-4 space-y-3 text-sm ${solomonDiagnosticDetailPanelClass(outcomeStatus)}`}>
            <p className="text-white whitespace-pre-wrap">{record.confirmed_fix}</p>
            {record.outcome_confidence ? (
              <p className="text-xs text-cyan-400/80">
                Confidence: {record.outcome_confidence.replace(/_/g, ' ')}
              </p>
            ) : null}
            {record.customer_complaint ? (
              <p className="text-gray-400"><span className="text-gray-500">Complaint:</span> {record.customer_complaint}</p>
            ) : null}
            {record.tags?.length ? <DmaTagPills tags={record.tags} /> : null}
          </div>
        )}

        <section className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-gray-400">
              {isDiyer ? 'Linked troubleshooting' : 'Linked diagnostics'}
            </h2>
            <Link
              href={isDiyer ? `/solomon/start?outcome_id=${id}` : `/solomon/diagnose?outcome_id=${id}`}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              {isDiyer ? '+ Add session' : '+ Add diagnostic'}
            </Link>
          </div>
          {diagnostics.length === 0 ? (
            <p className="text-sm text-gray-500">No diagnostics linked yet.</p>
          ) : (
            <div className="space-y-2">
              {diagnostics.map((d) => {
                const status = resolveSolomonDiagnosticStatus(d);
                return (
                <Link
                  key={d.id}
                  href={`/solomon/diagnostics/${d.id}`}
                  className={`block px-3 py-3 text-sm ${solomonDiagnosticListCardClass(status)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0">{d.template_label || d.template_id || 'Diagnostic'}</span>
                    <SolomonDiagnosticStatusBadge status={status} />
                  </div>
                  {d.updated_at ? (
                    <span className="text-gray-500 text-xs mt-1 block">
                      {format(new Date(d.updated_at), 'MMM d')}
                    </span>
                  ) : null}
                </Link>
                );
              })}
            </div>
          )}
        </section>

        <SolomonWorkOrderImportSheet
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onSelect={handleImportSelect}
          isImporting={isImporting}
          error={importError}
          title="Import outcome to work order"
          description="Adds Repair Outcome + linked Diagnostic Results notes (private)."
        />
      </SolomonPageMain>
    </>
  );
}
