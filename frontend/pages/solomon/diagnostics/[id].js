import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { format } from 'date-fns';
import { FaFilePdf } from 'react-icons/fa';
import SolomonHead from '../../../components/solomon/SolomonHead';
import DiagnosticResultsForm from '../../../components/work_orders/DiagnosticResultsForm';
import DiagnosticResultsViewer from '../../../components/work_orders/DiagnosticResultsViewer';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import {
  getDmaRepairRecord,
  getDmaStandaloneDiagnostic,
  linkDmaDiagnosticToOutcome,
  listDmaRepairRecords,
  unlinkDmaDiagnosticFromOutcome,
  updateDmaStandaloneDiagnostic,
} from '../../../services/api/dmaApi';
import {
  buildStandaloneDiagnosticBody,
  diagnosticDraftScopeId,
} from '../../../utils/standaloneDiagnostic';
import { openStandaloneDiagnosticPdf } from '../../../utils/workOrderPdf';

export default function SolomonDiagnosticDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [row, setRow] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [pdfError, setPdfError] = useState(null);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [outcomeOptions, setOutcomeOptions] = useState([]);
  const [linkError, setLinkError] = useState(null);

  const load = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const data = await getDmaStandaloneDiagnostic(id);
      setRow(data);
      setError(null);
      if (data.outcome_id) {
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
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (finalPayload) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const body = buildStandaloneDiagnosticBody(finalPayload, {
        equipment_make: row.equipment_make,
        equipment_model: row.equipment_model,
        equipment_serial: row.equipment_serial,
        customer_complaint: row.customer_complaint,
      });
      const updated = await updateDmaStandaloneDiagnostic(id, {
        payload: body.payload,
        equipment_make: body.equipment_make,
        equipment_model: body.equipment_model,
        equipment_subtype: body.equipment_subtype,
        equipment_serial: body.equipment_serial,
        customer_complaint: body.customer_complaint,
      });
      setRow(updated);
      setIsEditing(false);
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

  const handlePdf = async () => {
    setPdfError(null);
    try {
      await openStandaloneDiagnosticPdf(id);
    } catch (err) {
      setPdfError(err.message || 'PDF failed');
    }
  };

  if (isLoading) {
    return (
      <>
        <SolomonHead title="Diagnostic" />
        <main className="min-h-screen bg-[#0A0F1E] text-white flex justify-center py-20">
          <LoadingSpinner />
        </main>
      </>
    );
  }

  if (error || !row) {
    return (
      <>
        <SolomonHead title="Diagnostic" />
        <main className="min-h-screen bg-[#0A0F1E] text-white px-5 py-8 max-w-lg mx-auto">
          <ErrorAlert message={error || 'Not found'} />
          <Link href="/solomon/diagnostics" className="text-cyan-400 text-sm mt-4 block">← Diagnostics</Link>
        </main>
      </>
    );
  }

  const label = row.template_label || row.template_id || 'Diagnostic';
  const when = row.updated_at ? format(new Date(row.updated_at), 'MMM d, yyyy h:mm a') : '';

  if (isEditing) {
    const draftScope = diagnosticDraftScopeId(id);
    return (
      <>
        <SolomonHead title="Edit diagnostic" />
        <div className="fixed inset-0 z-[200] flex flex-col bg-[#0f172a] text-white">
          <header className="flex items-center justify-between px-3 py-3 border-b border-white/10">
            <button type="button" onClick={() => setIsEditing(false)} className="text-sm text-cyan-400">
              Cancel
            </button>
            {saveError ? <span className="text-xs text-red-400">{saveError}</span> : null}
          </header>
          <div className="flex-1 min-h-0">
            <DiagnosticResultsForm
              payload={row.payload}
              onChange={() => {}}
              workOrderId={draftScope}
              draftNoteId={id}
              variant="mobile"
              isSaving={isSaving}
              onSave={handleSave}
            />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SolomonHead title={label} />
      <main className="min-h-screen bg-[#0A0F1E] text-white px-5 py-6 max-w-lg mx-auto pb-24">
        <Link href="/solomon/diagnostics" className="text-xs text-cyan-400 hover:text-cyan-300">← Diagnostics</Link>
        <h1 className="text-2xl font-semibold mt-3">{label}</h1>
        {when ? <p className="text-sm text-gray-500 mt-1">{when}</p> : null}

        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            onClick={handlePdf}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm"
          >
            <FaFilePdf /> PDF
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm"
          >
            Edit
          </button>
        </div>
        {pdfError ? <p className="text-sm text-red-400 mt-2">{pdfError}</p> : null}

        <section className="mt-6 rounded-xl border border-white/10 bg-[#0D1525] p-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/90 mb-3">Repair outcome</p>
          {outcome ? (
            <div>
              <Link href={`/solomon/outcomes/${outcome.id}`} className="text-white font-medium hover:text-cyan-300">
                {outcome.confirmed_fix?.slice(0, 80) || 'View outcome'}
              </Link>
              <button type="button" onClick={handleUnlink} className="text-xs text-gray-400 mt-2 block hover:text-white">
                Unlink
              </button>
            </div>
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

        <div className="mt-6">
          <DiagnosticResultsViewer payload={row.payload} variant="mobile" />
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
      </main>
    </>
  );
}
