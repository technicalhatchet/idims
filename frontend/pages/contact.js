import Head from 'next/head';
import HomeLayout from '../components/layouts/HomeLayout';
import { FaEnvelope, FaMapMarkerAlt, FaClock } from 'react-icons/fa';
import { MarketingPhoneIcon } from '../components/marketing/MarketingCta';
import {
  MARKETING_COVERAGE_BLURB,
  MARKETING_EMAIL,
  MARKETING_SCHEDULING,
  MARKETING_PHONE_DISPLAY,
  MARKETING_PHONE_TEL,
} from '../constants/marketingSiteContent';

export default function Contact() {
  return (
    <>
      <Head>
        <title>Contact Us | Atomic Repair</title>
      </Head>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4" style={{ color: '#EAF6FF' }}>
            Contact Us
          </h1>
          <p className="text-lg" style={{ color: '#9FB3C8' }}>
            We're here to help with all your appliance repair needs
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* Contact Info */}
          <div className="space-y-6">
            <div 
              className="p-6 rounded-2xl border flex items-start gap-4"
              style={{ backgroundColor: '#000811', borderColor: '#1A2A3A' }}
            >
              <MarketingPhoneIcon className="w-7 h-7 flex-shrink-0 text-[#00E5FF]" strokeWidth={2} />
              <div>
                <h3 className="font-semibold mb-1" style={{ color: '#EAF6FF' }}>Phone</h3>
                <a href={`tel:${MARKETING_PHONE_TEL}`} style={{ color: '#9FB3C8' }}>{MARKETING_PHONE_DISPLAY}</a>
                <p className="text-sm mt-1" style={{ color: '#627D98' }}>Call or text — we return messages when we are not on a job</p>
              </div>
            </div>

            <div 
              className="p-6 rounded-2xl border flex items-start gap-4"
              style={{ backgroundColor: '#000811', borderColor: '#1A2A3A' }}
            >
              <FaEnvelope className="text-2xl flex-shrink-0" style={{ color: '#00E5FF' }} />
              <div>
                <h3 className="font-semibold mb-1" style={{ color: '#EAF6FF' }}>Email</h3>
                <a href={`mailto:${MARKETING_EMAIL}`} style={{ color: '#9FB3C8' }}>{MARKETING_EMAIL}</a>
                <p className="text-sm mt-1" style={{ color: '#627D98' }}>We respond within 24 hours</p>
              </div>
            </div>

            <div 
              className="p-6 rounded-2xl border flex items-start gap-4"
              style={{ backgroundColor: '#000811', borderColor: '#1A2A3A' }}
            >
              <FaMapMarkerAlt className="text-2xl flex-shrink-0" style={{ color: '#FF7A1A' }} />
              <div>
                <h3 className="font-semibold mb-1" style={{ color: '#EAF6FF' }}>Service Area</h3>
                <p style={{ color: '#9FB3C8' }}>{MARKETING_COVERAGE_BLURB}</p>
              </div>
            </div>

            <div 
              className="p-6 rounded-2xl border flex items-start gap-4"
              style={{ backgroundColor: '#000811', borderColor: '#1A2A3A' }}
            >
              <FaClock className="text-2xl flex-shrink-0" style={{ color: '#FF7A1A' }} />
              <div>
                <h3 className="font-semibold mb-1" style={{ color: '#EAF6FF' }}>{MARKETING_SCHEDULING.title}</h3>
                {MARKETING_SCHEDULING.lines.map((line) => (
                  <p key={line} className="text-sm leading-relaxed" style={{ color: '#9FB3C8' }}>{line}</p>
                ))}
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div 
            className="p-8 rounded-2xl border"
            style={{ backgroundColor: '#000811', borderColor: '#1A2A3A' }}
          >
            <h2 className="text-xl font-bold mb-6" style={{ color: '#EAF6FF' }}>Send us a message</h2>
            <form className="space-y-5">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2" style={{ color: '#9FB3C8' }}>
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  id="name"
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2 transition-all"
                  style={{ 
                    backgroundColor: '#000208', 
                    borderColor: '#1A2A3A', 
                    color: '#EAF6FF',
                  }}
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: '#9FB3C8' }}>
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2 transition-all"
                  style={{ 
                    backgroundColor: '#000208', 
                    borderColor: '#1A2A3A', 
                    color: '#EAF6FF',
                  }}
                />
              </div>
              
              <div>
                <label htmlFor="phone" className="block text-sm font-medium mb-2" style={{ color: '#9FB3C8' }}>
                  Phone (optional)
                </label>
                <input
                  type="tel"
                  name="phone"
                  id="phone"
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2 transition-all"
                  style={{ 
                    backgroundColor: '#000208', 
                    borderColor: '#1A2A3A', 
                    color: '#EAF6FF',
                  }}
                />
              </div>
              
              <div>
                <label htmlFor="message" className="block text-sm font-medium mb-2" style={{ color: '#9FB3C8' }}>
                  Message
                </label>
                <textarea
                  name="message"
                  id="message"
                  rows={4}
                  className="w-full rounded-lg px-4 py-3 border focus:outline-none focus:ring-2 transition-all resize-none"
                  style={{ 
                    backgroundColor: '#000208', 
                    borderColor: '#1A2A3A', 
                    color: '#EAF6FF',
                  }}
                />
              </div>
              
              <button
                type="submit"
                className="w-full py-3 px-6 rounded-lg font-semibold text-white transition-all hover:scale-[1.02]"
                style={{ 
                  background: 'linear-gradient(135deg, #00E5FF, #00B8D4)',
                  boxShadow: '0 0 20px rgba(0, 229, 255, 0.3)',
                }}
              >
                Send Message
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

// Use the home layout
Contact.getLayout = function getLayout(page) {
  return <HomeLayout>{page}</HomeLayout>;
}; 