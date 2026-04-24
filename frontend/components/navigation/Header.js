import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { FaBars, FaTimes, FaUser, FaPhone } from 'react-icons/fa';
import { HiOutlinePhone } from 'react-icons/hi';

export default function Header({ user, isLoading }) {
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
        scrolled ? 'bg-[#0B0F1A]/95 backdrop-blur-md shadow-lg shadow-black/20' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-orange-500 rounded-full opacity-20 group-hover:opacity-40 transition blur-sm" />
              <svg viewBox="0 0 40 40" className="w-10 h-10 relative">
                <circle cx="20" cy="20" r="4" fill="url(#atomGrad)" />
                <ellipse cx="20" cy="20" rx="16" ry="6" fill="none" stroke="url(#orbitGrad)" strokeWidth="1.5" transform="rotate(-30 20 20)" />
                <ellipse cx="20" cy="20" rx="16" ry="6" fill="none" stroke="url(#orbitGrad)" strokeWidth="1.5" transform="rotate(30 20 20)" />
                <ellipse cx="20" cy="20" rx="16" ry="6" fill="none" stroke="url(#orbitGrad)" strokeWidth="1.5" transform="rotate(90 20 20)" />
                <circle cx="8" cy="14" r="2" fill="#22d3ee" />
                <circle cx="32" cy="14" r="2" fill="#f97316" />
                <circle cx="20" cy="34" r="2" fill="#22d3ee" />
                <defs>
                  <linearGradient id="atomGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#f97316" />
                  </linearGradient>
                  <linearGradient id="orbitGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="50%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="text-xl font-bold text-white tracking-tight">
              QUANTUM<br />
              <span className="text-orange-500">REPAIR</span>
            </span>
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
            {isLoading ? (
              <div className="h-5 w-5 border-t-2 border-cyan-400 rounded-full animate-spin" />
            ) : user ? (
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
              >
                <FaUser className="w-4 h-4" />
                Dashboard
              </Link>
            ) : (
              <Link
                href="/api/auth/login"
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
              >
                <FaUser className="w-4 h-4" />
                Login
              </Link>
            )}
            <Link
              href="/book"
              className="relative group px-6 py-2.5 rounded-lg font-semibold text-sm overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-orange-600 transition-all group-hover:from-orange-400 group-hover:to-orange-500" />
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-orange-400 to-orange-500 blur-lg" />
              <span className="relative text-white flex items-center gap-2">
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
        <div className="px-6 py-4 bg-[#0B0F1A]/95 backdrop-blur-md border-t border-white/5">
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
              {user ? (
                <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm">
                  Dashboard
                </Link>
              ) : (
                <Link href="/api/auth/login" className="text-gray-400 hover:text-white text-sm">
                  Login
                </Link>
              )}
              <Link
                href="/book"
                className="bg-gradient-to-r from-orange-500 to-orange-600 text-white text-center py-3 rounded-lg font-semibold text-sm"
              >
                Book Now
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
