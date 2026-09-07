import Link from 'next/link';
import {
  FaChevronRight,
  FaClipboardList,
  FaCog,
  FaHashtag,
  FaWrench,
} from 'react-icons/fa';
import SolomonListPage from '../../components/solomon/SolomonListPage';
import { SOLOMON_GLASS_PANEL_CLASS } from '../../components/solomon/solomonListPageUi';
import { useSolomonAuth } from '../../hooks/useSolomonAuth';
import { solomonCopy } from '../../utils/solomonDiyCopy';
import { solomonLoginUrl } from '../../utils/solomonAuthUrls';

function MoreLinkRow({ href, label, subtitle, icon: Icon, accentClass }) {
  return (
    <li>
      <Link
        href={href}
        className={`${SOLOMON_GLASS_PANEL_CLASS} flex items-center gap-3 py-3 px-3.5 hover:border-[color:var(--solomon-primary-border)] transition-colors`}
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 ${accentClass}`}>
          <Icon size={14} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-[var(--solomon-text-primary)]">{label}</span>
          {subtitle ? (
            <span className="block text-[11px] text-[var(--solomon-text-muted)] mt-0.5">{subtitle}</span>
          ) : null}
        </span>
        <FaChevronRight size={11} className="shrink-0 text-[var(--solomon-text-muted)]" aria-hidden />
      </Link>
    </li>
  );
}

export default function SolomonMorePage() {
  const { isDiyer, isStaff } = useSolomonAuth();
  const outcomesLabel = solomonCopy(isDiyer, 'outcomesTitle');

  return (
    <SolomonListPage
      headTitle="More"
      title="More"
      description="Additional tools and account options."
      back="arrow"
      backHref="/solomon"
      backLabel="Back to Solomon home"
    >
      <ul className="space-y-2.5">
        <MoreLinkRow
          href="/solomon/diagnostics"
          label="My diagnostics"
          subtitle="View and continue sessions"
          icon={FaClipboardList}
          accentClass="bg-cyan-500/15 text-cyan-400"
        />
        <MoreLinkRow
          href="/solomon/outcomes"
          label={outcomesLabel}
          subtitle="Record and review completed repairs"
          icon={FaWrench}
          accentClass="bg-orange-500/15 text-orange-400"
        />
        <MoreLinkRow
          href="/solomon/codes"
          label="Error codes"
          subtitle="Manufacturer fault code lookup"
          icon={FaHashtag}
          accentClass="bg-[color:var(--solomon-status-reference)]/15 text-[color:var(--solomon-status-reference)]"
        />
        <MoreLinkRow
          href="/solomon/settings"
          label="Settings"
          subtitle="Appearance and preferences"
          icon={FaCog}
          accentClass="bg-white/5 text-[var(--solomon-text-secondary)]"
        />
        {isStaff ? (
          <MoreLinkRow
            href="/settings"
            label="Company settings"
            subtitle="IDIMS account and shop preferences"
            icon={FaCog}
            accentClass="bg-white/5 text-gray-300"
          />
        ) : null}
      </ul>

      <div className="mt-8 pt-4 border-t border-[color:var(--solomon-border-muted)]">
        <a
          href={solomonLoginUrl()}
          className="block text-center text-[11px] text-[var(--solomon-text-muted)] hover:text-[var(--solomon-text-secondary)]"
        >
          Sign in with another account
        </a>
      </div>
    </SolomonListPage>
  );
}
