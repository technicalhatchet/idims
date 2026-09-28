import { useRouter } from 'next/router';
import { useSolomonAuth } from '../../hooks/useSolomonAuth';
import SolomonListPage from './SolomonListPage';
import { SOLOMON_DIY_APPLIANCES, templateIdToDiySubtype } from '../../constants/solomonDiyAppliances';
import SolomonApplianceIcon from './SolomonApplianceIcon';
import {
  SOLOMON_PAGE_DESCRIPTION_CLASS,
  SOLOMON_PAGE_TITLE_CLASS,
} from './solomonListPageUi';
import { SOLOMON_APPLIANCE_PICKER_GRID_CLASS } from './solomonAppliancePickerLayout';

export { SOLOMON_APPLIANCE_PICKER_GRID_CLASS } from './solomonAppliancePickerLayout';

const PICKER_BUTTON_CLASS =
  'flex min-h-[4.25rem] flex-col items-center justify-center gap-1.5 rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface-elevated)] px-2 py-2.5 text-center transition-colors hover:border-[color:var(--solomon-primary-border)] hover:bg-[var(--solomon-surface-glass-hover)]';

const WELCOME_BANNER_CLASS =
  'rounded-xl border border-[color:var(--solomon-primary-border)] bg-[var(--solomon-primary-from)]/5 px-4 py-3';

/**
 * Grid picker — homeowners choose appliance before the guided wizard.
 */
export default function SolomonAppliancePicker({ onSelect, showWelcome = false }) {
  return (
    <div className="space-y-4">
      {showWelcome ? (
        <div className={WELCOME_BANNER_CLASS}>
          <p className="text-sm font-medium text-[var(--solomon-text-primary)]">Welcome to Solomon</p>
          <p className={`${SOLOMON_PAGE_DESCRIPTION_CLASS} mt-1`}>
            Pick the appliance you&apos;re troubleshooting. We&apos;ll walk you through questions step by step.
          </p>
        </div>
      ) : (
        <div>
          <h2 className={SOLOMON_PAGE_TITLE_CLASS}>What appliance?</h2>
          <p className={SOLOMON_PAGE_DESCRIPTION_CLASS}>
            Choose one to start guided troubleshooting.
          </p>
        </div>
      )}

      <div className={SOLOMON_APPLIANCE_PICKER_GRID_CLASS} data-solomon-appliance-picker-grid>
        {SOLOMON_DIY_APPLIANCES.map((item) => (
          <button
            key={item.templateId}
            type="button"
            onClick={() => onSelect(item.templateId)}
            className={PICKER_BUTTON_CLASS}
            data-appliance-template={item.templateId}
          >
            <SolomonApplianceIcon
              equipmentType={item.templateId}
              equipmentSubtype={templateIdToDiySubtype(item.templateId)}
              className="h-8 w-8 shrink-0"
            />
            <p className="text-sm font-medium leading-tight text-[var(--solomon-text-primary)]">
              {item.label}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SolomonAppliancePickerPage() {
  const router = useRouter();
  const { canUseSolomon, isLoading, isDiyer, rolesLoading } = useSolomonAuth();
  const showWelcome = router.query.welcome === '1';
  const outcomeId = typeof router.query.outcome_id === 'string' ? router.query.outcome_id : null;

  const handleSelect = (templateId) => {
    const params = new URLSearchParams({ template: templateId });
    if (outcomeId) params.set('outcome_id', outcomeId);
    router.push(`/solomon/diagnose?${params.toString()}`);
  };

  return (
    <SolomonListPage
      headTitle="Choose appliance"
      accessGuard
      accessGuardTitle="Sign in to start troubleshooting"
      loading={isLoading || rolesLoading}
      loadingFallback={(
        <p className="text-[var(--solomon-text-secondary)] text-sm">Loading…</p>
      )}
    >
      <SolomonAppliancePicker onSelect={handleSelect} showWelcome={showWelcome || isDiyer} />
      {!isDiyer ? (
        <p className="text-xs text-[var(--solomon-text-muted)] mt-6 text-center">
          Staff can also pick a template here before running a standalone diagnostic.
        </p>
      ) : null}
    </SolomonListPage>
  );
}
