import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { SelectInput } from '../ui/FormElements';
import { Wizard } from '../wizard';
import {
  getWizardDefinition,
  resolveWizardSteps,
} from '../diagnostics';
import { DIAGNOSTIC_REVIEW_STEP_ID } from '../diagnostics/shared/createWizardDefinitionFromTemplate';
import {
  clearDiagnosticDraft,
  getDiagnosticDraftKey,
  loadDiagnosticDraft,
  persistDiagnosticDraft,
} from '../diagnostics/diagnosticDraft';
import ExplainRouteBanner from '../diagnostics/ExplainRouteBanner';
import EliminationBanner from '../diagnostics/EliminationBanner';
import CategoryEvidencePanel from '../diagnostics/CategoryEvidencePanel';
import ComponentHealthPanel from '../diagnostics/ComponentHealthPanel';
import DiagnosisConfidenceMeter from '../diagnostics/DiagnosisConfidenceMeter';
import DiagnosticTimeline from '../diagnostics/DiagnosticTimeline';
import EvidenceSnapshotPanel from '../diagnostics/EvidenceSnapshotPanel';
import { getEvidenceConfig } from '../diagnostics/intelligence/evidenceRegistry';
import { buildDiagnosticFacts } from '../diagnostics/intelligence/buildDiagnosticFacts';
import { buildFieldLabelsForTemplate } from '../diagnostics/intelligence/fieldLabels';
import { formatGeneratedServiceNote } from '../diagnostics/intelligence/formatGeneratedServiceNote';
import { buildMeasurementStatusMap } from '../diagnostics/knowledge/measurementContext';
import { getEliminationConfig } from '../diagnostics/knowledge/knowledgeRegistry';
import { evaluateElimination } from '../diagnostics/elimination/eliminationEngine';
import { evaluateDiagnosticIntelligence } from '../diagnostics/intelligence/diagnosticIntelligenceEngine';
import {
  extractDefaultStepOrder,
} from '../diagnostics/intelligence/reorderWizardSteps';
import { buildStepKeyLabels } from '../diagnostics/intelligence/stepKeyLabels';
import { useDmaEvidenceNudges } from '../diagnostics/intelligence/useDmaEvidenceNudges';
import {
  appendTimelineEvent,
  buildEvidenceSnapshot,
  resolveStepKeyForFieldKey,
  resolveTestIdForFieldKey,
} from '../diagnostics/intelligence/timeline';
import {
  diffRouting,
  evaluateRouting,
  getComplaintChipIds,
  maybeApplyComplaintChipInference,
} from '../diagnostics/routing/routingEngine';
import { evaluateRecommendations } from '../diagnostics/routing/recommendationEngine';
import { getDiagnosticLastMeasurements, generateDiagnosticNotes } from '../../services/api/diagnosticsApi';
import SolomonReasoningPanel from '../solomon/reasoning/SolomonReasoningPanel';
import SolomonLeadingHypothesisCard from '../solomon/SolomonLeadingHypothesisCard';
import SolomonReasoningSheet from '../solomon/SolomonReasoningSheet';
import SolomonProfessionalSessionChrome from '../solomon/SolomonProfessionalSessionChrome';
import SolomonFaultRanking from '../solomon/SolomonFaultRanking';
import { SOLOMON_INTERFACE } from '../solomon/solomonThemeTokens';
import SolomonInsightPeekBanner from '../solomon/SolomonInsightPeekBanner';
import {
  eliminationInsightLabel,
  hasNewEliminationInsight,
  hasSignificantIntelligenceChange,
} from '../../utils/solomonInsightPeek';
import { GUIDED_DIAGNOSTICS_LABEL } from '../../constants/workOrderNoteTypes';
import {
  formatDiagnosticVisitLabel,
  getDiagnosticTemplate,
  getInitialDiagnosticFieldValues,
  listDiagnosticTemplates,
} from '../../constants/diagnosticTemplates';

export { clearDiagnosticDraft, getDiagnosticDraftKey };

const COMPLAINT_CHIP_INFER_FIELDS = new Set([
  'customer_complaint.complaint',
  'customer_complaint.error_codes',
]);

export default function DiagnosticResultsForm({
  payload,
  onChange,
  workOrder = null,
  workOrderId = null,
  draftNoteId = null,
  readOnly = false,
  variant = 'mobile',
  onSave = null,
  isSaving = false,
  audience = 'tech',
  showSolomonReasoning,
  onProgressSave = null,
  progressSaveDebounceMs = 1400,
  hideTemplateSelector = false,
  insightPeekPlacement = 'wizard-footer',
  onInsightPeeksChange = null,
  solomonMobileLayout = false,
  interfaceStyle = SOLOMON_INTERFACE.SIGNATURE,
  solomonSession = null,
}) {
  const useSolomonReasoning = showSolomonReasoning ?? variant === 'mobile';
  const isProfessionalSession = interfaceStyle === SOLOMON_INTERFACE.PROFESSIONAL && solomonMobileLayout;
  const template = getDiagnosticTemplate(payload?.templateId);
  const wizardDefinition = getWizardDefinition(payload?.templateId);
  const templateOptions = listDiagnosticTemplates().map((t) => ({ value: t.id, label: t.label }));
  const isDiyAudience = audience === 'diy';
  const draftKey = getDiagnosticDraftKey(workOrderId, draftNoteId);
  const draftRestoredRef = useRef(false);
  const [lastReadings, setLastReadings] = useState({});
  const [visitedStepKeys, setVisitedStepKeys] = useState([]);
  const prevStepIdRef = useRef(null);
  const prevStepKeyForTimelineRef = useRef(null);
  const payloadRef = useRef(payload);
  const intelligenceResultRef = useRef(null);
  const fieldTimelineTimersRef = useRef({});
  const lastFieldTimelineRef = useRef({});
  const progressSaveTimerRef = useRef(null);
  const [reasoningSheetOpen, setReasoningSheetOpen] = useState(false);
  const [inlineRouteBanner, setInlineRouteBanner] = useState(false);
  const [wizardJumpNonce, setWizardJumpNonce] = useState(0);

  payloadRef.current = payload;

  const scheduleProgressSave = useCallback(
    ({ immediate = false } = {}) => {
      if (!onProgressSave || readOnly) return;
      if (progressSaveTimerRef.current) {
        clearTimeout(progressSaveTimerRef.current);
        progressSaveTimerRef.current = null;
      }
      const delay = immediate ? 350 : progressSaveDebounceMs;
      progressSaveTimerRef.current = setTimeout(() => {
        progressSaveTimerRef.current = null;
        void onProgressSave(payloadRef.current);
      }, delay);
    },
    [onProgressSave, readOnly, progressSaveDebounceMs],
  );

  useEffect(() => {
    return () => {
      if (progressSaveTimerRef.current) clearTimeout(progressSaveTimerRef.current);
    };
  }, []);

  const measurementStatuses = useMemo(
    () => buildMeasurementStatusMap(payload?.templateId, payload?.fields || {}),
    [payload?.templateId, payload?.fields],
  );

  const routingResult = useMemo(
    () => evaluateRouting(wizardDefinition, payload?.fields || {}, measurementStatuses),
    [wizardDefinition, payload?.fields, measurementStatuses],
  );

  const activeRecommendations = useMemo(
    () => evaluateRecommendations(
      wizardDefinition?.routing?.recommendations,
      payload?.fields || {},
      measurementStatuses,
    ),
    [wizardDefinition?.routing?.recommendations, payload?.fields, measurementStatuses],
  );

  const eliminationResult = useMemo(
    () => evaluateElimination(
      getEliminationConfig(payload?.templateId),
      payload?.fields || {},
      measurementStatuses,
    ),
    [payload?.templateId, payload?.fields, measurementStatuses],
  );

  useEffect(() => {
    const serial = workOrder?.equipment_serial;
    const templateId = payload?.templateId;
    if (!serial || !templateId || readOnly) {
      setLastReadings({});
      return undefined;
    }

    let cancelled = false;
    getDiagnosticLastMeasurements({
      equipmentSerial: serial,
      templateId,
      excludeWorkOrderId: workOrderId,
    })
      .then((result) => {
        if (!cancelled) setLastReadings(result?.readings || {});
      })
      .catch(() => {
        if (!cancelled) setLastReadings({});
      });

    return () => {
      cancelled = true;
    };
  }, [workOrder?.equipment_serial, payload?.templateId, workOrderId, readOnly]);

  const prevRoutingRef = useRef(routingResult);
  const [routeDiff, setRouteDiff] = useState(null);
  const routeDiffDismissedRef = useRef(false);
  const [routePathPeek, setRoutePathPeek] = useState(false);
  const prevEliminationPeekRef = useRef(null);
  const prevIntelligencePeekRef = useRef(null);
  const [evidencePeek, setEvidencePeek] = useState(false);
  const evidencePeekDismissedRef = useRef(false);

  const scrollToInsight = useCallback((elementId) => {
    const el = document.getElementById(elementId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    if (routeDiffDismissedRef.current) {
      setRoutePathPeek(false);
      prevRoutingRef.current = routingResult;
      return;
    }
    const diff = diffRouting(prevRoutingRef.current, routingResult, wizardDefinition);
    if (diff) setRouteDiff(diff);
    const hasPathChange = diff && (diff.added.length > 0 || diff.removed.length > 0);
    if (hasPathChange) setRoutePathPeek(true);
    prevRoutingRef.current = routingResult;
  }, [routingResult, wizardDefinition]);

  useEffect(() => {
    routeDiffDismissedRef.current = false;
    evidencePeekDismissedRef.current = false;
    setRouteDiff(null);
    setRoutePathPeek(false);
    setEvidencePeek(false);
    prevEliminationPeekRef.current = null;
    prevIntelligencePeekRef.current = null;
    const restoredVisited = Array.isArray(payload?.visitedStepKeys)
      ? payload.visitedStepKeys
      : [];
    setVisitedStepKeys(restoredVisited);
    prevStepIdRef.current = null;
    prevStepKeyForTimelineRef.current = payload?.currentStepKey || null;
    lastFieldTimelineRef.current = {};
    Object.values(fieldTimelineTimersRef.current).forEach((timer) => clearTimeout(timer));
    fieldTimelineTimersRef.current = {};
    prevRoutingRef.current = evaluateRouting(
      wizardDefinition,
      payload?.fields || {},
      measurementStatuses,
    );
  }, [payload?.templateId, wizardDefinition]);

  const baseSteps = useMemo(
    () => resolveWizardSteps(wizardDefinition, template),
    [wizardDefinition, template],
  );

  const defaultStepOrder = useMemo(
    () => extractDefaultStepOrder(baseSteps),
    [baseSteps],
  );

  const stepKeyLabels = useMemo(
    () => buildStepKeyLabels(wizardDefinition),
    [wizardDefinition],
  );

  const fieldLabels = useMemo(
    () => buildFieldLabelsForTemplate(payload?.templateId),
    [payload?.templateId],
  );

  const liveIntelligence = useMemo(
    () => evaluateDiagnosticIntelligence(
      payload?.templateId,
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
    ),
    [
      payload?.templateId,
      payload?.fields,
      measurementStatuses,
      visitedStepKeys,
      defaultStepOrder,
      wizardDefinition?.complaintChips,
      fieldLabels,
      stepKeyLabels,
    ],
  );

  const { nudges: dmaNudges, isLoading: dmaNudgesLoading } = useDmaEvidenceNudges({
    templateId: payload?.templateId,
    workOrder,
    activeTags: liveIntelligence?.activeDmaTags || [],
    excludeWorkOrderId: workOrderId,
    enabled: !readOnly && Boolean(liveIntelligence?.activeDmaTags?.length),
  });

  const intelligenceResult = useMemo(
    () => evaluateDiagnosticIntelligence(
      payload?.templateId,
      payload?.fields || {},
      measurementStatuses,
      {
        visitedStepKeys,
        defaultStepOrder,
        complaintChips: wizardDefinition?.complaintChips || [],
        dmaNudges,
        fieldLabels,
        stepKeyLabels,
      },
    ),
    [
      payload?.templateId,
      payload?.fields,
      measurementStatuses,
      visitedStepKeys,
      defaultStepOrder,
      wizardDefinition?.complaintChips,
      dmaNudges,
      fieldLabels,
      stepKeyLabels,
    ],
  );

  intelligenceResultRef.current = intelligenceResult;

  useEffect(() => {
    if (readOnly) return;
    if (evidencePeekDismissedRef.current) {
      prevEliminationPeekRef.current = eliminationResult;
      prevIntelligencePeekRef.current = intelligenceResult;
      return;
    }
    const elimChange = hasNewEliminationInsight(prevEliminationPeekRef.current, eliminationResult);
    const intelChange = hasSignificantIntelligenceChange(
      prevIntelligencePeekRef.current,
      intelligenceResult,
    );
    const hasInsightContent =
      eliminationResult?.confirmed?.length
      || eliminationResult?.suspected?.length
      || eliminationResult?.eliminated?.length
      || (useSolomonReasoning && intelligenceResult?.topCategories?.length);
    if ((elimChange || intelChange) && hasInsightContent) setEvidencePeek(true);
    prevEliminationPeekRef.current = eliminationResult;
    prevIntelligencePeekRef.current = intelligenceResult;
  }, [eliminationResult, intelligenceResult, readOnly, useSolomonReasoning]);

  // Keep wizard step order stable — routing hides irrelevant steps; intelligence
  // highlights suggested next step in the progress bar (physical reorder broke Previous).
  const steps = baseSteps;

  const wizardInitialStepId = useMemo(() => {
    const stepKey = payload?.currentStepKey;
    if (!stepKey) return undefined;
    const step = steps.find((s) => s.meta?.stepKey === stepKey);
    return step?.id;
  }, [steps, payload?.currentStepKey]);

  const wizardInitialVisitedStepIds = useMemo(() => {
    const keys = Array.isArray(payload?.visitedStepKeys)
      ? payload.visitedStepKeys
      : visitedStepKeys;
    const ids = new Set();
    for (const step of steps) {
      const stepKey = step.meta?.stepKey;
      if (stepKey && keys.includes(stepKey)) ids.add(step.id);
    }
    return Array.from(ids);
  }, [steps, payload?.visitedStepKeys, visitedStepKeys]);

  useEffect(() => {
    if (readOnly || draftRestoredRef.current || !draftKey || draftNoteId) return;
    const draft = loadDiagnosticDraft(draftKey);
    draftRestoredRef.current = true;
    if (draft) {
      onChange({
        templateId: draft.templateId,
        appointmentId: draft.appointmentId || '',
        fields: draft.fields || {},
        timeline: draft.timeline || [],
        evidenceSnapshot: draft.evidenceSnapshot || null,
        autoNoteBullets: draft.autoNoteBullets || [],
        autoNoteEdited: Boolean(draft.autoNoteEdited),
        autoNoteFormat: draft.autoNoteFormat === 'prose' ? 'prose' : 'bullets',
        includeAutoNoteInSummary: draft.includeAutoNoteInSummary !== false,
        visitedStepKeys: Array.isArray(draft.visitedStepKeys) ? draft.visitedStepKeys : [],
        currentStepKey: draft.currentStepKey || null,
      });
    }
  }, [draftKey, draftNoteId, onChange, readOnly]);

  const appointments = (Array.isArray(workOrder?.appointments) ? workOrder.appointments : [])
    .filter((a) => String(a.status || '').toLowerCase() !== 'canceled');

  const selectedAppointment = useMemo(
    () => appointments.find((a) => String(a.id) === String(payload?.appointmentId || '')),
    [appointments, payload?.appointmentId],
  );
  const visitLabel = formatDiagnosticVisitLabel(selectedAppointment);

  const appointmentOptions = [
    { value: '', label: '— No visit linked —' },
    ...appointments.map((a) => ({
      value: String(a.id),
      label: formatDiagnosticVisitLabel(a) || String(a.id),
    })),
  ];

  const emitChange = useCallback(
    (nextPayload) => {
      onChange(nextPayload);
      if (!readOnly) persistDiagnosticDraft(draftKey, nextPayload);
      scheduleProgressSave();
    },
    [draftKey, onChange, readOnly, scheduleProgressSave],
  );

  useEffect(() => {
    if (readOnly || payload?.autoNoteEdited || !intelligenceResult?.autoNoteBullets?.length) {
      return;
    }
    const suggested = intelligenceResult.autoNoteBullets;
    const current = payload?.autoNoteBullets || [];
    if (current.length === suggested.length && current.every((line, index) => line === suggested[index])) {
      return;
    }
    const nextPayload = {
      ...payloadRef.current,
      autoNoteBullets: suggested,
    };
    payloadRef.current = nextPayload;
    emitChange(nextPayload);
  }, [readOnly, payload?.autoNoteEdited, payload?.autoNoteBullets, intelligenceResult?.autoNoteBullets, emitChange]);

  const handleAutoNoteBulletsChange = useCallback(
    (bullets, { edited = true, format } = {}) => {
      const nextPayload = {
        ...payloadRef.current,
        autoNoteBullets: bullets,
        autoNoteEdited: edited,
        autoNoteFormat: format || payloadRef.current?.autoNoteFormat || 'bullets',
      };
      payloadRef.current = nextPayload;
      emitChange(nextPayload);
    },
    [emitChange],
  );

  const handleIncludeAutoNoteChange = useCallback(
    (include) => {
      const nextPayload = {
        ...payloadRef.current,
        includeAutoNoteInSummary: include,
      };
      payloadRef.current = nextPayload;
      emitChange(nextPayload);
    },
    [emitChange],
  );

  const handleRefreshAutoNote = useCallback(() => {
    if (!intelligenceResult?.autoNoteBullets?.length) return;
    handleAutoNoteBulletsChange(intelligenceResult.autoNoteBullets, {
      edited: false,
      format: 'bullets',
    });
  }, [handleAutoNoteBulletsChange, intelligenceResult?.autoNoteBullets]);

  const handleGenerateServiceNotes = useCallback(async () => {
    if (readOnly || !payload?.templateId || !intelligenceResult) return null;

    const evidenceConfig = getEvidenceConfig(payload.templateId);
    if (!evidenceConfig) return null;

    const facts = buildDiagnosticFacts({
      templateId: payload.templateId,
      templateLabel: template?.label || payload.templateId,
      equipmentSubtype: workOrder?.equipment_subtype,
      fields: payload.fields || {},
      complaintChips: wizardDefinition?.complaintChips || [],
      config: evidenceConfig,
      intelligence: intelligenceResult,
      measurementStatuses,
      fieldLabels,
      stepKeyLabels,
    });

    const response = await generateDiagnosticNotes(facts);
    const bullets = formatGeneratedServiceNote(response);
    if (bullets.length) {
      handleAutoNoteBulletsChange(bullets, { edited: true, format: 'prose' });
    }
    return response;
  }, [
    readOnly,
    payload?.templateId,
    payload?.fields,
    intelligenceResult,
    template?.label,
    workOrder?.equipment_subtype,
    wizardDefinition?.complaintChips,
    measurementStatuses,
    fieldLabels,
    stepKeyLabels,
    handleAutoNoteBulletsChange,
  ]);

  const handleTemplateChange = (templateId) => {
    emitChange({
      templateId,
      appointmentId: payload?.appointmentId || '',
      fields: getInitialDiagnosticFieldValues(templateId, workOrder),
      timeline: [],
      evidenceSnapshot: null,
      autoNoteBullets: [],
      autoNoteEdited: false,
      autoNoteFormat: 'bullets',
      includeAutoNoteInSummary: true,
    });
  };

  const queueFieldTimelineEvent = useCallback(
    (fieldKey, value) => {
      if (readOnly) return;

      const stepKey = resolveStepKeyForFieldKey(fieldKey, wizardDefinition);
      if (!visitedStepKeys.includes(stepKey)) return;

      const timers = fieldTimelineTimersRef.current;
      if (timers[fieldKey]) clearTimeout(timers[fieldKey]);

      timers[fieldKey] = setTimeout(() => {
        const last = lastFieldTimelineRef.current[fieldKey];
        if (last === value) return;
        lastFieldTimelineRef.current[fieldKey] = value;

        const currentPayload = payloadRef.current;
        const testId = resolveTestIdForFieldKey(currentPayload?.templateId, fieldKey);
        const timeline = appendTimelineEvent(currentPayload?.timeline, {
          stepKey,
          action: 'field_updated',
          fieldKey,
          testId,
          payload: { value },
        });

        const nextPayload = {
          ...currentPayload,
          timeline,
          evidenceSnapshot: buildEvidenceSnapshot(intelligenceResultRef.current),
        };
        payloadRef.current = nextPayload;
        emitChange(nextPayload);
      }, 1000);
    },
    [emitChange, readOnly, visitedStepKeys, wizardDefinition],
  );

  const handleFieldChange = useCallback(
    (key, value) => {
      const fields = {
        ...(payloadRef.current?.fields || {}),
        [key]: value,
      };
      const chips = wizardDefinition?.complaintChips || [];
      if (
        chips.length &&
        COMPLAINT_CHIP_INFER_FIELDS.has(key) &&
        !getComplaintChipIds(fields).length
      ) {
        maybeApplyComplaintChipInference(fields, chips);
      }
      const nextPayload = {
        ...payloadRef.current,
        fields,
      };
      payloadRef.current = nextPayload;
      emitChange(nextPayload);
      queueFieldTimelineEvent(key, value);
    },
    [emitChange, queueFieldTimelineEvent, wizardDefinition?.complaintChips],
  );

  const handleAppointmentChange = (appointmentId) => {
    emitChange({ ...payload, appointmentId });
  };

  const wizardContext = useMemo(
    () => ({
      payload,
      workOrder,
      onFieldChange: handleFieldChange,
      routing: routingResult,
      complaintChips: wizardDefinition?.complaintChips || [],
      wizardDefinition,
      visitedStepKeys,
      currentStepKey: payload?.currentStepKey || null,
      reviewStepId: wizardDefinition?.reviewStep?.id || 'diagnostic_review',
      fieldVisibilityRules: wizardDefinition?.routing?.fieldVisibility || [],
      fieldHelp: wizardDefinition?.routing?.fieldHelp || {},
      activeRecommendations,
      lastReadings,
      elimination: eliminationResult,
      intelligence: intelligenceResult
        ? {
          ...intelligenceResult,
          stepKeyLabels,
          fieldLabels,
          autoNoteBullets: payload?.autoNoteBullets?.length
            ? payload.autoNoteBullets
            : intelligenceResult.autoNoteBullets,
          includeAutoNoteInSummary: payload?.includeAutoNoteInSummary !== false,
          autoNoteEdited: Boolean(payload?.autoNoteEdited),
          autoNoteFormat: payload?.autoNoteFormat || 'bullets',
        }
        : null,
      onAutoNoteBulletsChange: readOnly ? null : handleAutoNoteBulletsChange,
      onIncludeAutoNoteChange: readOnly ? null : handleIncludeAutoNoteChange,
      onRefreshAutoNote: readOnly ? null : handleRefreshAutoNote,
      onGenerateServiceNotes: readOnly ? null : handleGenerateServiceNotes,
    }),
    [
      handleFieldChange,
      payload,
      routingResult,
      activeRecommendations,
      eliminationResult,
      intelligenceResult,
      stepKeyLabels,
      fieldLabels,
      lastReadings,
      wizardDefinition?.complaintChips,
      wizardDefinition?.routing?.fieldVisibility,
      wizardDefinition,
      visitedStepKeys,
      payload?.currentStepKey,
      wizardDefinition?.routing?.fieldHelp,
      workOrder,
      readOnly,
      handleAutoNoteBulletsChange,
      handleIncludeAutoNoteChange,
      handleRefreshAutoNote,
      handleGenerateServiceNotes,
    ],
  );

  const handleWizardStepChange = useCallback(
    (navigation) => {
      const step = steps.find((s) => s.id === navigation.currentStepId);
      const stepKey = step?.meta?.stepKey;
      let nextVisited = visitedStepKeys;
      if (stepKey && !visitedStepKeys.includes(stepKey)) {
        nextVisited = [...visitedStepKeys, stepKey];
        setVisitedStepKeys(nextVisited);
      }

      if (!readOnly && stepKey && prevStepIdRef.current !== navigation.currentStepId) {
        const prevStepKey = prevStepKeyForTimelineRef.current;
        let timeline = payloadRef.current?.timeline || [];

        if (prevStepKey && prevStepKey !== stepKey) {
          timeline = appendTimelineEvent(timeline, {
            stepKey: prevStepKey,
            action: 'completed',
          });
        }

        timeline = appendTimelineEvent(timeline, {
          stepKey,
          action: 'entered',
        });

        prevStepKeyForTimelineRef.current = stepKey;
        prevStepIdRef.current = navigation.currentStepId;

        const nextPayload = {
          ...payloadRef.current,
          timeline,
          visitedStepKeys: nextVisited,
          currentStepKey: stepKey,
          evidenceSnapshot: buildEvidenceSnapshot(intelligenceResultRef.current),
        };
        payloadRef.current = nextPayload;
        emitChange(nextPayload);
        scheduleProgressSave({ immediate: true });
      }
    },
    [steps, readOnly, emitChange, visitedStepKeys, scheduleProgressSave],
  );

  const handleJumpToStepKey = useCallback(
    (stepKey) => {
      if (!stepKey || readOnly) return;
      const step = steps.find((s) => s.meta?.stepKey === stepKey);
      if (!step) return;

      const nextVisited = visitedStepKeys.includes(stepKey)
        ? visitedStepKeys
        : [...visitedStepKeys, stepKey];

      if (!visitedStepKeys.includes(stepKey)) {
        setVisitedStepKeys(nextVisited);
      }

      prevStepIdRef.current = step.id;
      prevStepKeyForTimelineRef.current = stepKey;

      const nextPayload = {
        ...payloadRef.current,
        currentStepKey: stepKey,
        visitedStepKeys: nextVisited,
      };
      payloadRef.current = nextPayload;
      emitChange(nextPayload);
      setWizardJumpNonce((value) => value + 1);
      scheduleProgressSave({ immediate: true });
    },
    [steps, readOnly, emitChange, visitedStepKeys, scheduleProgressSave],
  );

  const handleWizardComplete = useCallback(async () => {
    let nextPayload = payloadRef.current;
    if (!readOnly) {
      const currentStepKey = prevStepKeyForTimelineRef.current;
      let timeline = payloadRef.current?.timeline || [];

      if (currentStepKey) {
        timeline = appendTimelineEvent(timeline, {
          stepKey: currentStepKey,
          action: 'completed',
        });
      }

      nextPayload = {
        ...payloadRef.current,
        timeline,
        visitedStepKeys: payloadRef.current?.visitedStepKeys || visitedStepKeys,
        currentStepKey: prevStepKeyForTimelineRef.current || payloadRef.current?.currentStepKey,
        evidenceSnapshot: buildEvidenceSnapshot(intelligenceResultRef.current),
        autoNoteBullets: payloadRef.current?.autoNoteEdited
          ? payloadRef.current.autoNoteBullets || []
          : intelligenceResultRef.current?.autoNoteBullets || payloadRef.current?.autoNoteBullets || [],
      };
      payloadRef.current = nextPayload;
      emitChange(nextPayload);
    }
    if (onSave) {
      await onSave(nextPayload);
    }
  }, [emitChange, onSave, readOnly]);

  const handleWizardAutoSave = useCallback(() => {
    if (!readOnly && payload?.templateId) {
      persistDiagnosticDraft(draftKey, payload);
    }
  }, [draftKey, payload, readOnly]);

  const handleViewRoutePath = useCallback(() => {
    if (solomonMobileLayout) {
      setInlineRouteBanner(true);
      setRoutePathPeek(false);
      return;
    }
    scrollToInsight('solomon-diagnostic-path-insight');
    setRoutePathPeek(false);
  }, [scrollToInsight, solomonMobileLayout]);

  const handleViewEvidenceInsight = useCallback(() => {
    if (solomonMobileLayout) {
      setReasoningSheetOpen(true);
      setEvidencePeek(false);
      return;
    }
    const hasElimination =
      eliminationResult?.confirmed?.length
      || eliminationResult?.suspected?.length
      || eliminationResult?.eliminated?.length;
    scrollToInsight(hasElimination ? 'solomon-elimination-insight' : 'solomon-reasoning-insight');
    setEvidencePeek(false);
  }, [scrollToInsight, eliminationResult, solomonMobileLayout]);

  const mobileInsightPeeks = null;
  /* Insight peek banners — disabled for now (Solomon mobile)
  const mobileInsightPeeks =
    variant === 'mobile' && !readOnly && (routePathPeek || evidencePeek) ? (
      <div className="space-y-2">
        {routePathPeek ? (
          <SolomonInsightPeekBanner
            label="View updated diagnostic path."
            onView={handleViewRoutePath}
            onDismiss={() => setRoutePathPeek(false)}
            variant={variant}
            tone="cyan"
          />
        ) : null}
        {evidencePeek ? (
          <SolomonInsightPeekBanner
            label={eliminationInsightLabel(eliminationResult)}
            onView={handleViewEvidenceInsight}
            onDismiss={() => {
              evidencePeekDismissedRef.current = true;
              setEvidencePeek(false);
            }}
            variant={variant}
            tone="violet"
          />
        ) : null}
      </div>
    ) : null;
  */

  useEffect(() => {
    if (insightPeekPlacement === 'external' && onInsightPeeksChange) {
      onInsightPeeksChange(mobileInsightPeeks);
    }
  }, [insightPeekPlacement, mobileInsightPeeks, onInsightPeeksChange]);

  const draftHint = !readOnly && draftKey ? (
    <p className={`text-[11px] text-center ${variant === 'mobile' ? 'text-gray-600' : 'text-gray-400'}`}>
      Draft saved automatically.
    </p>
  ) : null;

  const wizardFooterExtra = (
    <>
      {insightPeekPlacement !== 'external' ? mobileInsightPeeks : null}
      {draftHint}
    </>
  );

  if (!template) {
    return <p className="text-sm text-gray-500">Select an appliance template.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Intro banner — appliance + guided diagnostics how-to (disabled for SOLOMON mobile flow; restore if needed)
      {!readOnly && (
        <div
          className={`rounded-xl border px-4 py-3 ${
            variant === 'mobile'
              ? 'border-cyan-500/20 bg-cyan-500/5'
              : 'border-cyan-200 bg-cyan-50 dark:border-cyan-900 dark:bg-cyan-950/30'
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              variant === 'mobile' ? 'text-cyan-200' : 'text-cyan-900 dark:text-cyan-100'
            }`}
          >
            {template.label} — {GUIDED_DIAGNOSTICS_LABEL}
          </p>
          <p
            className={`text-xs mt-1 ${
              variant === 'mobile' ? 'text-gray-400' : 'text-cyan-800/80 dark:text-cyan-200/70'
            }`}
          >
            Walk through each section, then save a Diagnostic Results note with your summary and full checklist.
          </p>
        </div>
      )}
      */}

      {readOnly ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm space-y-1 ${
            variant === 'mobile'
              ? 'border-white/10 bg-white/[0.02] text-gray-300'
              : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          <div>
            <span className="font-medium">Appliance:</span> {template.label}
          </div>
          {visitLabel && (
            <div>
              <span className="font-medium">Visit:</span> {visitLabel}
            </div>
          )}
        </div>
      ) : (
        <>
          {!hideTemplateSelector && isDiyAudience ? (
            <div className="rounded-xl border border-white/10 bg-[#0D1525] px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-gray-500">Appliance</p>
                <p className="text-sm font-medium text-white mt-0.5">{template.label}</p>
              </div>
              <Link
                href="/solomon/start"
                className="text-xs text-cyan-400 hover:text-cyan-300 shrink-0"
              >
                Change
              </Link>
            </div>
          ) : null}
          {!hideTemplateSelector && !isDiyAudience ? (
            <SelectInput
              label="Appliance template"
              id="diagTemplateId"
              value={payload?.templateId || ''}
              onChange={(e) => handleTemplateChange(e.target.value)}
              options={templateOptions}
              disabled={readOnly}
            />
          ) : null}

          {workOrder ? (
            <SelectInput
              label="Visit (optional)"
              id="diagAppointmentId"
              value={payload?.appointmentId || ''}
              onChange={(e) => handleAppointmentChange(e.target.value)}
              options={appointmentOptions}
              disabled={readOnly}
            />
          ) : null}
        </>
      )}

      {variant === 'mobile' ? (
        <>
          {isProfessionalSession ? (
            <SolomonProfessionalSessionChrome
              session={solomonSession}
              payload={payload}
              intelligence={intelligenceResult}
              measurementStatuses={measurementStatuses}
              onStepSelect={readOnly ? undefined : handleJumpToStepKey}
            />
          ) : null}

          {solomonMobileLayout && intelligenceResult ? (
            <SolomonLeadingHypothesisCard
              intelligence={intelligenceResult}
              onOpenReasoning={() => setReasoningSheetOpen(true)}
              variant={variant}
              density={isProfessionalSession ? 'compact' : 'default'}
            />
          ) : null}

          {isProfessionalSession && intelligenceResult ? (
            <SolomonFaultRanking intelligence={intelligenceResult} />
          ) : null}

          {/* Diagnostic path banner — disabled for now (Solomon mobile)
          {solomonMobileLayout && inlineRouteBanner && routeDiff && !readOnly ? (
            <ExplainRouteBanner
              diff={routeDiff}
              variant={variant}
              onDismiss={() => {
                setInlineRouteBanner(false);
                routeDiffDismissedRef.current = true;
                setRouteDiff(null);
              }}
            />
          ) : null}
          */}

          <Wizard
            steps={steps}
            context={wizardContext}
            readOnly={readOnly}
            variant={variant}
            resetKey={`${payload?.templateId || 'wizard'}:${wizardJumpNonce}`}
            initialStepId={wizardInitialStepId}
            initialVisitedStepIds={wizardInitialVisitedStepIds}
            onAutoSave={handleWizardAutoSave}
            onStepChange={handleWizardStepChange}
            onComplete={onSave ? () => void handleWizardComplete() : undefined}
            completeLabel={isDiyAudience ? 'Save my notes' : 'Save Diagnostic Results'}
            isCompleting={isSaving}
            footerExtra={wizardFooterExtra}
            headerTitle={
              readOnly
                ? undefined
                : variant === 'mobile'
                  ? undefined
                  : `${template.label} — ${GUIDED_DIAGNOSTICS_LABEL}`
            }
            headerDescription={
              readOnly || variant === 'mobile'
                ? undefined
                : 'Complete each step, generate service notes on Review, then save.'
            }
          />

          {routeDiff && !readOnly && !solomonMobileLayout ? (
            <div id="solomon-diagnostic-path-insight" className="scroll-mt-3">
              <ExplainRouteBanner
                diff={routeDiff}
                variant={variant}
                onDismiss={() => {
                  routeDiffDismissedRef.current = true;
                  setRouteDiff(null);
                  setRoutePathPeek(false);
                }}
              />
            </div>
          ) : null}

          {readOnly && payload?.evidenceSnapshot && (
            <EvidenceSnapshotPanel
              snapshot={payload.evidenceSnapshot}
              variant={variant}
              stepKeyLabels={stepKeyLabels}
            />
          )}

          {eliminationResult && !solomonMobileLayout ? (
            <div id="solomon-elimination-insight" className="scroll-mt-3">
              <EliminationBanner result={eliminationResult} variant={variant} />
            </div>
          ) : null}

          {intelligenceResult && useSolomonReasoning && !solomonMobileLayout ? (
            <div id="solomon-reasoning-insight" className="scroll-mt-3">
              <SolomonReasoningPanel
                intelligence={intelligenceResult}
                stepKeyLabels={stepKeyLabels}
                templateId={payload?.templateId}
                fields={payload?.fields || {}}
                measurementStatuses={measurementStatuses}
                wizardDefinition={wizardDefinition}
                variant={variant}
              />
            </div>
          ) : null}

          {solomonMobileLayout && intelligenceResult ? (
            <SolomonReasoningSheet
              open={reasoningSheetOpen}
              onClose={() => setReasoningSheetOpen(false)}
              intelligence={intelligenceResult}
              stepKeyLabels={stepKeyLabels}
              templateId={payload?.templateId}
              fields={payload?.fields || {}}
              measurementStatuses={measurementStatuses}
              wizardDefinition={wizardDefinition}
              wizardSteps={steps}
              visitedStepKeys={
                Array.isArray(payload?.visitedStepKeys)
                  ? payload.visitedStepKeys
                  : visitedStepKeys
              }
              currentStepKey={payload?.currentStepKey || null}
              reviewStepId={DIAGNOSTIC_REVIEW_STEP_ID}
              variant={variant}
              interfaceStyle={interfaceStyle}
              eliminationResult={isProfessionalSession ? eliminationResult : null}
            />
          ) : null}

          {intelligenceResult && !useSolomonReasoning && (
            <>
              <DiagnosisConfidenceMeter
                intelligence={intelligenceResult}
                variant={variant}
              />
              <ComponentHealthPanel
                intelligence={intelligenceResult}
                variant={variant}
              />
              <CategoryEvidencePanel
                intelligence={intelligenceResult}
                variant={variant}
                stepKeyLabels={stepKeyLabels}
                dmaNudgesLoading={dmaNudgesLoading}
              />
            </>
          )}

          <DiagnosticTimeline
            timeline={payload?.timeline || []}
            stepKeyLabels={stepKeyLabels}
            fieldLabels={fieldLabels}
            variant={variant}
            title="Diagnostic Timeline"
            defaultExpanded={readOnly}
          />
        </>
      ) : (
        <>
          {routeDiff && !readOnly && (
            <ExplainRouteBanner
              diff={routeDiff}
              variant={variant}
              onDismiss={() => {
                routeDiffDismissedRef.current = true;
                setRouteDiff(null);
                setRoutePathPeek(false);
              }}
            />
          )}

          {readOnly && payload?.evidenceSnapshot && (
            <EvidenceSnapshotPanel
              snapshot={payload.evidenceSnapshot}
              variant={variant}
              stepKeyLabels={stepKeyLabels}
            />
          )}

          {eliminationResult && (
            <EliminationBanner result={eliminationResult} variant={variant} />
          )}

          {intelligenceResult && useSolomonReasoning ? (
            <SolomonReasoningPanel
              intelligence={intelligenceResult}
              stepKeyLabels={stepKeyLabels}
              templateId={payload?.templateId}
              fields={payload?.fields || {}}
              measurementStatuses={measurementStatuses}
              wizardDefinition={wizardDefinition}
              variant={variant}
            />
          ) : null}

          {intelligenceResult && !useSolomonReasoning && (
            <>
              <DiagnosisConfidenceMeter
                intelligence={intelligenceResult}
                variant={variant}
              />
              <ComponentHealthPanel
                intelligence={intelligenceResult}
                variant={variant}
              />
              <CategoryEvidencePanel
                intelligence={intelligenceResult}
                variant={variant}
                stepKeyLabels={stepKeyLabels}
                dmaNudgesLoading={dmaNudgesLoading}
              />
            </>
          )}

          <DiagnosticTimeline
            timeline={payload?.timeline || []}
            stepKeyLabels={stepKeyLabels}
            fieldLabels={fieldLabels}
            variant={variant}
            title="Diagnostic Timeline"
            defaultExpanded={readOnly}
          />

          <Wizard
            steps={steps}
            context={wizardContext}
            readOnly={readOnly}
            variant={variant}
            resetKey={`${payload?.templateId || 'wizard'}:${wizardJumpNonce}`}
            initialStepId={wizardInitialStepId}
            initialVisitedStepIds={wizardInitialVisitedStepIds}
            onAutoSave={handleWizardAutoSave}
            onStepChange={handleWizardStepChange}
            onComplete={onSave ? () => void handleWizardComplete() : undefined}
            completeLabel={isDiyAudience ? 'Save my notes' : 'Save Diagnostic Results'}
            isCompleting={isSaving}
            footerExtra={wizardFooterExtra}
            headerTitle={
              readOnly
                ? undefined
                : `${template.label} — ${GUIDED_DIAGNOSTICS_LABEL}`
            }
            headerDescription={
              readOnly
                ? undefined
                : 'Complete each step, generate service notes on Review, then save.'
            }
          />
        </>
      )}
    </div>
  );
}
