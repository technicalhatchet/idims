import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FaBurn,
  FaCheckCircle,
  FaClock,
  FaConciergeBell,
  FaFire,
  FaPlus,
  FaSnowflake,
  FaTint,
  FaWind,
  FaWrench,
} from 'react-icons/fa';
import SolomonPageHeader from '../../../components/solomon/SolomonPageHeader';
import SolomonPageAtmosphere from '../../../components/solomon/SolomonPageAtmosphere';
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
} from '../../../components/solomon/solomonDiagnosticStatus';
import { getWizardDefinition, resolveWizardSteps } from '../../../components/diagnostics';
import { DIAGNOSTIC_REVIEW_STEP_ID } from '../../../components/diagnostics/shared/createWizardDefinitionFromTemplate';
import { getDiagnosticTemplate } from '../../../constants/diagnosticTemplates';

const PAGE_SHELL_CLASS = '!bg-[#070b14] relative overflow-hidden !px-4 max-w-lg';

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

const FILTER_ACTIVE_CLASS =
  'bg-cyan-500/10 backdrop-blur-sm border-cyan-400/50 text-cyan-50 shadow-[0_0_16px_rgba(34,211,238,0.16)]';
const FILTER_IDLE_CLASS =
  'bg-[#060a12]/60 backdrop-blur-sm border-white/10 text-white/40 hover:border-white/18 hover:text-white/60';

const ICON_BORDER_BY_LIFECYCLE = {
  [SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress]: 'border-cyan-500/25',
  [SOLOMON_DIAGNOSTIC_STATUS.repair_outcome_pending]: 'border-orange-500/25',
  [SOLOMON_DIAGNOSTIC_STATUS.repair_successful]: 'border-emerald-500/25',
  [SOLOMON_DIAGNOSTIC_STATUS.repair_memory]: 'border-purple-500/30',
  [SOLOMON_DIAGNOSTIC_STATUS.abandoned]: 'border-white/12',
  [SOLOMON_DIAGNOSTIC_STATUS.pending_sync]: 'border-sky-500/25',
};

const BADGE_GLOW_BY_LIFECYCLE = {
  [SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress]: 'shadow-[0_0_12px_rgba(34,211,238,0.22)]',
  [SOLOMON_DIAGNOSTIC_STATUS.repair_outcome_pending]: 'shadow-[0_0_12px_rgba(251,146,60,0.22)]',
  [SOLOMON_DIAGNOSTIC_STATUS.repair_successful]: 'shadow-[0_0_12px_rgba(52,211,153,0.2)]',
  [SOLOMON_DIAGNOSTIC_STATUS.repair_memory]: 'shadow-[0_0_14px_rgba(168,85,247,0.28)]',
  [SOLOMON_DIAGNOSTIC_STATUS.abandoned]: '',
  [SOLOMON_DIAGNOSTIC_STATUS.pending_sync]: 'shadow-[0_0_12px_rgba(56,189,248,0.2)]',
};

function getTemplateIcon(templateId) {
  return TEMPLATE_ICON_MAP[templateId] || FaWrench;
}

/** List card shell — reuses lifecycle surface tokens from resolveSolomonDiagnosticStatus(). */
function diagnosticListSurfaceClass(status) {
  const isMemory = status.lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.repair_memory;
  return [
    'relative block rounded-xl border-t-2 overflow-hidden backdrop-blur-md transition-all duration-200 hover:brightness-[1.04]',
    status.surfaceDefaultClass,
    status.topAccentClass,
    status.cardGlowClass,
    status.hoverBorderClass,
    isMemory
      ? 'ring-1 ring-purple-400/25 shadow-[0_-12px_36px_rgba(168,85,247,0.18)] after:pointer-events-none after:absolute after:inset-x-4 after:top-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-purple-400/35 after:to-transparent'
      : '',
  ].filter(Boolean).join(' ');
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
  const lifecycleKey = status.lifecycleKey || status.key;
  const showSpinner = lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress
    || lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.repair_outcome_pending
    || status.key === SOLOMON_DIAGNOSTIC_STATUS.pending_sync;
  const showCheck = lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.repair_successful
    || lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.repair_memory;
  const glow = BADGE_GLOW_BY_LIFECYCLE[lifecycleKey] || '';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] backdrop-blur-sm ${status.badgeClass} ${glow}`}
    >
      {showSpinner ? (
        <span className="h-2.5 w-2.5 rounded-full border border-current border-t-transparent animate-spin" aria-hidden />
      ) : null}
      {showCheck ? <FaCheckCircle size={10} aria-hidden /> : null}
      {status.label}
    </span>
  );
}

function StepProgressBar({ stepNumber, totalSteps, progressActiveClass, labelTextClass }) {
  if (!totalSteps) return null;
  return (
    <div className="mt-3">
      <p className={`text-[10px] uppercase tracking-[0.08em] font-medium mb-1.5 ${labelTextClass}`}>
        Step {stepNumber} of {totalSteps}
      </p>
      <div className="flex gap-[3px]">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div
            key={index}
            className={`h-[3px] flex-1 rounded-full ${
              index < stepNumber
                ? progressActiveClass
                : 'bg-white/25 ring-1 ring-inset ring-white/15'
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
  const iconBorder = ICON_BORDER_BY_LIFECYCLE[status.lifecycleKey]
    || ICON_BORDER_BY_LIFECYCLE[SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress];
  const stepProgress = getDiagnosticStepProgress(item);
  const showStepProgress = status.lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress && stepProgress;
  const isCompletedState = status.lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.repair_successful
    || status.lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.repair_memory;

  return (
    <Link
      href={`/solomon/diagnostics/${item.id}`}
      className={diagnosticListSurfaceClass(status)}
    >
      <div className="p-4">
        <div className="flex gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-[#060a12]/75 backdrop-blur-sm ${iconBorder} ${status.labelTextClass}`}
          >
            <Icon size={17} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-base leading-tight text-white truncate">{label}</p>
              {!isCompletedState ? <StatusBadge status={status} /> : null}
            </div>
            {equipment ? (
              <p className="text-[11px] text-gray-400 mt-1 truncate">{equipment}</p>
            ) : null}
            {item.customer_complaint ? (
              <p className="text-xs text-gray-400/95 mt-2 line-clamp-2 leading-snug">{item.customer_complaint}</p>
            ) : null}
            {showStepProgress ? (
              <StepProgressBar
                stepNumber={stepProgress.stepNumber}
                totalSteps={stepProgress.totalSteps}
                progressActiveClass={status.progressActiveClass}
                labelTextClass={status.labelTextClass}
              />
            ) : null}
            <div className={`flex items-end justify-between gap-2 ${showStepProgress ? 'mt-3' : 'mt-2.5'}`}>
              {when ? (
                <p className="flex items-center gap-1 text-[10px] text-gray-500">
                  <FaClock size={9} className="shrink-0 opacity-75" aria-hidden />
                  {when}
                </p>
              ) : (
                <span />
              )}
              {isCompletedState ? <StatusBadge status={status} /> : null}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function NewDiagnosticButton({ href, ariaLabel }) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0089B9] to-[#006a94] border border-cyan-400/35 shadow-[0_4px_18px_rgba(0,137,185,0.4)] transition-colors hover:from-[#0099cc] hover:to-[#007aa8]"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white">
        <FaPlus size={11} aria-hidden />
      </span>
    </Link>
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
        <SolomonPageMain className={`flex flex-col ${PAGE_SHELL_CLASS}`}>
          <SolomonPageAtmosphere />
          <div className="relative">
            <SolomonPageHeader />
            <div className="flex justify-center py-16">
              <LoadingSpinner />
            </div>
          </div>
        </SolomonPageMain>
      </>
    );
  }

  return (
    <SolomonErrorBoundary>
      <SolomonHead title={pageTitle} />
      <SolomonPageMain className={PAGE_SHELL_CLASS}>
        <SolomonPageAtmosphere />
        <SolomonAccessGuard promptTitle="Sign in to view your diagnostics">
          <div className="relative">
            <SolomonPageHeader />

            <header className="mb-6">
              <h1 className="text-[1.75rem] font-bold tracking-tight text-white leading-tight">
                {pageTitle}
              </h1>
              <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                {isDiyer ? 'Your troubleshooting history and progress.' : 'Your diagnostic history and progress.'}
              </p>
            </header>

            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'unlinked', label: 'Unlinked' },
                  { id: 'linked', label: 'Linked' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilter(tab.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                      filter === tab.id ? FILTER_ACTIVE_CLASS : FILTER_IDLE_CLASS
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <NewDiagnosticButton href={newHref} ariaLabel={copy('diagnosticNew')} />
            </div>

            {error ? <ErrorAlert message={error} /> : null}
            {fromCache ? (
              <p className="text-xs text-amber-300/80 mb-3">Showing saved diagnostics from your device.</p>
            ) : null}
            {isLoading ? (
              <div className="flex justify-center py-14">
                <LoadingSpinner />
              </div>
            ) : items.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-12">
                {isDiyer ? 'No troubleshooting sessions yet.' : 'No diagnostics yet.'}
              </p>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <DiagnosticRow key={item.id} item={item} />
                ))}
              </div>
            )}

            <p className="mt-10 text-center text-xs text-white/38 leading-relaxed">
              Can&apos;t find what you&apos;re looking for?{' '}
              <Link href="/solomon/knowledge" className="text-cyan-400/90 hover:text-cyan-300 transition-colors">
                Search repair memory →
              </Link>
            </p>
          </div>
        </SolomonAccessGuard>
      </SolomonPageMain>
    </SolomonErrorBoundary>
  );
}
