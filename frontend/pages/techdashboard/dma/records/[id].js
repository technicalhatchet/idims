import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { format } from 'date-fns';
import TechDashboardLayout from '../../../../components/layouts/TechDashboardLayout';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../../components/ui/ErrorAlert';
import DmaFieldRecordForm from '../../../../components/dma/DmaFieldRecordForm';
import {
  formatDmaEquipment,
  formValuesToPayload,
  recordToFormValues,
} from '../../../../constants/dmaEquipmentOptions';
import { codeLabel, DMA_PROBLEM_CODES, DMA_RESOLUTION_CODES } from '../../../../constants/dmaCodes';
import { DmaTagPills } from '../../../../components/dma/DmaTagPicker';
import {
  deleteDmaRepairRecord,
  getDmaRepairRecord,
  updateDmaRepairRecord,
} from '../../../../services/api/dmaApi';
import DmaModerationPanel, { DmaModerationBadge } from '../../../../components/dma/DmaModerationPanel';
import { useUserRole } from '../../../../context/UserRoleContext';

function DetailRow({ label, children }) {
  if (children == null || children === '') return null;
  return (
    <div className="py-2 border-b border-white/5 last:border-0">
      <dt className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">{label}</dt>
      <dd className="text-sm text-gray-200 whitespace-pre-wrap">{children}</dd>
    </div>
  );
}

function DmaRecordDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { isManager } = useUserRole();
  const [record, setRecord] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const data = await getDmaRepairRecord(id);
      setRecord(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load record');
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
    if (!window.confirm('Delete this field record permanently?')) return;
    setIsDeleting(true);
    try {
      await deleteDmaRepairRecord(id);
      router.push('/techdashboard/dma');
    } catch (err) {
      alert(err.message || 'Failed to delete');
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Field Record | Repair Memory</title>
      </Head>

      <div className="px-4 py-6 max-w-2xl mx-auto pb-24">
        <div className="mb-6">
          <Link href="/techdashboard/dma" className="text-xs text-cyan-400 hover:text-cyan-300">
            ← Repair Memory
          </Link>
          <div className="flex items-start justify-between gap-3 mt-3">
            <div>
              <span className="inline-block text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 mb-2">
                Field record
              </span>
              <h1 className="text-xl font-bold text-white">{record ? formatDmaEquipment(record) : 'Repair record'}</h1>
            </div>
            {record && !isEditing && (
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-white/15 text-gray-300 hover:border-cyan-500/40"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                >
                  {isDeleting ? '…' : 'Delete'}
                </button>
              </div>
            )}
          </div>
        </div>

        {isLoading && (
          <div className="py-16 flex justify-center">
            <LoadingSpinner />
          </div>
        )}

        {error && !isLoading && <ErrorAlert message={error} onRetry={load} />}

        {record && isEditing && (
          <div>
            <button
              type="button"
              onClick={() => { setIsEditing(false); setSaveError(null); }}
              className="text-xs text-gray-400 mb-4 hover:text-white"
            >
              Cancel edit
            </button>
            <DmaFieldRecordForm
              initialValues={formInitial}
              onSubmit={handleUpdate}
              isSaving={isSaving}
              error={saveError}
              submitLabel="Update record"
            />
          </div>
        )}

        {record && !isEditing && (
          <>
            {isManager && (record.context === 'diy' || record.moderation_status !== 'approved') ? (
              <DmaModerationPanel
                record={record}
                onModerated={(updated) => setRecord(updated)}
              />
            ) : null}

            <div className="rounded-xl border border-white/10 bg-[#0D1525] p-4">
            <dl>
              {record.context === 'diy' || record.moderation_status !== 'approved' ? (
                <div className="py-2 border-b border-white/5 flex flex-wrap items-center gap-2">
                  <dt className="text-[10px] uppercase tracking-wide text-gray-500">Status</dt>
                  <dd className="flex flex-wrap gap-2">
                    {record.context === 'diy' ? (
                      <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border border-cyan-500/25 bg-cyan-500/10 text-cyan-300">
                        DIY
                      </span>
                    ) : null}
                    <DmaModerationBadge status={record.moderation_status} />
                  </dd>
                </div>
              ) : null}
              {record.linked_diagnostic_count > 0 ? (
                <DetailRow label="Troubleshooting sessions">
                  {record.linked_diagnostic_count}
                </DetailRow>
              ) : null}
              <DetailRow label="Confirmed fix">
                <span className="text-cyan-300 font-medium">{record.confirmed_fix}</span>
              </DetailRow>
              {record.tags?.length > 0 && (
                <div className="py-2 border-b border-white/5">
                  <dt className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Tags</dt>
                  <dd><DmaTagPills tags={record.tags} /></dd>
                </div>
              )}
              <DetailRow label="Error code">{record.error_code_text}</DetailRow>
              <DetailRow label="Symptom">{record.customer_complaint}</DetailRow>
              <DetailRow label="Problem">
                {codeLabel(DMA_PROBLEM_CODES, record.problem_code)}
              </DetailRow>
              <DetailRow label="Resolution">
                {codeLabel(DMA_RESOLUTION_CODES, record.resolution_code)}
              </DetailRow>
              <DetailRow label="Parts replaced">{record.replaced_parts}</DetailRow>
              <DetailRow label="Notes">{record.technician_summary}</DetailRow>
              <DetailRow label="Model">{record.equipment_model}</DetailRow>
              <DetailRow label="Appliance type">
                {record.equipment_subtype?.replace(/_/g, ' ')}
              </DetailRow>
              <DetailRow label="Date performed">
                {record.performed_on ? format(new Date(`${record.performed_on}T12:00:00`), 'MMM d, yyyy') : null}
              </DetailRow>
              <DetailRow label="Outcome">
                {record.repair_successful ? 'Successful' : 'Unsuccessful'}
                {record.callback_required ? ' · Callback required' : ''}
              </DetailRow>
              <DetailRow label="Recorded">
                {record.updated_at ? format(new Date(record.updated_at), 'MMM d, yyyy') : null}
              </DetailRow>
            </dl>
          </div>
          </>
        )}
      </div>
    </>
  );
}

DmaRecordDetailPage.getLayout = function getLayout(page) {
  return <TechDashboardLayout>{page}</TechDashboardLayout>;
};

export default DmaRecordDetailPage;
