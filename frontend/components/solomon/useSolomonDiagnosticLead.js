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
  });

  return formatDiyLeadCard(intelligence);
}

/**
 * Leading hypothesis readout for Solomon list / session cards.
 * @param {object | null | undefined} target Diagnostic row or continue target
 */
export function useSolomonDiagnosticLead(target) {
  const templateId = target?.payload?.templateId || target?.template_id;
  const fields = target?.payload?.fields || {};
  const visitedStepKeys = target?.payload?.visitedStepKeys || [];

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
        })
        : null,
    [
      templateId,
      fields,
      measurementStatuses,
      visitedStepKeys,
      defaultStepOrder,
      wizardDefinition?.complaintChips,
      fieldLabels,
      stepKeyLabels,
    ],
  );

  return useMemo(() => formatDiyLeadCard(intelligence), [intelligence]);
}
