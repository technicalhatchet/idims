import { useEffect, useMemo, useState } from 'react';
import SolomonListPage from '../../../components/solomon/SolomonListPage';
import SolomonProcedurePanel from '../../../components/solomon/SolomonProcedurePanel';
import {
  SOLOMON_GLASS_PANEL_CLASS,
  SOLOMON_REFERENCE_EYEBROW_CLASS,
} from '../../../components/solomon/solomonListPageUi';
import { useSolomonAuth } from '../../../hooks/useSolomonAuth';
import {
  buildMeasurementContext,
  getPlatformLabel,
  resolvePlatformIdFromModel,
} from '../../../components/diagnostics/knowledge/platformRegistry';
import { resolveCanonicalRouting } from '../../../components/diagnostics/knowledge/canonical/resolveCanonicalRouting';
import { WASHER_COMPLAINT_CHIPS } from '../../../components/diagnostics/washer/washerComplaints';
import { ELECTRIC_DRYER_COMPLAINT_CHIPS } from '../../../components/diagnostics/electric_dryer/electricDryerComplaints';
import { GAS_DRYER_COMPLAINT_CHIPS } from '../../../components/diagnostics/gas_dryer/gasDryerComplaints';
import { getAllServiceProcedures } from '../../../components/diagnostics/procedures/procedureRegistry';
import {
  listServiceProcedureCatalog,
  recommendServiceProcedures,
} from '../../../components/diagnostics/procedures/recommendServiceProcedures';
import { parseProcedureErrorCodes } from '../../../components/diagnostics/procedures/parseProcedureErrorCodes';
import { useProcedureRun } from '../../../components/diagnostics/procedures/useProcedureRun';
import { formatOemTestLabel } from '../../../components/diagnostics/procedures/procedureDisplayLabels';
import ProcedureStepView from '../../../components/diagnostics/procedures/ui/ProcedureStepView';
import CanonicalRoutingHarnessPanel from '../../../components/diagnostics/procedures/ui/CanonicalRoutingHarnessPanel';

const PROCEDURE_OPTIONS = getAllServiceProcedures();

const SMOKE_PRESETS = [
  {
    id: 'duet_sport_door_lock',
    label: 'Duet Sport door lock (WFW8300)',
    templateId: 'washer',
    equipmentMake: 'Whirlpool',
    equipmentModel: 'WFW8300SW0',
    errorCodes: 'F22',
    complaintChipIds: ['lid_lock'],
  },
  {
    id: 'duet_sport_drain',
    label: 'Duet Sport drain (F21)',
    templateId: 'washer',
    equipmentMake: 'Whirlpool',
    equipmentModel: 'WFW85HEDW0',
    errorCodes: 'F21',
    complaintChipIds: ['wont_drain'],
  },
  {
    id: 'samsung_fl_wf45',
    label: 'Samsung FL WF45T6000 door lock',
    templateId: 'washer',
    equipmentMake: 'Samsung',
    equipmentModel: 'WF45T6000AW',
    errorCodes: 'DC',
    complaintChipIds: ['lid_lock'],
  },
  {
    id: 'fl_dd_washer',
    label: '27" FL DD washer (WFW5620)',
    templateId: 'washer',
    equipmentMake: 'Whirlpool',
    equipmentModel: 'WFW5620HW0',
    errorCodes: 'F7E2',
    complaintChipIds: ['wont_spin'],
  },
  {
    id: 'duet_sport_dryer_gas',
    label: 'Duet Sport gas dryer (WGD85…)',
    templateId: 'gas_dryer',
    equipmentMake: 'Whirlpool',
    equipmentModel: 'WGD85HEFW0',
    errorCodes: 'F-26',
    complaintChipIds: [],
  },
  {
    id: 'duet_sport_dryer',
    label: 'Duet Sport dryer (WED85…)',
    templateId: 'electric_dryer',
    equipmentMake: 'Whirlpool',
    equipmentModel: 'WED85HEFW0',
    errorCodes: 'F-22',
    complaintChipIds: [],
  },
  {
    id: 'samsung_fl_bb8700_dryer',
    label: 'Samsung FL BB8700 dryer (DVE53BB8700)',
    templateId: 'electric_dryer',
    equipmentMake: 'Samsung',
    equipmentModel: 'DVE53BB8700AW',
    errorCodes: 'tC5',
    complaintChipIds: ['no_heat'],
  },
  {
    id: 'samsung_fl_dv6000_dryer',
    label: 'Samsung FL DV6000 dryer (DVE45T6000)',
    templateId: 'electric_dryer',
    equipmentMake: 'Samsung',
    equipmentModel: 'DVE45T6000AW',
    errorCodes: '',
    complaintChipIds: ['no_heat'],
  },
  {
    id: 'samsung_tl_dv50_dryer',
    label: 'Samsung TL DV50 dryer (DVE50R5200)',
    templateId: 'electric_dryer',
    equipmentMake: 'Samsung',
    equipmentModel: 'DVE50R5200AW',
    errorCodes: 'tC5',
    complaintChipIds: ['no_heat'],
  },
];

const SMOKE_TEMPLATE_OPTIONS = [
  { id: 'washer', label: 'Washer' },
  { id: 'electric_dryer', label: 'Electric dryer' },
  { id: 'gas_dryer', label: 'Gas dryer' },
];

const TEMPLATE_INFERENCE_ORDER = ['washer', 'electric_dryer', 'gas_dryer'];

function formatOemRef(oemTestNumber) {
  return formatOemTestLabel(oemTestNumber);
}

function toggleChip(chipIds, chipId) {
  if (chipIds.includes(chipId)) {
    return chipIds.filter((id) => id !== chipId);
  }
  return [...chipIds, chipId];
}

export default function SolomonProcedureDevPage() {
  const { canUseSolomon, isStaff, rolesLoading, rolesResolved } = useSolomonAuth();
  const [selectedId, setSelectedId] = useState(PROCEDURE_OPTIONS[0]?.id || '');
  const [smokePresetId, setSmokePresetId] = useState(SMOKE_PRESETS[0].id);
  const [smokeModel, setSmokeModel] = useState(SMOKE_PRESETS[0].equipmentModel);
  const [smokeMake, setSmokeMake] = useState(SMOKE_PRESETS[0].equipmentMake);
  const [smokeTemplateId, setSmokeTemplateId] = useState(SMOKE_PRESETS[0].templateId);
  const [smokeErrorCodes, setSmokeErrorCodes] = useState(SMOKE_PRESETS[0].errorCodes);
  const [complaintChipIds, setComplaintChipIds] = useState(SMOKE_PRESETS[0].complaintChipIds || []);

  const {
    procedure,
    runState,
    currentStep,
    lastResult,
    log,
    measurementDraft,
    setMeasurementDraft,
    stepIndex,
    stepTotal,
    isRunning,
    isComplete,
    start,
    reset,
    continueStep,
    submitCheckpoint,
    submitMeasurement,
  } = useProcedureRun(selectedId);

  useEffect(() => {
    reset();
  }, [selectedId, reset]);

  useEffect(() => {
    if (!smokeMake?.trim() || !smokeModel?.trim()) return;
    const currentPlatform = resolvePlatformIdFromModel({
      templateId: smokeTemplateId,
      equipmentMake: smokeMake,
      equipmentModel: smokeModel,
    });
    if (currentPlatform) return;
    for (const templateId of TEMPLATE_INFERENCE_ORDER) {
      if (templateId === smokeTemplateId) continue;
      const platformId = resolvePlatformIdFromModel({
        templateId,
        equipmentMake: smokeMake,
        equipmentModel: smokeModel,
      });
      if (platformId) {
        setSmokeTemplateId(templateId);
        return;
      }
    }
  }, [smokeMake, smokeModel, smokeTemplateId]);

  const staffReady = rolesResolved && canUseSolomon && isStaff;

  const headerDescription = useMemo(() => {
    if (!procedure) return 'Internal OEM procedure runner harness.';
    return `${procedure.source.manualId} · ${formatOemRef(procedure.source.oemTestNumber)} · ${procedure.platformId}`;
  }, [procedure]);

  const measurementContext = useMemo(
    () => buildMeasurementContext({
      templateId: smokeTemplateId,
      equipmentMake: smokeMake,
      equipmentModel: smokeModel,
    }),
    [smokeMake, smokeModel, smokeTemplateId],
  );

  const parsedErrorCodes = useMemo(
    () => parseProcedureErrorCodes(smokeErrorCodes),
    [smokeErrorCodes],
  );

  const smokePlatformId = useMemo(
    () => resolvePlatformIdFromModel(measurementContext),
    [measurementContext],
  );

  const canonicalRouting = useMemo(
    () => resolveCanonicalRouting({
      templateId: smokeTemplateId,
      platformId: smokePlatformId,
      complaintChipIds,
      errorCodes: parsedErrorCodes,
    }),
    [smokeTemplateId, smokePlatformId, complaintChipIds, parsedErrorCodes],
  );

  const smokeRecommendations = useMemo(
    () => recommendServiceProcedures({
      templateId: smokeTemplateId,
      measurementContext,
      complaintChipIds,
      errorCodes: parsedErrorCodes,
    }),
    [smokeTemplateId, measurementContext, complaintChipIds, parsedErrorCodes],
  );

  const smokeCatalog = useMemo(
    () => listServiceProcedureCatalog({
      templateId: smokeTemplateId,
      measurementContext,
    }),
    [smokeTemplateId, measurementContext],
  );

  const complaintChips = useMemo(() => {
    if (smokeTemplateId === 'washer') return WASHER_COMPLAINT_CHIPS;
    if (smokeTemplateId === 'electric_dryer') return ELECTRIC_DRYER_COMPLAINT_CHIPS;
    if (smokeTemplateId === 'gas_dryer') return GAS_DRYER_COMPLAINT_CHIPS;
    return [];
  }, [smokeTemplateId]);

  const smokePlatformBanner = useMemo(() => {
    if (!smokePlatformId) return null;
    const canonicalDomainLabels = (canonicalRouting?.activeDomains || [])
      .map((domainId) => canonicalRouting?.domainLabels?.[domainId] || domainId);
    return {
      platformId: smokePlatformId,
      platformLabel: getPlatformLabel(smokePlatformId) || smokePlatformId,
      equipmentMake: smokeMake,
      equipmentModel: smokeModel,
      canonicalDomainLabels,
    };
  }, [smokePlatformId, smokeMake, smokeModel, canonicalRouting]);

  const applySmokePreset = (presetId) => {
    const preset = SMOKE_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setSmokePresetId(preset.id);
    setSmokeTemplateId(preset.templateId);
    setSmokeMake(preset.equipmentMake);
    setSmokeModel(preset.equipmentModel);
    setSmokeErrorCodes(preset.errorCodes);
    setComplaintChipIds(preset.complaintChipIds || []);
  };

  return (
    <SolomonListPage
      headTitle="Procedure Dev"
      title="Procedure harness"
      description={headerDescription}
      backHref="/solomon/more"
      backLabel="More"
      accessGuard
      accessGuardTitle="Sign in to use procedure dev tools"
      loading={rolesLoading}
      loadingFallback={null}
    >
      {!staffReady ? (
        <div className={SOLOMON_GLASS_PANEL_CLASS}>
          <p className="text-sm text-amber-200">Staff access required for procedure dev tools.</p>
          <p className="mt-2 text-xs text-[var(--solomon-text-secondary)]">
            Sign in with a technician, manager, or admin account to run OEM procedure seeds.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className={SOLOMON_GLASS_PANEL_CLASS}>
            <p className={SOLOMON_REFERENCE_EYEBROW_CLASS}>Recommendation smoke test</p>
            <p className="mt-1 text-xs text-[var(--solomon-text-secondary)]">
              Platform resolution, canonical routing, fault-code scoring, and catalog gating — no work order required.
            </p>

            <label className="mt-3 block text-xs text-[var(--solomon-text-secondary)]" htmlFor="smoke-preset">
              Preset
            </label>
            <select
              id="smoke-preset"
              value={smokePresetId}
              onChange={(event) => applySmokePreset(event.target.value)}
              className="mt-1 w-full rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] px-3 py-2 text-sm text-white"
            >
              {SMOKE_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </select>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs text-[var(--solomon-text-secondary)]" htmlFor="smoke-template">
                  Template
                </label>
                <select
                  id="smoke-template"
                  value={smokeTemplateId}
                  onChange={(event) => setSmokeTemplateId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] px-3 py-2 text-sm text-white"
                >
                  {SMOKE_TEMPLATE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[var(--solomon-text-secondary)]" htmlFor="smoke-make">
                  Make
                </label>
                <input
                  id="smoke-make"
                  value={smokeMake}
                  onChange={(event) => setSmokeMake(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--solomon-text-secondary)]" htmlFor="smoke-model">
                  Model
                </label>
                <input
                  id="smoke-model"
                  value={smokeModel}
                  onChange={(event) => setSmokeModel(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] px-3 py-2 text-sm text-white"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-xs text-[var(--solomon-text-secondary)]" htmlFor="smoke-error">
                Error code(s)
              </label>
              <input
                id="smoke-error"
                value={smokeErrorCodes}
                onChange={(event) => setSmokeErrorCodes(event.target.value)}
                placeholder="F21, F-22, DC, AC3"
                className="mt-1 w-full rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] px-3 py-2 text-sm text-white"
              />
            </div>

            {complaintChips.length ? (
              <div className="mt-3">
                <p className="text-xs text-[var(--solomon-text-secondary)]">Complaint chips</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {complaintChips.map((chip) => {
                    const active = complaintChipIds.includes(chip.id);
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setComplaintChipIds((prev) => toggleChip(prev, chip.id))}
                        className={[
                          'rounded-full border px-2.5 py-1 text-[11px] transition',
                          active
                            ? 'border-sky-400/50 bg-sky-500/20 text-sky-100'
                            : 'border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] text-[var(--solomon-text-secondary)]',
                        ].join(' ')}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <p className="mt-2 text-[10px] text-[var(--solomon-text-muted)]">
              Platform: {smokePlatformId || (measurementContext.equipmentModel ? 'unresolved' : 'enter model')}
              {parsedErrorCodes.length ? ` · codes: ${parsedErrorCodes.join(', ')}` : ''}
              {complaintChipIds.length ? ` · chips: ${complaintChipIds.join(', ')}` : ''}
            </p>

            <CanonicalRoutingHarnessPanel
              routing={canonicalRouting}
              platformId={smokePlatformId}
              recommendations={smokeRecommendations}
            />

            <div className="mt-3">
              <SolomonProcedurePanel
                recommendations={smokeRecommendations}
                catalog={smokeCatalog}
                platformId={smokePlatformId}
                platformBanner={smokePlatformBanner}
                variant="mobile"
                density="compact"
                catalogPlacement="inline"
              />
            </div>
          </div>

          <div className={SOLOMON_GLASS_PANEL_CLASS}>
            <p className={SOLOMON_REFERENCE_EYEBROW_CLASS}>Dev tooling</p>
            <label className="mt-2 block text-xs text-[var(--solomon-text-secondary)]" htmlFor="procedure-select">
              Procedure seed
            </label>
            <select
              id="procedure-select"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] px-3 py-2 text-sm text-white"
              disabled={isRunning}
            >
              {PROCEDURE_OPTIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} ({item.id})
                </option>
              ))}
            </select>

            <div className="mt-3 flex gap-2">
              {!isRunning && !isComplete ? (
                <button
                  type="button"
                  onClick={start}
                  disabled={!procedure}
                  className="flex-1 rounded-lg border border-[color:var(--solomon-primary-border)] bg-gradient-to-br from-[var(--solomon-primary-from)] to-[var(--solomon-primary-to)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  Start run
                </button>
              ) : (
                <button
                  type="button"
                  onClick={reset}
                  className="flex-1 rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] px-4 py-2.5 text-sm font-medium text-[var(--solomon-text-primary)]"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {isComplete && runState?.oemOutcome ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-300/90">OEM outcome</p>
              <p className="mt-1 text-sm text-emerald-100">{runState.oemOutcome}</p>
            </div>
          ) : null}

          {isRunning && currentStep ? (
            <div className={SOLOMON_GLASS_PANEL_CLASS}>
              <ProcedureStepView
                step={currentStep}
                stepIndex={stepIndex}
                stepTotal={stepTotal}
                measurementDraft={measurementDraft}
                onMeasurementDraftChange={setMeasurementDraft}
                onContinue={continueStep}
                onCheckpoint={submitCheckpoint}
                onSubmitMeasurement={submitMeasurement}
                lastEvaluation={lastResult?.evaluation}
                matchedBranch={lastResult?.matchedBranch}
              />
            </div>
          ) : null}

          {log.length > 0 ? (
            <div className={SOLOMON_GLASS_PANEL_CLASS}>
              <p className="text-sm font-semibold text-[var(--solomon-text-primary)]">Run log</p>
              <ol className="mt-3 space-y-2 text-xs text-[var(--solomon-text-secondary)]">
                {log.map((entry, index) => (
                  <li
                    key={`${entry.stepId}-${index}`}
                    className="rounded-md border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]/40 px-3 py-2"
                  >
                    <p className="font-medium text-[var(--solomon-text-primary)]">{entry.stepTitle}</p>
                    {entry.input ? (
                      <p className="mt-0.5">
                        Input: {entry.input.kind} = {entry.input.value}
                      </p>
                    ) : null}
                    {entry.evaluationStatus ? (
                      <p className="mt-0.5">Evaluation: {entry.evaluationStatus}</p>
                    ) : null}
                    {entry.branchId ? <p className="mt-0.5">Branch: {entry.branchId}</p> : null}
                    {entry.oemOutcome ? (
                      <p className="mt-0.5 text-emerald-300">{entry.oemOutcome}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      )}
    </SolomonListPage>
  );
}
