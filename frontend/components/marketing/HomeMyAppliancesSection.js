import Link from 'next/link';
import { FaArrowRight, FaBuilding, FaShieldAlt, FaShoppingBag } from 'react-icons/fa';
import { HiLightningBolt } from 'react-icons/hi';
import ScrollReveal from './ScrollReveal';
import { MarketingBookLink } from './MarketingCta';
import ApplianceIcon from '../ui/ApplianceIcon';

const CARDS = [
  {
    title: 'Find it in the store aisle',
    text:
      'Need a water filter or a new bulb? Your exact model and version are right on your phone. No more pulling out the crisper drawer to read the tag.',
    Icon: FaShoppingBag,
    accent: 'cyan',
  },
  {
    title: 'Book in seconds',
    text:
      "Pick the appliance that's acting up and we already know what it is. Less back and forth, and we show up prepared.",
    Icon: HiLightningBolt,
    accent: 'orange',
  },
  {
    title: 'Repairs and warranty in one place',
    text:
      'See every repair, every part we installed and how much time is left on your 90-day labor warranty.',
    Icon: FaShieldAlt,
    accent: 'cyan',
  },
  {
    title: 'Every property, one login',
    text:
      'Landlords and property managers: track the appliances in every unit from one account.',
    Icon: FaBuilding,
    accent: 'orange',
  },
];

const DEMO_ROWS = [
  {
    type: 'refrigerator',
    name: 'Whirlpool Refrigerator',
    model: 'WRT311FZDW02',
    pill: 'Under warranty',
    pillClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  {
    type: 'range',
    name: 'GE Range',
    model: 'JB256DM4WW',
    pill: 'Last service Jul 2026',
    pillClass: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25',
  },
  {
    type: 'washer',
    name: 'LG Washer',
    model: 'WM3600HWA',
    pill: 'Filter due',
    pillClass: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
  },
];

function PhoneMockup() {
  return (
    <div
      className="mx-auto w-full max-w-[280px] rounded-[2rem] border border-white/15 bg-[#05080f] p-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
      aria-hidden
    >
      <div className="rounded-[1.6rem] border border-white/10 bg-[#0a0e17] overflow-hidden">
        <div className="h-6 flex items-center justify-center border-b border-white/5">
          <div className="w-16 h-1 rounded-full bg-white/10" />
        </div>
        <div className="px-3 pt-3 pb-4">
          <p className="text-[10px] font-semibold tracking-wider uppercase text-cyan-400/90 mb-1">
            My Appliances
          </p>
          <p className="text-white text-sm font-semibold mb-3">Demo preview</p>
          <ul className="space-y-2">
            {DEMO_ROWS.map((row) => (
              <li
                key={row.model}
                className="flex gap-2.5 items-start p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]"
              >
                <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                  <ApplianceIcon equipmentType={row.type} className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-white leading-snug truncate">{row.name}</p>
                  <p className="text-[10px] text-gray-500 truncate">{row.model}</p>
                  <span
                    className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border ${row.pillClass}`}
                  >
                    {row.pill}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function HomeMyAppliancesSection() {
  return (
    <section className="relative py-20 lg:py-28 border-t border-white/5 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-start mb-12 lg:mb-14">
          <ScrollReveal className="min-w-0">
            <span className="text-cyan-400 text-sm font-semibold tracking-wider uppercase">
              Your appliances, saved
            </span>
            <h2 className="mt-3 text-3xl lg:text-4xl font-bold text-white leading-tight">
              Every Appliance in Your Home,{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">
                One Tap Away
              </span>
            </h2>
            <p className="mt-4 text-gray-400 text-base leading-relaxed max-w-xl">
              After your first service, your appliances are saved to your free Atomic Repair account — model,
              serial, parts and repair history, right on your phone. Add the rest of your home anytime.
            </p>

            <div className="mt-6 lg:hidden">
              <PhoneMockup />
            </div>

            <div className="mt-8 flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
              <Link
                href="/cxdashboard/appliances"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 transition-colors shadow-[0_0_24px_rgba(34,211,238,0.25)] w-full sm:w-auto"
              >
                Open My Appliances
                <FaArrowRight className="w-3.5 h-3.5" />
              </Link>
              <MarketingBookLink
                href="/book"
                label="Book Service"
                tone="orange"
                size="lg"
                className="!rounded-xl w-full sm:w-auto"
              />
            </div>
            <p className="mt-4 text-gray-500 text-sm leading-relaxed max-w-lg">
              Look for the Atomic Repair QR sticker by your model tag. Scan it anytime to pull up that appliance.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={0.08} className="hidden lg:block">
            <PhoneMockup />
          </ScrollReveal>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {CARDS.map((card, i) => {
            const accentCyan = card.accent === 'cyan';
            const Icon = card.Icon;
            return (
              <ScrollReveal key={card.title} delay={i * 0.05}>
                <div
                  className={`h-full p-5 sm:p-6 rounded-2xl bg-[#0D1117] border border-white/5 transition-colors ${
                    accentCyan ? 'hover:border-cyan-500/25' : 'hover:border-orange-500/25'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                      accentCyan ? 'bg-cyan-500/10 text-cyan-400' : 'bg-orange-500/10 text-orange-400'
                    }`}
                  >
                    <Icon className="w-6 h-6" aria-hidden />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{card.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{card.text}</p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
