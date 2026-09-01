import { useRouter } from 'next/router';
import { useSolomonAuth } from '../../hooks/useSolomonAuth';
import SolomonListPage from './SolomonListPage';
import { SOLOMON_DIY_APPLIANCES } from '../../constants/solomonDiyAppliances';
import {
  SOLOMON_PAGE_DESCRIPTION_CLASS,
  SOLOMON_PAGE_TITLE_CLASS,
} from './solomonListPageUi';

const PICKER_BUTTON_CLASS =
  'rounded-xl border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface-elevated)] px-4 py-3 text-left hover:border-[color:var(--solomon-primary-border)] hover:bg-[var(--solomon-surface-glass-hover)] transition-colors';

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

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SOLOMON_DIY_APPLIANCES.map((item) => (
          <button
            key={item.templateId}
            type="button"
            onClick={() => onSelect(item.templateId)}
            className={PICKER_BUTTON_CLASS}
          >
            <p className="font-medium text-[var(--solomon-text-primary)]">{item.label}</p>
            <p className="text-xs text-[var(--solomon-text-muted)] mt-0.5 line-clamp-2">{item.hint}</p>
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
