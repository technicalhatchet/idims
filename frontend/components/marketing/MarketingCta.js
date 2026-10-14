import Link from 'next/link';
import { Phone, CalendarCheck } from 'lucide-react';
import { MARKETING_PHONE_TEL } from '../../constants/marketingSiteContent';
import {
  MARKETING_CTA_GRADIENT,
  marketingCtaSizeClass,
} from './marketingCtaStyles';

/** Lucide phone — correct handset orientation (replaces mirrored FaPhone on marketing). */
export function MarketingPhoneIcon({ className = 'w-4 h-4 shrink-0', strokeWidth = 2.25 }) {
  return <Phone className={className} strokeWidth={strokeWidth} aria-hidden />;
}

export function MarketingBookIcon({ className = 'w-4 h-4 shrink-0', strokeWidth = 2.25 }) {
  return <CalendarCheck className={className} strokeWidth={strokeWidth} aria-hidden />;
}

/**
 * @param {'cyan'|'orange'} tone — cyan = book/schedule, orange = call (hero); bottom bar swaps placement only.
 */
export function MarketingGradientButton({
  tone = 'cyan',
  size = 'md',
  fullWidth = false,
  className = '',
  children,
  ...props
}) {
  const g = MARKETING_CTA_GRADIENT[tone];
  const sizeClass = marketingCtaSizeClass[size] || marketingCtaSizeClass.md;

  return (
    <button
      type="button"
      className={`group relative overflow-hidden font-semibold text-white transition-shadow duration-300 ${sizeClass} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      style={{ boxShadow: g.shadow }}
      {...props}
    >
      <span
        className="absolute inset-0 transition-opacity duration-300 group-hover:opacity-0"
        style={{ background: g.base }}
        aria-hidden
      />
      <span
        className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: g.hover }}
        aria-hidden
      />
      <span className="relative flex items-center justify-center gap-2">{children}</span>
    </button>
  );
}

export function MarketingBookLink({
  href = '/book',
  label = 'Book Now',
  tone = 'cyan',
  size = 'md',
  fullWidth = false,
  className = '',
  prefetch = false,
}) {
  const linkClass = fullWidth ? 'block w-full' : 'inline-block';
  return (
    <Link href={href} prefetch={prefetch} className={linkClass}>
      <MarketingGradientButton tone={tone} size={size} fullWidth={fullWidth} className={className}>
        <MarketingBookIcon />
        {label}
      </MarketingGradientButton>
    </Link>
  );
}

export function MarketingCallLink({
  tel = MARKETING_PHONE_TEL,
  label = 'Call Now',
  tone = 'orange',
  size = 'md',
  fullWidth = false,
  className = '',
}) {
  const linkClass = fullWidth ? 'block w-full' : 'inline-block';
  return (
    <a href={`tel:${tel}`} className={linkClass}>
      <MarketingGradientButton tone={tone} size={size} fullWidth={fullWidth} className={className}>
        <MarketingPhoneIcon />
        {label}
      </MarketingGradientButton>
    </a>
  );
}
