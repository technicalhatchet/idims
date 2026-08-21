import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useUser } from '@auth0/nextjs-auth0/client';
import SolomonHead from '../../components/solomon/SolomonHead';
import DiagnosticResultsForm from '../../components/work_orders/DiagnosticResultsForm';
import { buildInitialDiagnosticState } from '../../constants/diagnosticTemplates';
import { createDmaStandaloneDiagnostic } from '../../services/api/dmaApi';
import {
  buildStandaloneDiagnosticBody,
  diagnosticDraftScopeId,
} from '../../utils/standaloneDiagnostic';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-[#0D1525] px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none';

const labelClass = 'block text-xs uppercase tracking-wide text-gray-400 mb-1';

export default function SolomonDiagnosePage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useUser();
  const outcomeId = typeof router.query.outcome_id === 'string' ? router.query.outcome_id : null;

  const [payload, setPayload] = useState(() => buildInitialDiagnosticState(null));
  const [equipment, setEquipment] = useState({
    equipment_make: '',
    equipment_model: '',
    equipment_serial: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const draftScope = diagnosticDraftScopeId(null);

  const handleSave = async (finalPayload) => {
    setIsSaving(true);
    setError(null);
    try {
      const body = buildStandaloneDiagnosticBody(finalPayload, {
        ...equipment,
        outcome_id: outcomeId,
      });
      const created = await createDmaStandaloneDiagnostic(body);
      router.push(`/solomon/diagnostics/${created.id}`);
    } catch (err) {
      setError(err.message || 'Failed to save diagnostic');
      setIsSaving(false);
    }
  };

  if (authLoading) {
    return (
      <>
        <SolomonHead title="New diagnostic" />
        <main className="min-h-screen bg-[#0A0F1E] text-white p-6">Loading…</main>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <SolomonHead title="Sign in" />
        <main className="min-h-screen bg-[#0A0F1E] text-white px-5 py-8 max-w-lg mx-auto">
          <p className="text-gray-300 mb-4">Sign in to run guided diagnostics.</p>
          <a href="/api/auth/login" className="block rounded-xl bg-[#0089B9] px-4 py-3 text-center font-medium">
            Sign in
          </a>
        </main>
      </>
    );
  }

  return (
    <>
      <SolomonHead title="New diagnostic" />
      <div className="fixed inset-0 z-[200] flex flex-col bg-[#0f172a] text-white">
        <header className="flex items-center gap-3 px-3 py-3 border-b border-white/10 shrink-0">
          <Link href="/solomon" className="text-sm text-cyan-400 hover:text-cyan-300">
            ← Solomon
          </Link>
          <img src="/solomon big.png" alt="" className="h-8 w-auto" />
          <span className="text-sm font-medium truncate">New diagnostic</span>
        </header>

        <div className="px-3 py-3 border-b border-white/10 bg-[#0A0F1E] space-y-3 shrink-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/90">Equipment (optional)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className={labelClass}>Make</label>
              <input
                type="text"
                value={equipment.equipment_make}
                onChange={(e) => setEquipment((p) => ({ ...p, equipment_make: e.target.value }))}
                placeholder="Samsung"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Model</label>
              <input
                type="text"
                value={equipment.equipment_model}
                onChange={(e) => setEquipment((p) => ({ ...p, equipment_model: e.target.value }))}
                placeholder="Model #"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Serial</label>
              <input
                type="text"
                value={equipment.equipment_serial}
                onChange={(e) => setEquipment((p) => ({ ...p, equipment_serial: e.target.value }))}
                placeholder="Optional"
                className={inputClass}
              />
            </div>
          </div>
          {outcomeId ? (
            <p className="text-xs text-amber-300/90">
              Will link to outcome after save.
            </p>
          ) : null}
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4"
          style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
        >
          <DiagnosticResultsForm
            payload={payload}
            onChange={setPayload}
            workOrder={null}
            workOrderId={draftScope}
            variant="mobile"
            readOnly={false}
            isSaving={isSaving}
            onSave={handleSave}
          />
        </div>
      </div>
    </>
  );
}
