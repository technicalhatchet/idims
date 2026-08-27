'use client';

import { useMemo, useState } from 'react';
import { getWizardDefinition, resolveWizardSteps } from '../../components/diagnostics';
import { DIAGNOSTIC_REVIEW_STEP_ID } from '../../components/diagnostics/shared/createWizardDefinitionFromTemplate';
import { buildMeasurementStatusMap } from '../../components/diagnostics/knowledge/measurementContext';
import { evaluateDiagnosticIntelligence } from '../../components/diagnostics/intelligence/diagnosticIntelligenceEngine';
import { buildFieldLabelsForTemplate } from '../../components/diagnostics/intelligence/fieldLabels';
import { extractDefaultStepOrder } from '../../components/diagnostics/intelligence/reorderWizardSteps';
import { buildStepKeyLabels } from '../../components/diagnostics/intelligence/stepKeyLabels';
import { getDiagnosticTemplate } from '../../constants/diagnosticTemplates';
import SolomonLeadingHypothesisCard from './SolomonLeadingHypothesisCard';
import SolomonReasoningSheet from './SolomonReasoningSheet';
import SolomonReasoningPanel from './reasoning/SolomonReasoningPanel';

export default function SolomonDiagnosticReasoningView({
  payload,
  variant = 'mobile',
  mobileSheetLayout = false,
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const templateId = payload?.templateId;
  const wizardDefinition = getWizardDefinition(templateId);
  const template = getDiagnosticTemplate(templateId);

  const measurementStatuses = useMemo(
    () => buildMeasurementStatusMap(templateId, payload?.fields || {}),
    [templateId, payload?.fields],
  );

  const wizardSteps = useMemo(
    () => resolveWizardSteps(wizardDefinition, template),
    [wizardDefinition, template],
  );

  const defaultStepOrder = useMemo(
    () => extractDefaultStepOrder(wizardSteps),
    [wizardSteps],
  );

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

  const useMobileSheet = mobileSheetLayout || variant === 'mobile';

  if (useMobileSheet) {
    return (
      <>
        <SolomonLeadingHypothesisCard
          intelligence={intelligence}
          onOpenReasoning={() => setSheetOpen(true)}
          variant={variant}
        />
        <SolomonReasoningSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          intelligence={intelligence}
          stepKeyLabels={stepKeyLabels}
          templateId={templateId}
          fields={payload?.fields || {}}
          measurementStatuses={measurementStatuses}
          wizardDefinition={wizardDefinition}
          wizardSteps={wizardSteps}
          visitedStepKeys={visitedStepKeys}
          currentStepKey={payload?.currentStepKey || null}
          reviewStepId={DIAGNOSTIC_REVIEW_STEP_ID}
          variant={variant}
        />
      </>
    );
  }

  return (
    <SolomonReasoningPanel
      intelligence={intelligence}
      stepKeyLabels={stepKeyLabels}
      templateId={templateId}
      fields={payload?.fields || {}}
      measurementStatuses={measurementStatuses}
      wizardDefinition={wizardDefinition}
      variant={variant}
    />
  );
}
