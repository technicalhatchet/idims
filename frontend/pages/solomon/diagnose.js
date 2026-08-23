import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSolomonAuth, markSolomonSession } from '../../hooks/useSolomonAuth';
import SolomonHead from '../../components/solomon/SolomonHead';
import SolomonMobileShell from '../../components/solomon/SolomonMobileShell';
import SolomonWizardHeader, { SolomonWizardBackLink } from '../../components/solomon/SolomonWizardHeader';
import SolomonAuthPrompt from '../../components/solomon/SolomonAuthPrompt';
import DiagnosticResultsForm from '../../components/work_orders/DiagnosticResultsForm';
import {
  buildInitialDiagnosticState,
  buildInitialDiagnosticStateForTemplate,
  getDiagnosticTemplate,
} from '../../constants/diagnosticTemplates';
import { templateIdToDiySubtype } from '../../constants/solomonDiyAppliances';
import { createStandaloneDiagnosticOffline } from '../../lib/solomonOfflineWrites';
import { solomonCopy } from '../../utils/solomonDiyCopy';
import {
  buildStandaloneDiagnosticBody,
  diagnosticDraftScopeId,
} from '../../utils/standaloneDiagnostic';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-[#0D1525] px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none';

const labelClass = 'block text-xs uppercase tracking-wide text-gray-400 mb-1';

export default function SolomonDiagnosePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, isDiyer } = useSolomonAuth();
  const outcomeId = typeof router.query.outcome_id === 'string' ? router.query.outcome_id : null;
  const templateParam = typeof router.query.template === 'string' ? router.query.template : null;

  const initialPayload = useMemo(() => {
    if (templateParam && getDiagnosticTemplate(templateParam)) {
      return buildInitialDiagnosticStateForTemplate(templateParam);
    }
    return buildInitialDiagnosticState(null);
  }, [templateParam]);

  const [payload, setPayload] = useState(initialPayload);
  const [equipment, setEquipment] = useState(() => ({
    equipment_make: '',
    equipment_model: '',
    equipment_serial: '',
    equipment_subtype: templateIdToDiySubtype(templateParam || initialPayload.templateId),
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [queuedMessage, setQueuedMessage] = useState(null);

  const draftScope = diagnosticDraftScopeId(null);
  const copy = (key) => solomonCopy(isDiyer, key);
  const needsAppliancePick = isDiyer && !templateParam;

  useEffect(() => {
    if (!router.isReady || authLoading || !isAuthenticated) return;
    if (needsAppliancePick) {
      router.replace('/solomon/start');
    }
  }, [router, authLoading, isAuthenticated, needsAppliancePick]);

  useEffect(() => {
    if (!templateParam || !getDiagnosticTemplate(templateParam)) return;
    setPayload(buildInitialDiagnosticStateForTemplate(templateParam));
    setEquipment((prev) => ({
      ...prev,
      equipment_subtype: templateIdToDiySubtype(templateParam),
    }));
  }, [templateParam]);

  const handleSave = async (finalPayload) => {
    setIsSaving(true);
    setError(null);
    setQueuedMessage(null);
    try {
      const body = buildStandaloneDiagnosticBody(finalPayload, {
        ...equipment,
        outcome_id: outcomeId,
      });
      const created = await createStandaloneDiagnosticOffline({ body });
      if (!created?.id) {
        throw new Error('Could not save on your device. Try again.');
      }
      if (created.queued) {
        markSolomonSession();
        setQueuedMessage('Saved on your device — will sync when you’re back online.');
        setIsSaving(false);
        return;
      }
      router.push(`/solomon/diagnostics/${created.id}`);
    } catch (err) {
      setError(err.message || 'Failed to save');
      setIsSaving(false);
    }
  };

  if (authLoading || needsAppliancePick) {
    return (
      <>
        <SolomonHead title={copy('diagnosticNew')} />
        <main className="min-h-screen bg-[#0A0F1E] text-white p-6">Loading…</main>
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <SolomonHead title="Sign in" />
        <main className="min-h-screen bg-[#0A0F1E] text-white px-5 py-8 max-w-lg mx-auto">
          <SolomonAuthPrompt
            title="Sign in to run guided diagnostics"
            description="Homeowners can create a free account. Technicians sign in with staff access."
          />
        </main>
      </>
    );
  }

  const templateLabel = getDiagnosticTemplate(payload?.templateId)?.label;

  return (
    <>
      <SolomonHead title={copy('diagnosticNew')} />
      <SolomonMobileShell
        header={
          <SolomonWizardHeader left={<SolomonWizardBackLink href="/solomon" />} />
        }
      >
        <div className="px-0 pb-3 border-b border-white/10 bg-[#0A0F1E] -mx-3 px-3 space-y-3 mb-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/90">
            {copy('equipmentOptional')}
          </p>
          {templateLabel ? (
            <p className="text-sm text-white/80">
              {isDiyer ? 'Troubleshooting: ' : 'Template: '}
              <span className="font-medium text-white">{templateLabel}</span>
              {isDiyer ? (
                <Link href="/solomon/start" className="text-cyan-400 text-xs ml-2 hover:text-cyan-300">
                  {copy('changeAppliance')}
                </Link>
              ) : null}
            </p>
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className={labelClass}>{copy('make')}</label>
              <input
                type="text"
                value={equipment.equipment_make}
                onChange={(e) => setEquipment((p) => ({ ...p, equipment_make: e.target.value }))}
                placeholder="Samsung"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{copy('model')}</label>
              <input
                type="text"
                value={equipment.equipment_model}
                onChange={(e) => setEquipment((p) => ({ ...p, equipment_model: e.target.value }))}
                placeholder="Model #"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{copy('serial')}</label>
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
              {isDiyer ? 'Will link to your repair note after save.' : 'Will link to outcome after save.'}
            </p>
          ) : null}
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {queuedMessage ? (
            <div className="space-y-2">
              <p className="text-sm text-amber-300/90">{queuedMessage}</p>
              <Link
                href="/solomon/diagnostics"
                className="inline-block text-sm text-cyan-400 hover:text-cyan-300"
              >
                {isDiyer ? 'View my sessions →' : 'View my diagnostics →'}
              </Link>
            </div>
          ) : null}
        </div>

        <DiagnosticResultsForm
          payload={payload}
          onChange={setPayload}
          workOrder={null}
          workOrderId={draftScope}
          variant="mobile"
          audience={isDiyer ? 'diy' : 'tech'}
          readOnly={false}
          isSaving={isSaving}
          onSave={handleSave}
        />
      </SolomonMobileShell>
    </>
  );
}
