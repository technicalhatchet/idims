'use client';

import { useMemo } from 'react';
import { getWizardDefinition, resolveWizardSteps } from '../../components/diagnostics';
import { buildMeasurementStatusMap } from '../../components/diagnostics/knowledge/measurementContext';
import { evaluateDiagnosticIntelligence } from '../../components/diagnostics/intelligence/diagnosticIntelligenceEngine';
import { buildFieldLabelsForTemplate } from '../../components/diagnostics/intelligence/fieldLabels';
import { extractDefaultStepOrder } from '../../components/diagnostics/intelligence/reorderWizardSteps';
import { buildStepKeyLabels } from '../../components/diagnostics/intelligence/stepKeyLabels';
import { getDiagnosticTemplate } from '../../constants/diagnosticTemplates';
import SolomonReasoningPanel from './reasoning/SolomonReasoningPanel';

export default function SolomonDiagnosticReasoningView({ payload, variant = 'mobile' }) {
  const templateId = payload?.templateId;
  const wizardDefinition = getWizardDefinition(templateId);
  const template = getDiagnosticTemplate(templateId);

  const measurementStatuses = useMemo(
    () => buildMeasurementStatusMap(templateId, payload?.fields || {}),
    [templateId, payload?.fields],
  );

  const defaultStepOrder = useMemo(() => {
    const baseSteps = resolveWizardSteps(wizardDefinition, template);
    return extractDefaultStepOrder(baseSteps);
  }, [wizardDefinition, template]);

  const stepKeyLabels = useMemo(
    () => buildStepKeyLabels(wizardDefinition),
    [wizardDefinition],
  );

  const fieldLabels = useMemo(
    () => buildFieldLabelsForTemplate(templateId),
    [templateId],
  );

  const visitedStepKeys = payload?.visitedStepKeys || [];

  const intelligence = useMemo(
    () =>
      templateId
        ? evaluateDiagnosticIntelligence(
          templateId,
          payload?.fields || {},
          measurementStatuses,
          {
            visitedStepKeys,
            defaultStepOrder,
            complaintChips: wizardDefinition?.complaintChips || [],
            dmaNudges: null,
            fieldLabels,
            stepKeyLabels,
          },
        )
        : null,
    [
      templateId,
      payload?.fields,
      measurementStatuses,
      visitedStepKeys,
      defaultStepOrder,
      wizardDefinition?.complaintChips,
      fieldLabels,
      stepKeyLabels,
    ],
  );

  if (!intelligence) return null;

  return (
    <SolomonReasoningPanel
      intelligence={intelligence}
      stepKeyLabels={stepKeyLabels}
      variant={variant}
    />
  );
}
