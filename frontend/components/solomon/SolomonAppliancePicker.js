import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSolomonAuth } from '../../hooks/useSolomonAuth';
import SolomonHead from './SolomonHead';
import SolomonPageMain from './SolomonPageMain';
import SolomonAccessGuard from './SolomonAccessGuard';
import { SOLOMON_DIY_APPLIANCES } from '../../constants/solomonDiyAppliances';

/**
 * Grid picker — homeowners choose appliance before the guided wizard.
 */
export default function SolomonAppliancePicker({ onSelect, showWelcome = false }) {
  return (
    <div className="space-y-4">
      {showWelcome ? (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
          <p className="text-sm font-medium text-cyan-100">Welcome to Solomon</p>
          <p className="text-sm text-gray-400 mt-1">
            Pick the appliance you&apos;re troubleshooting. We&apos;ll walk you through questions step by step.
          </p>
        </div>
      ) : (
        <div>
          <h2 className="text-lg font-semibold text-white">What appliance?</h2>
          <p className="text-sm text-gray-400 mt-1">
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
            className="rounded-xl border border-white/10 bg-[#0D1525] px-4 py-3 text-left hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-colors"
          >
            <p className="font-medium text-white">{item.label}</p>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.hint}</p>
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

  if (isLoading || rolesLoading) {
    return (
      <>
        <SolomonHead title="Choose appliance" />
        <SolomonPageMain>
          <p className="text-gray-400 text-sm">Loading…</p>
        </SolomonPageMain>
      </>
    );
  }

  return (
    <>
      <SolomonHead title="Choose appliance" />
      <SolomonPageMain>
        <SolomonAccessGuard promptTitle="Sign in to start troubleshooting">
        <Link href="/solomon" className="text-xs text-cyan-400 hover:text-cyan-300">← Home</Link>
        <div className="mt-4">
          <SolomonAppliancePicker onSelect={handleSelect} showWelcome={showWelcome || isDiyer} />
        </div>
        {!isDiyer ? (
          <p className="text-xs text-gray-500 mt-6 text-center">
            Staff can also pick a template here before running a standalone diagnostic.
          </p>
        ) : null}
        </SolomonAccessGuard>
      </SolomonPageMain>
    </>
  );
}
