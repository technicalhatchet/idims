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
import SolomonAppliancePicker from '../../components/solomon/SolomonAppliancePicker';
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
import useSolomonTheme from '../../hooks/useSolomonTheme';
import { isDiagnosticEquipmentCommitted } from '../../utils/solomonEquipmentInput';

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
  const { interfaceStyle } = useSolomonTheme();
  const outcomeId = typeof router.query.outcome_id === 'string' ? router.query.outcome_id : null;
  const templateParam = typeof router.query.template === 'string' ? router.query.template : null;

  const initialTemplateId = useMemo(() => {
    if (templateParam && getDiagnosticTemplate(templateParam)) return templateParam;
    return null;
  }, [templateParam]);

  const [payload, setPayload] = useState(() => (
    initialTemplateId ? buildInitialDiagnosticStateForTemplate(initialTemplateId) : null
  ));
  const [equipment, setEquipment] = useState(() => ({
    equipment_make: '',
    equipment_model: '',
    equipment_serial: '',
    equipment_version: '',
    equipment_subtype: initialTemplateId ? templateIdToDiySubtype(initialTemplateId) : '',
  }));
  const [committedEquipment, setCommittedEquipment] = useState(null);
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
    if (!payload) return undefined;
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
      if (!nextTemplateId || !payload || nextTemplateId === payload.templateId) return;
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

  const activeTemplateId = payload?.templateId || initialTemplateId;
  const templateLabel = activeTemplateId ? getDiagnosticTemplate(activeTemplateId)?.label : null;
  const diagnosticEquipment = committedEquipment || null;
  const equipmentSetupComplete = Boolean(
    activeTemplateId
    && diagnosticEquipment
    && isDiagnosticEquipmentCommitted(diagnosticEquipment, activeTemplateId),
  );

  const workOrderForDiagnostic = useMemo(
    () => (diagnosticEquipment ? {
      equipment_make: diagnosticEquipment.equipment_make,
      equipment_model: diagnosticEquipment.equipment_model,
      equipment_serial: diagnosticEquipment.equipment_serial,
      equipment_version: diagnosticEquipment.equipment_version,
    } : null),
    [diagnosticEquipment],
  );

  const handleApplianceSelect = useCallback((nextTemplateId) => {
    if (!getDiagnosticTemplate(nextTemplateId)) return;
    const nextPayload = buildInitialDiagnosticStateForTemplate(nextTemplateId);
    setPayload(nextPayload);
    setEquipment((prev) => ({
      ...prev,
      equipment_subtype: templateIdToDiySubtype(nextTemplateId),
    }));
    const params = new URLSearchParams({ template: nextTemplateId });
    if (outcomeId) params.set('outcome_id', outcomeId);
    router.replace(`/solomon/diagnose?${params.toString()}`, undefined, { shallow: true });
  }, [outcomeId, router]);

  const solomonSession = useMemo(() => ({
    id: diagnosticId,
    template_id: payload?.templateId,
    template_label: templateLabel,
    equipment_make: diagnosticEquipment?.equipment_make || equipment.equipment_make,
    equipment_model: diagnosticEquipment?.equipment_model || equipment.equipment_model,
    equipment_serial: diagnosticEquipment?.equipment_serial || equipment.equipment_serial,
    status: 'in_progress',
    payload,
  }), [
    diagnosticId,
    payload,
    templateLabel,
    diagnosticEquipment,
    equipment.equipment_make,
    equipment.equipment_model,
    equipment.equipment_serial,
  ]);

  if (!showWizard) {
    return (
      <>
        <SolomonHead title={copy('diagnosticNew')} />
        <main className="min-h-screen bg-[#0A0F1E] text-white p-6">Loading…</main>
      </>
    );
  }

  return (
    <>
      <SolomonHead title={copy('diagnosticNew')} />
      <SolomonMobileShell
        header={
          <SolomonWizardHeader left={<SolomonWizardBackLink href="/solomon" />} />
        }
      >
        <SolomonAccessGuard promptTitle="Sign in to run guided diagnostics">
        {!activeTemplateId ? (
          <SolomonAppliancePicker onSelect={handleApplianceSelect} />
        ) : (
          <>
            <SolomonEquipmentBar
              equipment={equipment}
              onEquipmentChange={setEquipment}
              onEquipmentCommit={setCommittedEquipment}
              committedEquipment={committedEquipment}
              templateId={activeTemplateId}
              templateOptions={templateOptions}
              onTemplateChange={handleTemplateChange}
              templateLabel={templateLabel}
              isDiyer={isDiyer}
              copy={copy}
              outcomeId={outcomeId}
              progressMessage={equipmentSetupComplete ? progressMessage : null}
              error={error}
              queuedMessage={queuedMessage}
              diagnosticsLinkLabel={isDiyer ? 'View my sessions →' : 'View my diagnostics →'}
              lifecycleDiagnostic={diagnosticId ? { id: diagnosticId, status: 'in_progress' } : null}
              insightPeeks={equipmentSetupComplete ? insightPeeks : null}
            />

            {equipmentSetupComplete && payload && workOrderForDiagnostic ? (
              <DiagnosticResultsForm
                payload={payload}
                onChange={setPayload}
                workOrder={workOrderForDiagnostic}
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
                interfaceStyle={interfaceStyle}
                solomonSession={solomonSession}
                onInsightPeeksChange={setInsightPeeks}
              />
            ) : (
              <p className="text-sm text-gray-400 px-1 py-4">
                Enter make and a full model number, then tap Continue to diagnostic.
              </p>
            )}
          </>
        )}
        </SolomonAccessGuard>
      </SolomonMobileShell>
    </>
  );
}
