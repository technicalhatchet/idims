import Link from 'next/link';
import { PORTAL_LOGO_SRC } from '../../constants/portalBrandAssets';

/**
 * @param {'header-mobile' | 'sidebar-desktop' | 'drawer'} variant
 */
export default function PortalBrandLogo({ variant = 'sidebar-desktop', href = '/cxdashboard', onNavigate }) {
  const classByVariant = {
    'header-mobile':
      'h-11 sm:h-12 w-auto max-w-[min(19rem,calc(100vw-5.5rem))] object-contain object-center',
    'sidebar-desktop': 'h-11 w-full object-contain object-left',
    drawer: 'h-11 w-full min-w-0 object-contain object-left',
  };

  const img = (
    <img
      src={PORTAL_LOGO_SRC}
      alt="Atomic Repair Client Portal"
      className={classByVariant[variant]}
    />
  );

  if (!href) return img;

  return (
    <Link href={href} className="block min-w-0" onClick={onNavigate}>
      {img}
    </Link>
  );
}
