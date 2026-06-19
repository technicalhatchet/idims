import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FaBars, FaTimes } from 'react-icons/fa';
import SecretServiceMode from '../ui/SecretServiceMode';

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
          {/* Logo */}
          <Link href="/" className="flex items-center group">
            <SecretServiceMode>
              <img
                src="/arpano.png"
                alt="Atomic Repair"
                className="w-auto object-contain"
                style={{ height: '72px' }}
              />
            </SecretServiceMode>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-8">
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

          {/* Right Side Actions */}
          <div className="hidden lg:flex items-center gap-6">
            <Link
              href="/cxdashboard"
              className="text-cyan-400 hover:text-cyan-300 transition-colors text-sm font-medium"
            >
              Client Portal
            </Link>
            <Link
              href="/book"
              className="book-btn-header relative group px-5 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, #fb923c 0%, #fbbf24 100%)',
              }}
            >
              {/* Cyan Calendar Icon with breathing glow */}
              <span className="calendar-icon-breathe relative flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5" style={{ stroke: '#00B8D4', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                  <rect x="3" y="5" width="18" height="16" rx="2"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                  <line x1="8" y1="3" x2="8" y2="7"/>
                  <line x1="16" y1="3" x2="16" y2="7"/>
                </svg>
              </span>
              <span className="relative text-white">
                Book Now
              </span>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? <FaTimes className="w-6 h-6" /> : <FaBars className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`lg:hidden overflow-hidden transition-all duration-300 ${
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
              <Link
                href="/book"
                className="book-btn-header flex items-center justify-center gap-2 text-white text-center py-3 rounded-lg font-semibold text-sm"
                style={{ background: 'linear-gradient(135deg, #fb923c 0%, #fbbf24 100%)' }}
              >
                <span className="calendar-icon-breathe">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" style={{ stroke: '#00B8D4', strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                    <rect x="3" y="5" width="18" height="16" rx="2"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                    <line x1="8" y1="3" x2="8" y2="7"/>
                    <line x1="16" y1="3" x2="16" y2="7"/>
                  </svg>
                </span>
                Book Now
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
