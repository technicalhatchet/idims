import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FaBars, FaTimes } from 'react-icons/fa';
import SecretServiceMode from '../ui/SecretServiceMode';
import AtomicLogo from '../ui/AtomicLogo';
import { MarketingBookLink } from '../marketing/MarketingCta';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleRouteChange = () => {
      setMenuOpen(false);
    };
    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router]);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/services', label: 'Services' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/about', label: 'About' },
    { href: '/service-area', label: 'Service Area' },
    { href: '/contact', label: 'Contact' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-[#000208]/95 backdrop-blur-md shadow-lg shadow-black/20' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          <Link href="/" className="flex items-center group">
            <SecretServiceMode>
              <AtomicLogo priority />
            </SecretServiceMode>
          </Link>

          <nav className="hidden xl:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  router.pathname === link.href
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden xl:flex items-center gap-6">
            <Link
              href="/cxdashboard"
              className="text-cyan-400 hover:text-cyan-300 transition-colors text-sm font-medium"
            >
              Client Portal
            </Link>
            <MarketingBookLink label="Book Now" tone="cyan" size="sm" />
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="xl:hidden p-2 text-gray-400 hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? <FaTimes className="w-6 h-6" /> : <FaBars className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <div
        className={`xl:hidden overflow-hidden transition-all duration-300 ${
          menuOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-6 py-4 bg-[#000208]/95 backdrop-blur-md border-t border-white/5">
          <nav className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`py-2 text-sm font-medium transition-colors ${
                  router.pathname === link.href
                    ? 'text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
              <Link href="/cxdashboard" className="text-cyan-400 hover:text-cyan-300 text-sm font-medium">
                Client Portal
              </Link>
              <MarketingBookLink label="Book Now" tone="cyan" size="md" fullWidth />
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
