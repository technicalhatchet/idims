import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import ApplianceIcon from '../../../components/ui/ApplianceIcon';
import {
  SOLOMON_DIAGNOSTIC_STATUS,
  resolveSolomonOutcomeStatus,
} from '../../../components/solomon/solomonDiagnosticStatus';
import {
  SOLOMON_ICON_SHELL_BY_LIFECYCLE,
  SOLOMON_LIST_CARD_PADDING_CLASS,
  SOLOMON_LIST_ICON_BOX_CLASS,
  SOLOMON_LIST_STACK_CLASS,
  SolomonListCardFooter,
  SolomonListLifecycleHeadline,
  SolomonOrangeAddButton,
  solomonLifecycleListSurfaceClass,
} from '../../../components/solomon/solomonListPageUi';
import { getRepairRecordCategoryLabel } from '../../../components/solomon/solomonRepairRecordPresentation';
import { getEquipmentTypeForSubtype } from '../../../components/solomon/solomonTemplateEquipment';
import { useSolomonAuth } from '../../../hooks/useSolomonAuth';
import { solomonCopy } from '../../../utils/solomonDiyCopy';
import SolomonListPage from '../../../components/solomon/SolomonListPage';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ErrorAlert from '../../../components/ui/ErrorAlert';
import { listDmaRepairRecords } from '../../../services/api/dmaApi';
import { DMA_APPLIANCE_SUBTYPES } from '../../../constants/dmaEquipmentOptions';

function formatEquipmentLine(item) {
  const subtypeLabel = DMA_APPLIANCE_SUBTYPES.find((o) => o.value === item.equipment_subtype)?.label
    || item.equipment_subtype?.replace(/_/g, ' ');
  return [item.equipment_make, item.equipment_model, subtypeLabel].filter(Boolean).join(' • ');
}

function OutcomeRow({ item, isDiyer }) {
  const status = resolveSolomonOutcomeStatus(item);
  const equipmentType = getEquipmentTypeForSubtype(item.equipment_subtype);
  const iconShell = SOLOMON_ICON_SHELL_BY_LIFECYCLE[status.lifecycleKey]
    || SOLOMON_ICON_SHELL_BY_LIFECYCLE[SOLOMON_DIAGNOSTIC_STATUS.repair_successful];
  const equipment = formatEquipmentLine(item);
  const when = item.updated_at ? format(new Date(item.updated_at), 'MMM d, h:mm a') : null;
  const meta = isDiyer
    ? 'Troubleshooting session(s)'
    : `${item.linked_diagnostic_count || 0} diagnostic(s)`;
  const categoryLabel = getRepairRecordCategoryLabel(item);

  return (
    <Link
      href={`/solomon/outcomes/${item.id}`}
      className={solomonLifecycleListSurfaceClass(status)}
    >
      <div className={SOLOMON_LIST_CARD_PADDING_CLASS}>
        <div className="flex gap-3">
          <div className={`${SOLOMON_LIST_ICON_BOX_CLASS} ${iconShell}`}>
            <ApplianceIcon
              equipmentType={equipmentType}
              equipmentSubtype={item.equipment_subtype}
              className="w-6 h-6"
              glow="subtle"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-[15px] leading-tight text-[var(--solomon-text-primary)] line-clamp-2 min-w-0 flex-1">
                {item.confirmed_fix || 'Repair outcome'}
              </p>
              <SolomonListLifecycleHeadline status={status} categoryLabel={categoryLabel} />
            </div>
            {equipment ? (
              <p className="text-[11px] text-[var(--solomon-text-secondary)] mt-0.5 truncate">{equipment}</p>
            ) : null}
            <p className="text-xs text-[var(--solomon-text-secondary)]/95 mt-1.5">{meta}</p>
            <SolomonListCardFooter when={when} status={status} showClock />
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

  return (
    <SolomonListPage
      headTitle={pageTitle}
      title={pageTitle}
      description={
        isDiyer
          ? 'Notes from your troubleshooting sessions.'
          : 'Your recorded repair outcomes and linked diagnostics.'
      }
      toolbar={<SolomonOrangeAddButton href="/solomon/outcomes/new" ariaLabel={copy('outcomeNew')} />}
      accessGuard
      accessGuardTitle="Sign in to view your repair notes"
      loading={authLoading || rolesLoading}
      loadingFallback={(
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      )}
    >
      {error ? <ErrorAlert message={error} /> : null}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : items.length === 0 ? (
        <p className="text-[var(--solomon-text-secondary)] text-sm text-center py-10">
          {isDiyer ? 'No repair notes yet.' : 'No outcomes yet.'}
        </p>
      ) : (
        <div className={SOLOMON_LIST_STACK_CLASS}>
          {items.map((item) => (
            <OutcomeRow key={item.id} item={item} isDiyer={isDiyer} />
          ))}
        </div>
      )}
    </SolomonListPage>
  );
}
