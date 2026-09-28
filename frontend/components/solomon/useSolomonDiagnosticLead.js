'use client';

import { useMemo } from 'react';
import { getWizardDefinition, resolveWizardSteps } from '../diagnostics';
import { DIAGNOSTIC_REVIEW_STEP_ID } from '../diagnostics/shared/createWizardDefinitionFromTemplate';
import { evaluateDiagnosticIntelligence } from '../diagnostics/intelligence/diagnosticIntelligenceEngine';
import { formatDiyLeadCard } from '../diagnostics/intelligence/evidenceDisplay';
import { buildFieldLabelsForTemplate } from '../diagnostics/intelligence/fieldLabels';
import { extractDefaultStepOrder } from '../diagnostics/intelligence/reorderWizardSteps';
import { buildStepKeyLabels } from '../diagnostics/intelligence/stepKeyLabels';
import { buildMeasurementStatusMap } from '../diagnostics/knowledge/measurementContext';
import { getDiagnosticTemplate } from '../../constants/diagnosticTemplates';
import { OEM_WIZARD_STEP_KEY } from '../diagnostics/procedures/procedureWizardLead';

function leadPresentationOptions(target) {
  const payload = target?.payload || {};
  const insertOem = Boolean(
    payload.currentStepKey === OEM_WIZARD_STEP_KEY
    || (payload.visitedStepKeys || []).includes(OEM_WIZARD_STEP_KEY)
    || Object.keys(payload.procedureRuns || {}).length > 0,
  );
  return {
    procedureRuns: payload.procedureRuns || {},
    oemDiagnosticPathExhausted: Boolean(payload.oemDiagnosticTreeExhausted),
    oemManufacturerPathActive: insertOem && !payload.skippedOemWizardStep,
  };
}

/**
 * Synchronous leading-hypothesis readout (metrics, non-hook contexts).
 * @param {object | null | undefined} target Diagnostic row or continue target
 */
export function computeSolomonDiagnosticLead(target) {
  const templateId = target?.payload?.templateId || target?.template_id;
  if (!templateId) return null;

  const fields = target?.payload?.fields || {};
  const visitedStepKeys = target?.payload?.visitedStepKeys || [];
  const wizardDefinition = getWizardDefinition(templateId);
  const template = getDiagnosticTemplate(templateId);
  const wizardSteps = resolveWizardSteps(wizardDefinition, template);
  const stepKeyLabels = buildStepKeyLabels(wizardDefinition);
  const fieldLabels = buildFieldLabelsForTemplate(templateId);
  const defaultStepOrder = extractDefaultStepOrder(wizardSteps);
  const measurementStatuses = buildMeasurementStatusMap(templateId, fields);

  const intelligence = evaluateDiagnosticIntelligence(templateId, fields, measurementStatuses, {
    visitedStepKeys,
    defaultStepOrder,
    complaintChips: wizardDefinition?.complaintChips || [],
    dmaNudges: null,
    fieldLabels,
    stepKeyLabels,
    procedureRuns: target?.payload?.procedureRuns || {},
  });

  return formatDiyLeadCard(intelligence, leadPresentationOptions(target));
}

/**
 * Diagnostic status readout for Solomon list / session cards.
 * @param {object | null | undefined} target Diagnostic row or continue target
 */
export function useSolomonDiagnosticLead(target) {
  const templateId = target?.payload?.templateId || target?.template_id;
  const fields = target?.payload?.fields || {};
  const visitedStepKeys = target?.payload?.visitedStepKeys || [];
  const procedureRuns = target?.payload?.procedureRuns || {};
  const oemDiagnosticTreeExhausted = target?.payload?.oemDiagnosticTreeExhausted;
  const skippedOemWizardStep = target?.payload?.skippedOemWizardStep;
  const currentStepKey = target?.payload?.currentStepKey;

  const wizardDefinition = getWizardDefinition(templateId);
  const template = getDiagnosticTemplate(templateId);

  const wizardSteps = useMemo(
    () => resolveWizardSteps(wizardDefinition, template),
    [wizardDefinition, template],
  );

  const stepKeyLabels = useMemo(
    () => buildStepKeyLabels(wizardDefinition),
    [wizardDefinition],
  );

  const fieldLabels = useMemo(
    () => buildFieldLabelsForTemplate(templateId),
    [templateId],
  );

  const defaultStepOrder = useMemo(
    () => extractDefaultStepOrder(wizardSteps),
    [wizardSteps],
  );

  const measurementStatuses = useMemo(
    () => buildMeasurementStatusMap(templateId, fields),
    [templateId, fields],
  );

  const leadOptions = useMemo(() => {
    const insertOem = Boolean(
      currentStepKey === OEM_WIZARD_STEP_KEY
      || visitedStepKeys.includes(OEM_WIZARD_STEP_KEY)
      || Object.keys(procedureRuns).length > 0,
    );
    return {
      procedureRuns,
      oemDiagnosticPathExhausted: Boolean(oemDiagnosticTreeExhausted),
      oemManufacturerPathActive: insertOem && !skippedOemWizardStep,
    };
  }, [
    procedureRuns,
    oemDiagnosticTreeExhausted,
    skippedOemWizardStep,
    currentStepKey,
    visitedStepKeys,
  ]);

  const intelligence = useMemo(
    () =>
      templateId
        ? evaluateDiagnosticIntelligence(templateId, fields, measurementStatuses, {
          visitedStepKeys,
          defaultStepOrder,
          complaintChips: wizardDefinition?.complaintChips || [],
          dmaNudges: null,
          fieldLabels,
          stepKeyLabels,
          procedureRuns,
        })
        : null,
    [
      templateId,
      fields,
      procedureRuns,
      measurementStatuses,
      visitedStepKeys,
      defaultStepOrder,
      wizardDefinition?.complaintChips,
      fieldLabels,
      stepKeyLabels,
    ],
  );

  return useMemo(
    () => formatDiyLeadCard(intelligence, leadOptions),
    [intelligence, leadOptions],
  );
}
