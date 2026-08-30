import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  FaCheckCircle,
  FaClipboardCheck,
  FaConciergeBell,
  FaFire,
  FaPlus,
  FaSnowflake,
  FaTint,
  FaWind,
} from 'react-icons/fa';
import SolomonPageHeader from '../../../components/solomon/SolomonPageHeader';
import { useSolomonAuth } from '../../../hooks/useSolomonAuth';
import { solomonCopy } from '../../../utils/solomonDiyCopy';
import SolomonAccessGuard from '../../../components/solomon/SolomonAccessGuard';
import SolomonHead from '../../../components/solomon/SolomonHead';
import SolomonPageMain from '../../../components/solomon/SolomonPageMain';
import SolomonErrorBoundary from '../../../components/solomon/SolomonErrorBoundary';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import { listDmaRepairRecords } from '../../../services/api/dmaApi';
import { DMA_APPLIANCE_SUBTYPES } from '../../../constants/dmaEquipmentOptions';
import {
  SOLOMON_DIAGNOSTIC_STATUS,
  resolveSolomonOutcomeStatus,
  solomonDiagnosticListCardClass,
} from '../../../components/solomon/solomonDiagnosticStatus';

const SUBTYPE_ICON_MAP = {
  refrigerator: FaSnowflake,
  freezer: FaSnowflake,
  dishwasher: FaConciergeBell,
  washing_machine: FaTint,
  dryer: FaFire,
  aio_laundry: FaWind,
};

const ICON_SHELL_BY_LIFECYCLE = {
  [SOLOMON_DIAGNOSTIC_STATUS.repair_outcome_pending]: 'bg-orange-500/12 border-orange-500/25 text-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.12)]',
  [SOLOMON_DIAGNOSTIC_STATUS.repair_successful]: 'bg-emerald-500/12 border-emerald-500/25 text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.12)]',
  [SOLOMON_DIAGNOSTIC_STATUS.repair_memory]: 'bg-purple-500/12 border-purple-500/25 text-purple-400 shadow-[0_0_12px_rgba(192,132,252,0.14)]',
};

function getSubtypeIcon(subtype) {
  return SUBTYPE_ICON_MAP[subtype] || FaClipboardCheck;
}

function formatEquipmentLine(item) {
  const subtypeLabel = DMA_APPLIANCE_SUBTYPES.find((o) => o.value === item.equipment_subtype)?.label
    || item.equipment_subtype?.replace(/_/g, ' ');
  return [item.equipment_make, item.equipment_model, subtypeLabel].filter(Boolean).join(' • ');
}

function StatusBadge({ status }) {
  const showCheck = status.lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.repair_successful
    || status.lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.repair_memory;

  return (
    <span className={`inline-flex items-center gap-1 ${status.badgeClass} text-[9px] uppercase tracking-[0.08em] px-2 py-0.5 rounded-full shrink-0`}>
      {showCheck ? <FaCheckCircle size={10} aria-hidden /> : null}
      {status.label}
    </span>
  );
}

function OutcomeRow({ item, isDiyer }) {
  const status = resolveSolomonOutcomeStatus(item);
  const Icon = getSubtypeIcon(item.equipment_subtype);
  const iconShell = ICON_SHELL_BY_LIFECYCLE[status.lifecycleKey]
    || ICON_SHELL_BY_LIFECYCLE[SOLOMON_DIAGNOSTIC_STATUS.repair_successful];
  const equipment = formatEquipmentLine(item);
  const when = item.updated_at ? format(new Date(item.updated_at), 'MMM d, h:mm a') : null;
  const meta = isDiyer
    ? 'Troubleshooting session(s)'
    : `${item.linked_diagnostic_count || 0} diagnostic(s)`;

  return (
    <Link
      href={`/solomon/outcomes/${item.id}`}
      className={`block ${solomonDiagnosticListCardClass(status)} backdrop-blur-md transition-all duration-200 hover:brightness-[1.03]`}
    >
      <div className="p-3.5">
        <div className="flex gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${iconShell}`}>
            <Icon size={16} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-[15px] leading-tight text-white line-clamp-2 min-w-0">
                {item.confirmed_fix || 'Repair outcome'}
              </p>
              <StatusBadge status={status} />
            </div>
            {equipment ? (
              <p className="text-[11px] text-white/45 mt-0.5 truncate">{equipment}</p>
            ) : null}
            <p className="text-xs text-white/55 mt-1.5">{meta}</p>
            {when ? (
              <p className="text-[10px] text-white/35 mt-2">{when}</p>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}

function OutcomesAtmosphere() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -top-20 -left-16 h-52 w-52 rounded-full bg-cyan-500/[0.07] blur-3xl" />
      <div className="absolute top-1/4 -right-20 h-44 w-44 rounded-full bg-purple-500/[0.06] blur-3xl" />
      <div className="absolute bottom-32 left-8 h-36 w-36 rounded-full bg-orange-500/[0.05] blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#070b14]/20 via-transparent to-[#070b14]/60" />
    </div>
  );
}

function AddOutcomeButton({ href, ariaLabel }) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-orange-400/35 bg-gradient-to-r from-orange-500/90 to-orange-600/85 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_0_14px_rgba(251,146,60,0.22)] transition-colors hover:from-orange-400 hover:to-orange-500"
    >
      <FaPlus size={10} aria-hidden />
      Add
    </Link>
  );
}

export default function SolomonOutcomesListPage() {
  const { canUseSolomon, isLoading: authLoading, isDiyer, rolesLoading } = useSolomonAuth();
  const copy = (key) => solomonCopy(isDiyer, key);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const pageTitle = copy('outcomesTitle');

  useEffect(() => {
    if (!canUseSolomon) return undefined;
    let cancelled = false;
    setIsLoading(true);
    listDmaRepairRecords({ limit: 50 })
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load outcomes');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [canUseSolomon]);

  const items = data?.items || [];

  if (authLoading || rolesLoading) {
    return (
      <>
        <SolomonHead title={pageTitle} />
        <SolomonPageMain className="flex justify-center !bg-[#070b14] py-20">
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
        <OutcomesAtmosphere />
        <SolomonAccessGuard promptTitle="Sign in to view your repair notes">
          <div className="relative">
            <SolomonPageHeader />

            <div className="flex items-center justify-between gap-3">
              <h1 className="text-[1.65rem] font-semibold tracking-tight text-white min-w-0 truncate">
                {pageTitle}
              </h1>
              <AddOutcomeButton href="/solomon/outcomes/new" ariaLabel={copy('outcomeNew')} />
            </div>
            <p className="text-sm text-white/50 mt-1 mb-4">
              {isDiyer
                ? 'Notes from your troubleshooting sessions.'
                : 'Your recorded repair outcomes and linked diagnostics.'}
            </p>

            {error ? <ErrorAlert message={error} /> : null}
            {isLoading ? (
              <div className="flex justify-center py-12"><LoadingSpinner /></div>
            ) : items.length === 0 ? (
              <p className="text-white/45 text-sm text-center py-10">
                {isDiyer ? 'No repair notes yet.' : 'No outcomes yet.'}
              </p>
            ) : (
              <div className="space-y-2.5">
                {items.map((item) => (
                  <OutcomeRow key={item.id} item={item} isDiyer={isDiyer} />
                ))}
              </div>
            )}
          </div>
        </SolomonAccessGuard>
      </SolomonPageMain>
    </SolomonErrorBoundary>
  );
}
