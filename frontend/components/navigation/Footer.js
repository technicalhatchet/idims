import Link from 'next/link';
import { FaPhone, FaEnvelope, FaMapMarkerAlt } from 'react-icons/fa';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#080B12] border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <img
                src="/arpano.png"
                alt="Atomic Repair"
                className="w-auto object-contain"
                style={{ height: '48px' }}
              />
            </Link>
            <p className="text-gray-500 text-sm leading-relaxed">
              Fast, reliable appliance repair in Toledo. Same-day service, honest diagnostics, no surprises.
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
              <li>
                <Link href="/services#refrigerator" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm">
                  Refrigerator Repair
                </Link>
              </li>
              <li>
                <Link href="/services#washer" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm">
                  Washer & Dryer
                </Link>
              </li>
              <li>
                <Link href="/services#oven" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm">
                  Oven & Range
                </Link>
              </li>
              <li>
                <Link href="/services#dishwasher" className="text-gray-400 hover:text-cyan-400 transition-colors text-sm">
                  Dishwasher
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-semibold mb-4">Contact Us</h4>
            <ul className="space-y-3">
              <li>
                <a href="tel:4190000000" className="flex items-center gap-3 text-gray-400 hover:text-cyan-400 transition-colors text-sm">
                  <FaPhone className="w-4 h-4 text-cyan-400" />
                  (419) 000-0000
                </a>
              </li>
              <li>
                <a href="mailto:info@quantumrepair.com" className="flex items-center gap-3 text-gray-400 hover:text-cyan-400 transition-colors text-sm">
                  <FaEnvelope className="w-4 h-4 text-cyan-400" />
                  info@quantumrepair.com
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
            &copy; {currentYear} Quantum Repair. All rights reserved.
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
