import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FaBurn,
  FaCheckCircle,
  FaConciergeBell,
  FaFire,
  FaPlus,
  FaSnowflake,
  FaTint,
  FaWind,
  FaWrench,
} from 'react-icons/fa';
import SolomonPageHeader from '../../../components/solomon/SolomonPageHeader';
import SolomonHead from '../../../components/solomon/SolomonHead';
import SolomonPageMain from '../../../components/solomon/SolomonPageMain';
import SolomonErrorBoundary from '../../../components/solomon/SolomonErrorBoundary';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import { useSolomonAuth } from '../../../hooks/useSolomonAuth';
import { formatSolomonDateTime } from '../../../utils/solomonFormat';
import { SYNC_EVENT } from '../../../lib/offlineMutations';
import { solomonCopy } from '../../../utils/solomonDiyCopy';
import { listStandaloneDiagnosticsOffline } from '../../../lib/solomonOfflineWrites';
import SolomonAccessGuard from '../../../components/solomon/SolomonAccessGuard';
import {
  SOLOMON_DIAGNOSTIC_STATUS,
  resolveSolomonDiagnosticStatus,
  solomonDiagnosticListCardClass,
} from '../../../components/solomon/solomonDiagnosticStatus';
import { getWizardDefinition, resolveWizardSteps } from '../../../components/diagnostics';
import { DIAGNOSTIC_REVIEW_STEP_ID } from '../../../components/diagnostics/shared/createWizardDefinitionFromTemplate';
import { getDiagnosticTemplate } from '../../../constants/diagnosticTemplates';

const TEMPLATE_ICON_MAP = {
  refrigerator: FaSnowflake,
  standalone_freezer: FaSnowflake,
  dishwasher: FaConciergeBell,
  washer: FaTint,
  electric_dryer: FaFire,
  gas_dryer: FaBurn,
  stacked_laundry: FaWind,
  aio_laundry: FaWind,
};

const ICON_SHELL_BY_LIFECYCLE = {
  [SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress]: 'bg-cyan-500/12 border-cyan-500/25 text-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.12)]',
  [SOLOMON_DIAGNOSTIC_STATUS.repair_outcome_pending]: 'bg-orange-500/12 border-orange-500/25 text-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.12)]',
  [SOLOMON_DIAGNOSTIC_STATUS.repair_successful]: 'bg-emerald-500/12 border-emerald-500/25 text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.12)]',
  [SOLOMON_DIAGNOSTIC_STATUS.repair_memory]: 'bg-purple-500/12 border-purple-500/25 text-purple-400 shadow-[0_0_12px_rgba(192,132,252,0.14)]',
  [SOLOMON_DIAGNOSTIC_STATUS.abandoned]: 'bg-white/5 border-white/15 text-gray-400',
  [SOLOMON_DIAGNOSTIC_STATUS.pending_sync]: 'bg-sky-500/12 border-sky-500/25 text-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.12)]',
};

function getTemplateIcon(templateId) {
  return TEMPLATE_ICON_MAP[templateId] || FaWrench;
}

function getDiagnosticStepProgress(item) {
  const payload = item?.payload || {};
  const templateId = payload.templateId || item.template_id;
  if (!templateId) return null;

  const wizardDefinition = getWizardDefinition(templateId);
  const template = getDiagnosticTemplate(templateId);
  const wizardSteps = resolveWizardSteps(wizardDefinition, template);
  const reviewStepKey = wizardDefinition?.routing?.reviewStepKey || 'review';
  const diagnosticSteps = wizardSteps.filter(
    (step) => step.id !== DIAGNOSTIC_REVIEW_STEP_ID && step.meta?.stepKey !== reviewStepKey,
  );
  const totalSteps = diagnosticSteps.length;
  if (!totalSteps) return null;

  const visitedStepKeys = payload.visitedStepKeys || [];
  const currentIndex = payload.currentStepKey
    ? diagnosticSteps.findIndex((step) => step.meta?.stepKey === payload.currentStepKey)
    : -1;
  const stepNumber = currentIndex >= 0
    ? currentIndex + 1
    : Math.min(
      visitedStepKeys.filter((key) => diagnosticSteps.some((step) => step.meta?.stepKey === key)).length + 1,
      totalSteps,
    );

  return { stepNumber, totalSteps };
}

function StatusBadge({ status }) {
  const showSpinner = status.lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress
    || status.key === SOLOMON_DIAGNOSTIC_STATUS.pending_sync;
  const showCheck = status.lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.repair_successful
    || status.lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.repair_memory;

  return (
    <span className={`inline-flex items-center gap-1 ${status.badgeClass} text-[9px] uppercase tracking-[0.08em] px-2 py-0.5 rounded-full shrink-0`}>
      {showSpinner ? (
        <span className="h-2.5 w-2.5 rounded-full border border-current border-t-transparent animate-spin" aria-hidden />
      ) : null}
      {showCheck ? <FaCheckCircle size={10} aria-hidden /> : null}
      {status.label}
    </span>
  );
}

function StepProgressBar({ stepNumber, totalSteps, progressActiveClass }) {
  if (!totalSteps) return null;
  return (
    <div className="mt-2.5">
      <p className="text-[10px] text-white/45 mb-1">
        Step {stepNumber} of {totalSteps}
      </p>
      <div className="flex gap-0.5">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div
            key={index}
            className={`h-[3px] flex-1 rounded-full ${
              index < stepNumber
                ? progressActiveClass
                : 'bg-white/20 ring-1 ring-inset ring-white/10'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function DiagnosticRow({ item }) {
  if (!item?.id) return null;
  const label = item.template_label || item.template_id || 'Diagnostic';
  const equipment = [item.equipment_make, item.equipment_model].filter(Boolean).join(' • ');
  const when = formatSolomonDateTime(item.updated_at);
  const status = resolveSolomonDiagnosticStatus(item);
  const Icon = getTemplateIcon(item.template_id || item.payload?.templateId);
  const iconShell = ICON_SHELL_BY_LIFECYCLE[status.lifecycleKey] || ICON_SHELL_BY_LIFECYCLE[SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress];
  const stepProgress = getDiagnosticStepProgress(item);
  const showStepProgress = status.lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress && stepProgress;

  return (
    <Link
      href={`/solomon/diagnostics/${item.id}`}
      className={`block ${solomonDiagnosticListCardClass(status)} backdrop-blur-md transition-all duration-200 hover:brightness-[1.03]`}
    >
      <div className="p-3.5">
        <div className="flex gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${iconShell}`}>
            <Icon size={16} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-[15px] leading-tight text-white truncate">{label}</p>
              <StatusBadge status={status} />
            </div>
            {equipment ? (
              <p className="text-[11px] text-white/45 mt-0.5 truncate">{equipment}</p>
            ) : null}
            {item.customer_complaint ? (
              <p className="text-xs text-white/55 mt-1.5 line-clamp-2 leading-snug">{item.customer_complaint}</p>
            ) : null}
            {showStepProgress ? (
              <StepProgressBar
                stepNumber={stepProgress.stepNumber}
                totalSteps={stepProgress.totalSteps}
                progressActiveClass={status.progressActiveClass}
              />
            ) : null}
            {when ? (
              <p className="text-[10px] text-white/35 mt-2">{when}</p>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}

function DiagnosticsAtmosphere() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -top-20 -left-16 h-52 w-52 rounded-full bg-cyan-500/[0.07] blur-3xl" />
      <div className="absolute top-1/4 -right-20 h-44 w-44 rounded-full bg-purple-500/[0.06] blur-3xl" />
      <div className="absolute bottom-32 left-8 h-36 w-36 rounded-full bg-orange-500/[0.05] blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#070b14]/20 via-transparent to-[#070b14]/60" />
    </div>
  );
}

export default function SolomonDiagnosticsListPage() {
  const { canUseSolomon, isLoading: authLoading, isDiyer, rolesLoading } = useSolomonAuth();
  const copy = (key) => solomonCopy(isDiyer, key);
  const [filter, setFilter] = useState('all');
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const pageTitle = isDiyer ? copy('diagnosticsTitle') : 'My Diagnostics';

  const newHref = isDiyer ? '/solomon/start' : '/solomon/diagnose';

  useEffect(() => {
    const onSync = () => setReloadKey((k) => k + 1);
    window.addEventListener(SYNC_EVENT, onSync);
    return () => window.removeEventListener(SYNC_EVENT, onSync);
  }, []);

  useEffect(() => {
    if (!canUseSolomon) return undefined;
    let cancelled = false;
    setIsLoading(true);
    const params = { limit: 50 };
    if (filter === 'unlinked') params.linked = false;
    if (filter === 'linked') params.linked = true;

    listStandaloneDiagnosticsOffline(params)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setFromCache(Boolean(res.fromCache));
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load diagnostics');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canUseSolomon, filter, reloadKey]);

  const items = data?.items || [];

  if (authLoading || rolesLoading) {
    return (
      <>
        <SolomonHead title="Diagnostics" />
        <SolomonPageMain className="flex justify-center !bg-[#070b14]">
          <SolomonPageHeader />
          <LoadingSpinner />
        </SolomonPageMain>
      </>
    );
  }

  return (
    <SolomonErrorBoundary>
      <SolomonHead title={pageTitle} />
      <SolomonPageMain className="!bg-[#070b14] relative overflow-hidden">
        <DiagnosticsAtmosphere />
        <SolomonAccessGuard promptTitle="Sign in to view your diagnostics">
          <div className="relative">
            <SolomonPageHeader />

            <h1 className="text-[1.65rem] font-semibold tracking-tight text-white">{pageTitle}</h1>
            <p className="text-sm text-white/50 mt-1 mb-4">
              {isDiyer ? 'Your troubleshooting history and progress.' : 'Your diagnostic history and progress.'}
            </p>

            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'unlinked', label: 'Unlinked' },
                  { id: 'linked', label: 'Linked' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      filter === tab.id
                        ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.12)]'
                        : 'border-white/10 text-white/45 hover:border-white/20 hover:text-white/65'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <Link
                href={newHref}
                aria-label={copy('diagnosticNew')}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#0089B9] to-[#006a94] text-white shadow-[0_4px_16px_rgba(0,137,185,0.35)] hover:from-[#0099cc] hover:to-[#007aa8] transition-colors"
              >
                <FaPlus size={14} />
              </Link>
            </div>

            {error ? <ErrorAlert message={error} /> : null}
            {fromCache ? (
              <p className="text-xs text-amber-300/80 mb-3">Showing saved diagnostics from your device.</p>
            ) : null}
            {isLoading ? (
              <div className="flex justify-center py-12"><LoadingSpinner /></div>
            ) : items.length === 0 ? (
              <p className="text-white/45 text-sm text-center py-10">
                {isDiyer ? 'No troubleshooting sessions yet.' : 'No diagnostics yet.'}
              </p>
            ) : (
              <div className="space-y-2.5">
                {items.map((item) => (
                  <DiagnosticRow key={item.id} item={item} />
                ))}
              </div>
            )}

            <p className="mt-8 text-center text-xs text-white/40">
              Can&apos;t find what you&apos;re looking for?{' '}
              <Link href="/solomon/knowledge" className="text-cyan-400/90 hover:text-cyan-300">
                Search repair memory →
              </Link>
            </p>
          </div>
        </SolomonAccessGuard>
      </SolomonPageMain>
    </SolomonErrorBoundary>
  );
}
