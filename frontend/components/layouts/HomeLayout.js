import { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Header from '../navigation/Header';
import Footer from '../navigation/Footer';
import AtomicGlowBackground from './AtomicGlowBackground';
import MarketingMobileActionBar from '../marketing/MarketingMobileActionBar';
import {
  BRAND_ICON_SRC,
  BRAND_SOCIAL_SHARE_SRC,
  brandPublicUrl,
} from '../../constants/brandAssets';

// Global Atomic theme colors
const ATOMIC_THEME = {
  bg: '#000208',
  cardBg: '#000811',
  cardBorder: '#1A2A3A',
  textPrimary: '#EAF6FF',
  textSecondary: '#9FB3C8',
  textMuted: '#6B7C8F',
  accentCyan: '#00E5FF',
  accentOrange: '#FF7A1A',
  tealHighlight: '#00C2B8',
};

const DEFAULT_DESCRIPTION =
  'Fast, reliable appliance repair in Toledo. Same-day service, honest diagnostics, no surprises.';

export default function HomeLayout({
  children,
  title = 'Atomic Repair | Appliance Repair Toledo',
  description = DEFAULT_DESCRIPTION,
  bookingFlow = false,
}) {
  const router = useRouter();
  const ogImage = brandPublicUrl(BRAND_SOCIAL_SHARE_SRC);
  const pageUrl = brandPublicUrl(router.asPath.split('?')[0] || '/');
  useEffect(() => {
    document.documentElement.classList.add('atomic-marketing');
    return () => {
      document.documentElement.classList.remove('atomic-marketing');
    };
  }, []);

  return (
    <div
      className={`flex flex-col relative atomic-marketing-shell overflow-hidden ${
        bookingFlow ? 'h-[100dvh] max-h-[100dvh] min-h-0' : 'min-h-screen'
      }`}
      style={{ backgroundColor: ATOMIC_THEME.bg }}
    >
      <AtomicGlowBackground />

      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="icon" href={BRAND_ICON_SRC} type="image/png" sizes="512x512" />
        <link rel="apple-touch-icon" href={BRAND_ICON_SRC} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Atomic Repair" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content={pageUrl} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={ogImage} />
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add('atomic-marketing');`,
          }}
        />
      </Head>

      <div className="relative z-[60]">
        <Header />
      </div>

      <main
        className={
          bookingFlow
            ? 'flex flex-1 flex-col min-h-0 overflow-hidden relative z-10 pb-0'
            : 'flex-grow relative z-10 max-md:pb-[calc(max(env(safe-area-inset-bottom),12px)+10px+5.25rem)] md:pb-0'
        }
      >
        {children}
      </main>

      {!bookingFlow && <MarketingMobileActionBar />}
      {!bookingFlow && <Footer />}
    </div>
  );
}

export { ATOMIC_THEME };
