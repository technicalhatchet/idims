import Link from 'next/link';
import { FaPhone, FaEnvelope, FaMapMarkerAlt } from 'react-icons/fa';
import AtomicLogo from '../ui/AtomicLogo';
import {
  MARKETING_EMAIL,
  MARKETING_PHONE_DISPLAY,
  MARKETING_PHONE_TEL,
  MARKETING_SERVICES,
} from '../../constants/marketingSiteContent';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative z-10" style={{ backgroundColor: 'transparent' }}>
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <AtomicLogo height={48} />
            </Link>
            <p className="text-gray-500 text-sm leading-relaxed">
              Owner-operated appliance repair in Toledo. Same-day diagnostics when available.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/services" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm">
                  Services
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-white font-semibold mb-4">Services</h4>
            <ul className="space-y-3">
              {MARKETING_SERVICES.map((service) => (
                <li key={service.slug}>
                  <Link
                    href={`/services/${service.slug}`}
                    className="text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                  >
                    {service.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-semibold mb-4">Contact Us</h4>
            <ul className="space-y-3">
              <li>
                <a href={`tel:${MARKETING_PHONE_TEL}`} className="flex items-center gap-3 text-gray-400 hover:text-cyan-400 transition-colors text-sm">
                  <FaPhone className="w-4 h-4 text-cyan-400" />
                  {MARKETING_PHONE_DISPLAY}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${MARKETING_EMAIL}`}
                  className="flex items-center gap-3 text-gray-400 hover:text-cyan-400 transition-colors text-sm"
                >
                  <FaEnvelope className="w-4 h-4 text-cyan-400" />
                  {MARKETING_EMAIL}
                </a>
              </li>
              <li>
                <div className="flex items-start gap-3 text-gray-400 text-sm">
                  <FaMapMarkerAlt className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                  Toledo, OH & Surrounding Areas
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <p className="text-gray-500 text-sm">
            &copy; {currentYear} Atomic Repair. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="/terms" className="text-gray-500 hover:text-gray-300 transition-colors text-sm">
              Terms of Service
            </Link>
            <Link href="/privacy" className="text-gray-500 hover:text-gray-300 transition-colors text-sm">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
