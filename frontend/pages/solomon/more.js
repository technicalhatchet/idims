import Link from 'next/link';
import {
  FaChevronRight,
  FaClipboardList,
  FaCog,
  FaHashtag,
  FaWrench,
} from 'react-icons/fa';
import SolomonPageHeader from '../../components/solomon/SolomonPageHeader';
import SolomonPageAtmosphere from '../../components/solomon/SolomonPageAtmosphere';
import SolomonHead from '../../components/solomon/SolomonHead';
import SolomonPageMain from '../../components/solomon/SolomonPageMain';
import SolomonErrorBoundary from '../../components/solomon/SolomonErrorBoundary';
import { SOLOMON_GLASS_PANEL_CLASS, SOLOMON_PAGE_SHELL_CLASS } from '../../components/solomon/solomonListPageUi';
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
          <span className="block text-sm font-medium text-white">{label}</span>
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
    <SolomonErrorBoundary>
      <SolomonHead title="More" />
      <SolomonPageMain className={SOLOMON_PAGE_SHELL_CLASS}>
        <SolomonPageAtmosphere />
        <div className="relative">
          <SolomonPageHeader back="arrow" backHref="/solomon" backLabel="Back to Solomon home" />

          <header className="mb-5">
            <h1 className="text-[1.75rem] font-bold tracking-tight text-white leading-tight">More</h1>
            <p className="text-sm text-[var(--solomon-text-secondary)] mt-1.5">
              Additional tools and account options.
            </p>
          </header>

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
              accentClass="bg-emerald-500/15 text-emerald-400"
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
        </div>
      </SolomonPageMain>
    </SolomonErrorBoundary>
  );
}
