import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useSolomonAuth } from '../../hooks/useSolomonAuth';
import { useSolomonDiagnosticProgress } from '../../hooks/useSolomonDiagnosticProgress';
import { useClientMounted } from '../../hooks/useClientMounted';
import SolomonHead from '../../components/solomon/SolomonHead';
import SolomonMobileShell from '../../components/solomon/SolomonMobileShell';
import SolomonWizardHeader, { SolomonWizardBackLink } from '../../components/solomon/SolomonWizardHeader';
import SolomonAccessGuard from '../../components/solomon/SolomonAccessGuard';
import SolomonEquipmentBar from '../../components/solomon/SolomonEquipmentBar';
import DiagnosticResultsForm, { clearDiagnosticDraft, getDiagnosticDraftKey } from '../../components/work_orders/DiagnosticResultsForm';
import {
  buildInitialDiagnosticStateForTemplate,
  getDiagnosticTemplate,
  listDiagnosticTemplates,
} from '../../constants/diagnosticTemplates';
import { SOLOMON_DIY_APPLIANCES, templateIdToDiySubtype } from '../../constants/solomonDiyAppliances';
import { solomonCopy } from '../../utils/solomonDiyCopy';
import {
  diagnosticDraftScopeId,
} from '../../utils/standaloneDiagnostic';
import { hasSolomonDiagnosticProgress } from '../../utils/solomonDiagnosticProgress';
import { confirmSolomonTemplateChange } from '../../utils/solomonTemplateChange';

function syncHintText(syncHint, isDiyer) {
  if (syncHint === 'saved') {
    return isDiyer ? 'Session saved — you can leave and continue later.' : 'Diagnostic saved — you can leave and continue later.';
  }
  if (syncHint === 'queued') {
    return 'Saved on your device — will sync when you’re back online.';
  }
  if (syncHint === 'error') {
    return 'Could not sync right now — still saved locally.';
  }
  return null;
}

export default function SolomonDiagnosePage() {
  const router = useRouter();
  const mounted = useClientMounted();
  const {
    canUseSolomon,
    isLoading: authLoading,
    isDiyer,
    rolesLoading,
    rolesResolved,
  } = useSolomonAuth();
  const outcomeId = typeof router.query.outcome_id === 'string' ? router.query.outcome_id : null;
  const templateParam = typeof router.query.template === 'string' ? router.query.template : null;

  const initialTemplateId = useMemo(() => {
    if (templateParam && getDiagnosticTemplate(templateParam)) return templateParam;
    return 'refrigerator';
  }, [templateParam]);

  const [payload, setPayload] = useState(() => buildInitialDiagnosticStateForTemplate(initialTemplateId));
  const [equipment, setEquipment] = useState(() => ({
    equipment_make: '',
    equipment_model: '',
    equipment_serial: '',
    equipment_subtype: templateIdToDiySubtype(initialTemplateId),
  }));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [queuedMessage, setQueuedMessage] = useState(null);
  const [insightPeeks, setInsightPeeks] = useState(null);

  const draftScope = diagnosticDraftScopeId(null);
  const copy = (key) => solomonCopy(isDiyer, key);

  const templateOptions = useMemo(() => {
    if (isDiyer) {
      return SOLOMON_DIY_APPLIANCES.map((item) => ({
        value: item.templateId,
        label: item.label,
      }));
    }
    return listDiagnosticTemplates().map((item) => ({ value: item.id, label: item.label }));
  }, [isDiyer]);

  const {
    diagnosticId,
    persistProgress,
    persistFinal,
    syncHint,
  } = useSolomonDiagnosticProgress({ equipment, outcomeId });

  useEffect(() => {
    if (!diagnosticId) return;
    clearDiagnosticDraft(getDiagnosticDraftKey(draftScope, null));
  }, [diagnosticId, draftScope]);

  useEffect(() => {
    if (!diagnosticId && !hasSolomonDiagnosticProgress(payload)) return undefined;
    const timer = setTimeout(() => {
      persistProgress(payload, { immediate: true });
    }, 1200);
    return () => clearTimeout(timer);
  }, [
    equipment.equipment_make,
    equipment.equipment_model,
    equipment.equipment_serial,
    equipment.equipment_subtype,
    diagnosticId,
    payload,
    persistProgress,
  ]);

  const handleProgressSave = useCallback(
    (nextPayload) => persistProgress(nextPayload),
    [persistProgress],
  );

  const handleTemplateChange = useCallback(
    (nextTemplateId) => {
      if (!nextTemplateId || nextTemplateId === payload.templateId) return;
      if (!getDiagnosticTemplate(nextTemplateId)) return;
      if (!confirmSolomonTemplateChange(payload, isDiyer)) return;

      const nextPayload = buildInitialDiagnosticStateForTemplate(nextTemplateId);
      setPayload(nextPayload);
      setEquipment((prev) => ({
        ...prev,
        equipment_subtype: templateIdToDiySubtype(nextTemplateId),
      }));
      persistProgress(nextPayload, { immediate: true });
    },
    [payload, isDiyer, persistProgress],
  );

  const handleSave = async (finalPayload) => {
    setIsSaving(true);
    setError(null);
    setQueuedMessage(null);
    try {
      const result = await persistFinal(finalPayload);
      if (!result?.id) {
        throw new Error('Could not save on your device. Try again.');
      }
      if (result.queued) {
        setQueuedMessage('Saved on your device — will sync when you’re back online.');
        setIsSaving(false);
        return;
      }
      router.push(`/solomon/diagnostics/${result.id}`);
    } catch (err) {
      setError(err.message || 'Failed to save');
      setIsSaving(false);
    }
  };

  const progressMessage = syncHintText(syncHint, isDiyer);

  const routerReady = router.isReady;
  const authSettled = !authLoading && !rolesLoading && rolesResolved;
  const showWizard = mounted && routerReady && authSettled;

  if (!showWizard) {
    return (
      <>
        <SolomonHead title={copy('diagnosticNew')} />
        <main className="min-h-screen bg-[#0A0F1E] text-white p-6">Loading…</main>
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
        <SolomonAccessGuard promptTitle="Sign in to run guided diagnostics">
        <SolomonEquipmentBar
          equipment={equipment}
          onEquipmentChange={setEquipment}
          templateId={payload.templateId}
          templateOptions={templateOptions}
          onTemplateChange={handleTemplateChange}
          templateLabel={templateLabel}
          isDiyer={isDiyer}
          copy={copy}
          outcomeId={outcomeId}
          progressMessage={progressMessage}
          insightPeeks={insightPeeks}
          error={error}
          queuedMessage={queuedMessage}
          diagnosticsLinkLabel={isDiyer ? 'View my sessions →' : 'View my diagnostics →'}
          lifecycleDiagnostic={diagnosticId ? { id: diagnosticId, status: 'in_progress' } : null}
        />

        <DiagnosticResultsForm
          payload={payload}
          onChange={setPayload}
          workOrder={null}
          workOrderId={draftScope}
          draftNoteId={diagnosticId}
          variant="mobile"
          audience={isDiyer ? 'diy' : 'tech'}
          readOnly={false}
          isSaving={isSaving}
          onSave={handleSave}
          onProgressSave={handleProgressSave}
          hideTemplateSelector
          insightPeekPlacement="external"
          solomonMobileLayout
          onInsightPeeksChange={setInsightPeeks}
        />
        </SolomonAccessGuard>
      </SolomonMobileShell>
    </>
  );
}
