import {
  SolomonArrowBack,
  SolomonCenteredLogo,
  SolomonHatBackButton,
} from './SolomonPageHeader';

/**
 * Full-width centered logo with optional left/right controls (mobile wizard shell).
 */
export default function SolomonWizardHeader({ left, right = null }) {
  return (
    <div className="relative min-h-[44px] px-1">
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center px-[4.5rem]"
        aria-hidden
      >
        <SolomonCenteredLogo className="sm:max-h-10" />
      </div>
      <div className="relative z-10 flex min-h-[44px] items-center justify-between gap-2">
        <div className="flex min-w-[44px] shrink-0 items-center justify-start">{left}</div>
        <div className="flex min-w-[44px] shrink-0 items-center justify-end">{right}</div>
      </div>
    </div>
  );
}

export function SolomonWizardBackLink({ href = '/solomon', variant = 'hat', label = 'Back' }) {
  if (variant === 'arrow') {
    return <SolomonArrowBack href={href} label={label} />;
  }
  return <SolomonHatBackButton href={href} />;
}
