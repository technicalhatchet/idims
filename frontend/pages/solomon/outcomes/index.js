import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  FaClipboardCheck,
  FaClock,
  FaConciergeBell,
  FaFire,
  FaSnowflake,
  FaTint,
  FaWind,
} from 'react-icons/fa';
import SolomonPageHeader from '../../../components/solomon/SolomonPageHeader';
import SolomonPageAtmosphere from '../../../components/solomon/SolomonPageAtmosphere';
import {
  SOLOMON_DIAGNOSTIC_STATUS,
  resolveSolomonOutcomeStatus,
} from '../../../components/solomon/solomonDiagnosticStatus';
import {
  SOLOMON_ICON_SHELL_BY_LIFECYCLE,
  SOLOMON_LIST_CARD_PADDING_CLASS,
  SOLOMON_LIST_ICON_BOX_CLASS,
  SOLOMON_LIST_STACK_CLASS,
  SOLOMON_PAGE_SHELL_CLASS,
  SolomonLifecycleStatusBadge,
  SolomonOrangeAddButton,
  solomonLifecycleListSurfaceClass,
} from '../../../components/solomon/solomonListPageUi';
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

const SUBTYPE_ICON_MAP = {
  refrigerator: FaSnowflake,
  freezer: FaSnowflake,
  dishwasher: FaConciergeBell,
  washing_machine: FaTint,
  dryer: FaFire,
  aio_laundry: FaWind,
};

function getSubtypeIcon(subtype) {
  return SUBTYPE_ICON_MAP[subtype] || FaClipboardCheck;
}

function formatEquipmentLine(item) {
  const subtypeLabel = DMA_APPLIANCE_SUBTYPES.find((o) => o.value === item.equipment_subtype)?.label
    || item.equipment_subtype?.replace(/_/g, ' ');
  return [item.equipment_make, item.equipment_model, subtypeLabel].filter(Boolean).join(' • ');
}

function OutcomeRow({ item, isDiyer }) {
  const status = resolveSolomonOutcomeStatus(item);
  const Icon = getSubtypeIcon(item.equipment_subtype);
  const iconShell = SOLOMON_ICON_SHELL_BY_LIFECYCLE[status.lifecycleKey]
    || SOLOMON_ICON_SHELL_BY_LIFECYCLE[SOLOMON_DIAGNOSTIC_STATUS.repair_successful];
  const equipment = formatEquipmentLine(item);
  const when = item.updated_at ? format(new Date(item.updated_at), 'MMM d, h:mm a') : null;
  const meta = isDiyer
    ? 'Troubleshooting session(s)'
    : `${item.linked_diagnostic_count || 0} diagnostic(s)`;

  return (
    <Link
      href={`/solomon/outcomes/${item.id}`}
      className={solomonLifecycleListSurfaceClass(status)}
    >
      <div className={SOLOMON_LIST_CARD_PADDING_CLASS}>
        <div className="flex gap-3">
          <div className={`${SOLOMON_LIST_ICON_BOX_CLASS} ${iconShell}`}>
            <Icon size={16} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-[15px] leading-tight text-white line-clamp-2 min-w-0">
                {item.confirmed_fix || 'Repair outcome'}
              </p>
              <SolomonLifecycleStatusBadge status={status} />
            </div>
            {equipment ? (
              <p className="text-[11px] text-gray-400 mt-0.5 truncate">{equipment}</p>
            ) : null}
            <p className="text-xs text-gray-400/95 mt-1.5">{meta}</p>
            {when ? (
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
        <SolomonAccessGuard promptTitle="Sign in to view your repair notes">
          <div className="relative">
            <SolomonPageHeader />

            <div className="flex items-center justify-between gap-3 mb-5">
              <header className="min-w-0 flex-1">
                <h1 className="text-[1.75rem] font-bold tracking-tight text-white leading-tight truncate">
                  {pageTitle}
                </h1>
                <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">
                  {isDiyer
                    ? 'Notes from your troubleshooting sessions.'
                    : 'Your recorded repair outcomes and linked diagnostics.'}
                </p>
              </header>
              <SolomonOrangeAddButton href="/solomon/outcomes/new" ariaLabel={copy('outcomeNew')} />
            </div>

            {error ? <ErrorAlert message={error} /> : null}
            {isLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : items.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-10">
                {isDiyer ? 'No repair notes yet.' : 'No outcomes yet.'}
              </p>
            ) : (
              <div className={SOLOMON_LIST_STACK_CLASS}>
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
