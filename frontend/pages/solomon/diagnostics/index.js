import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FaBurn,
  FaClock,
  FaConciergeBell,
  FaFire,
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
import {
  SOLOMON_FILTER_ACTIVE_CLASS,
  SOLOMON_FILTER_IDLE_CLASS,
  SOLOMON_ICON_SHELL_BY_LIFECYCLE,
  SOLOMON_LIST_CARD_PADDING_CLASS,
  SOLOMON_LIST_ICON_BOX_CLASS,
  SOLOMON_LIST_STACK_CLASS,
  SOLOMON_PAGE_SHELL_CLASS,
  SolomonCyanAddButton,
  SolomonLifecycleStatusBadge,
  isSolomonRepairMemoryLifecycle,
  solomonLifecycleListSurfaceClass,
} from '../../../components/solomon/solomonListPageUi';
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

/** Home-menu tile glass + lifecycle accent — diagnostics list only. */
const CYAN_STEP_PROGRESS_ACTIVE = 'bg-cyan-400 shadow-[0_0_3px_rgba(34,211,238,0.45)]';

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

/** Segmented progress — matches Solomon Current Session card language. */
function StepProgressBar({ stepNumber, totalSteps }) {
  if (!totalSteps) return null;
  return (
    <div className="mt-2.5">
      <p className="text-[10px] uppercase tracking-[0.08em] font-medium text-cyan-400/85 mb-1">
        Step {stepNumber} of {totalSteps}
      </p>
      <div className="flex gap-[2px]">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div
            key={index}
            className={`h-1 flex-1 rounded-full ${
              index < stepNumber
                ? CYAN_STEP_PROGRESS_ACTIVE
                : 'bg-white/55 ring-1 ring-inset ring-white/20'
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
  const iconShell = SOLOMON_ICON_SHELL_BY_LIFECYCLE[status.lifecycleKey]
    || SOLOMON_ICON_SHELL_BY_LIFECYCLE[SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress];
  const stepProgress = getDiagnosticStepProgress(item);
  const showStepProgress = status.lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress && stepProgress;
  const isRepairMemory = isSolomonRepairMemoryLifecycle(status);

  return (
    <Link
      href={`/solomon/diagnostics/${item.id}`}
      className={solomonLifecycleListSurfaceClass(status)}
    >
      <div className={SOLOMON_LIST_CARD_PADDING_CLASS}>
        <div className="flex gap-3">
          <div className={`${SOLOMON_LIST_ICON_BOX_CLASS} ${iconShell}`}>
            <Icon size={16} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-[15px] leading-tight text-white truncate">{label}</p>
              {!isRepairMemory ? <SolomonLifecycleStatusBadge status={status} /> : null}
            </div>
            {equipment ? (
              <p className="text-[11px] text-gray-400 mt-0.5 truncate">{equipment}</p>
            ) : null}
            {item.customer_complaint ? (
              <p className="text-xs text-gray-400/95 mt-1.5 line-clamp-2 leading-snug">{item.customer_complaint}</p>
            ) : null}
            {showStepProgress ? (
              <StepProgressBar
                stepNumber={stepProgress.stepNumber}
                totalSteps={stepProgress.totalSteps}
              />
            ) : null}
            {isRepairMemory ? (
              <div className="flex items-end justify-between gap-2 mt-2">
                {when ? (
                  <p className="flex items-center gap-1 text-[10px] text-gray-500">
                    <FaClock size={9} className="shrink-0 opacity-75" aria-hidden />
                    {when}
                  </p>
                ) : (
                  <span />
                )}
                <SolomonLifecycleStatusBadge status={status} />
              </div>
            ) : when ? (
              <p className="flex items-center gap-1 text-[10px] text-gray-500 mt-2">
                <FaClock size={9} className="shrink-0 opacity-75" aria-hidden />
                {when}
              </p>
            ) : null}
          </div>
        </div>
      </div>
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
        <SolomonPageMain className={`flex flex-col ${SOLOMON_PAGE_SHELL_CLASS}`}>
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
      <SolomonPageMain className={SOLOMON_PAGE_SHELL_CLASS}>
        <SolomonPageAtmosphere />
        <SolomonAccessGuard promptTitle="Sign in to view your diagnostics">
          <div className="relative">
            <SolomonPageHeader />

            <header className="mb-5">
              <h1 className="text-[1.75rem] font-bold tracking-tight text-white leading-tight">
                {pageTitle}
              </h1>
              <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">
                {isDiyer ? 'Your troubleshooting history and progress.' : 'Your diagnostic history and progress.'}
              </p>
            </header>

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
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                      filter === tab.id ? SOLOMON_FILTER_ACTIVE_CLASS : SOLOMON_FILTER_IDLE_CLASS
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <SolomonCyanAddButton href={newHref} ariaLabel={copy('diagnosticNew')} />
            </div>

            {error ? <ErrorAlert message={error} /> : null}
            {fromCache ? (
              <p className="text-xs text-amber-300/80 mb-3">Showing saved diagnostics from your device.</p>
            ) : null}
            {isLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : items.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-10">
                {isDiyer ? 'No troubleshooting sessions yet.' : 'No diagnostics yet.'}
              </p>
            ) : (
              <div className={SOLOMON_LIST_STACK_CLASS}>
                {items.map((item) => (
                  <DiagnosticRow key={item.id} item={item} />
                ))}
              </div>
            )}

            <p className="mt-8 text-center text-xs text-white/38 leading-relaxed">
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
