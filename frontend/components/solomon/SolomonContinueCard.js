import Link from 'next/link';
import { formatSolomonDateTime } from '../../utils/solomonFormat';

export default function SolomonContinueCard({ target, isDiyer }) {
  if (!target) return null;

  const label = target.template_label || target.template_id || 'Diagnostic';
  const when = formatSolomonDateTime(target.updated_at, 'MMM d, h:mm a');
  const stepHint = target.payload?.currentStepKey
    ? 'Resume where you left off'
    : 'Continue your session';

  return (
    <Link
      href={`/solomon/diagnostics/${target.id}?continue=1`}
      className="block rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-4 hover:bg-cyan-500/15 transition-colors"
    >
      <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/90">
        Continue
      </p>
      <p className="text-lg font-semibold mt-1">{label}</p>
      <p className="text-sm text-white/70 mt-1">{stepHint}</p>
      {when ? <p className="text-xs text-white/40 mt-2">Updated {when}</p> : null}
      <p className="text-xs text-cyan-400 mt-2">
        {isDiyer ? 'Pick up troubleshooting →' : 'Resume diagnostic →'}
      </p>
    </Link>
  );
}
