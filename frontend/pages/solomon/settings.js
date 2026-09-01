import Link from 'next/link';
import { FaChevronRight, FaInfoCircle, FaUser, FaWrench } from 'react-icons/fa';
import SolomonListPage from '../../components/solomon/SolomonListPage';
import SolomonAppearanceSettings from '../../components/solomon/SolomonAppearanceSettings';
import { SOLOMON_GLASS_PANEL_CLASS } from '../../components/solomon/solomonListPageUi';
import { useSolomonAuth } from '../../hooks/useSolomonAuth';
import { solomonCopy } from '../../utils/solomonDiyCopy';
import { solomonLoginUrl } from '../../utils/solomonAuthUrls';

function SettingsLinkRow({ href, label, subtitle, icon: Icon, external = false }) {
  const className = `${SOLOMON_GLASS_PANEL_CLASS} flex items-center gap-3 py-3 px-3.5 hover:border-[color:var(--solomon-primary-border)] transition-colors`;

  const inner = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[var(--solomon-text-secondary)]">
        <Icon size={14} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-[var(--solomon-text-primary)]">{label}</span>
        {subtitle ? (
          <span className="block text-[11px] text-[var(--solomon-text-muted)] mt-0.5">{subtitle}</span>
        ) : null}
      </span>
      <FaChevronRight size={11} className="shrink-0 text-[var(--solomon-text-muted)]" aria-hidden />
    </>
  );

  if (external) {
    return (
      <li>
        <a href={href} className={className}>{inner}</a>
      </li>
    );
  }

  return (
    <li>
      <Link href={href} className={className}>{inner}</Link>
    </li>
  );
}

export default function SolomonSettingsPage() {
  const { isDiyer, user } = useSolomonAuth();
  const outcomesLabel = solomonCopy(isDiyer, 'outcomesTitle');

  return (
    <SolomonListPage
      headTitle="Settings"
      title="Settings"
      description="Appearance and Solomon preferences."
      back="arrow"
      backHref="/solomon/more"
      backLabel="Back to More"
    >
      <div className="space-y-5">
        <SolomonAppearanceSettings />

        <section aria-labelledby="solomon-settings-links">
          <h2 id="solomon-settings-links" className="text-[11px] uppercase tracking-[0.08em] text-[var(--solomon-text-muted)] mb-2.5">
            Quick links
          </h2>
          <ul className="space-y-2.5">
            <SettingsLinkRow
              href="/solomon/outcomes"
              label={outcomesLabel}
              subtitle="Review and record repair outcomes"
              icon={FaWrench}
            />
            <SettingsLinkRow
              href={user ? '/api/auth/logout' : solomonLoginUrl('/solomon/settings')}
              label="Account"
              subtitle={user ? 'Sign out of this device' : 'Sign in to sync preferences'}
              icon={FaUser}
              external
            />
            <SettingsLinkRow
              href="/solomon"
              label="About Solomon"
              subtitle="Diagnostic assistant for homeowners and technicians"
              icon={FaInfoCircle}
            />
          </ul>
        </section>
      </div>
    </SolomonListPage>
  );
}
