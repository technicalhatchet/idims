'use client';

import { useMemo, useState } from 'react';
import { getWizardDefinition, resolveWizardSteps } from '../../components/diagnostics';
import { DIAGNOSTIC_REVIEW_STEP_ID } from '../../components/diagnostics/shared/createWizardDefinitionFromTemplate';
import { buildMeasurementStatusMap } from '../../components/diagnostics/knowledge/measurementContext';
import { getEliminationConfig } from '../../components/diagnostics/knowledge/knowledgeRegistry';
import { evaluateElimination } from '../../components/diagnostics/elimination/eliminationEngine';
import { evaluateDiagnosticIntelligence } from '../../components/diagnostics/intelligence/diagnosticIntelligenceEngine';
import { buildFieldLabelsForTemplate } from '../../components/diagnostics/intelligence/fieldLabels';
import { extractDefaultStepOrder } from '../../components/diagnostics/intelligence/reorderWizardSteps';
import { buildStepKeyLabels } from '../../components/diagnostics/intelligence/stepKeyLabels';
import { getDiagnosticTemplate } from '../../constants/diagnosticTemplates';
import SolomonLeadingHypothesisCard from './SolomonLeadingHypothesisCard';
import SolomonReasoningSheet from './SolomonReasoningSheet';
import SolomonReasoningPanel from './reasoning/SolomonReasoningPanel';
import SolomonProfessionalSessionChrome from './SolomonProfessionalSessionChrome';
import SolomonFaultRanking from './SolomonFaultRanking';
import { SOLOMON_INTERFACE } from './solomonThemeTokens';

export default function SolomonDiagnosticReasoningView({
  payload,
  diagnostic = null,
  variant = 'mobile',
  mobileSheetLayout = false,
  interfaceStyle = SOLOMON_INTERFACE.SIGNATURE,
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const templateId = payload?.templateId;
  const wizardDefinition = getWizardDefinition(templateId);
  const template = getDiagnosticTemplate(templateId);
  const isProfessional = interfaceStyle === SOLOMON_INTERFACE.PROFESSIONAL;

  const measurementStatuses = useMemo(
    () => buildMeasurementStatusMap(templateId, payload?.fields || {}),
    [templateId, payload?.fields],
  );

  const eliminationResult = useMemo(
    () => evaluateElimination(
      getEliminationConfig(templateId),
      payload?.fields || {},
      measurementStatuses,
    ),
    [templateId, payload?.fields, measurementStatuses],
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
      <div className="space-y-2">
        {isProfessional ? (
          <SolomonProfessionalSessionChrome
            session={diagnostic}
            payload={payload}
            intelligence={intelligence}
            measurementStatuses={measurementStatuses}
            sticky={false}
          />
        ) : null}

        <SolomonLeadingHypothesisCard
          intelligence={intelligence}
          onOpenReasoning={() => setSheetOpen(true)}
          variant={variant}
          density={isProfessional ? 'compact' : 'default'}
        />

        {isProfessional ? (
          <SolomonFaultRanking intelligence={intelligence} />
        ) : null}

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
          interfaceStyle={interfaceStyle}
          eliminationResult={isProfessional ? eliminationResult : null}
        />
      </div>
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
