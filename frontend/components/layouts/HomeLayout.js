import Head from 'next/head';
import Header from '../navigation/Header';
import Footer from '../navigation/Footer';

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

export default function HomeLayout({ children, title = 'Quantum Repair | Appliance Repair Toledo' }) {
  return (
    <div 
      className="min-h-screen flex flex-col relative"
      style={{ backgroundColor: ATOMIC_THEME.bg }}
    >
      {/* Global Atomic Glow Blobs - Responsive */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Cyan blob - top left */}
        <div 
          className="absolute blur-[120px] md:blur-[180px] w-[300px] h-[300px] md:w-[700px] md:h-[700px] -top-[50px] -left-[100px] md:-top-[100px] md:-left-[200px]"
          style={{ backgroundColor: 'rgba(0, 229, 255, 0.15)' }}
        />
        {/* Orange blob - bottom right */}
        <div 
          className="absolute blur-[100px] md:blur-[150px] w-[250px] h-[250px] md:w-[500px] md:h-[500px] bottom-[15%] -right-[50px] md:bottom-[20%] md:-right-[100px]"
          style={{ backgroundColor: 'rgba(255, 122, 26, 0.18)' }}
        />
      </div>

      <Head>
        <title>{title}</title>
        <meta name="description" content="Fast, reliable appliance repair in Toledo. Same-day service, honest diagnostics, no surprises." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Header />

      <main className="flex-grow relative z-10">
        {children}
      </main>

      <Footer />
    </div>
  );
}

export { ATOMIC_THEME };
