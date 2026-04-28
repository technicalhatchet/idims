import Head from 'next/head';
import React from 'react';

/** Layered neon: stroke on SVG, glow + motion on wrapper. Page-local only. */
function IconWrapper({
  children,
  active = false,
  hover = true,
  breathe = false,
  variant = 'blue',
  status = 'default',
}) {
  const child = React.Children.only(children);
  const strokeMods = [
    variant === 'orange' ? 'neon-icon-stroke-orange' : '',
    status === 'success' ? 'neon-icon-stroke-success' : '',
    status === 'warning' ? 'neon-icon-stroke-warning' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const merged = React.cloneElement(child, {
    className: [child.props.className, 'neon-icon-base', strokeMods].filter(Boolean).join(' '),
  });

  const glowClass =
    status === 'success'
      ? 'neon-glow-success'
      : status === 'warning'
        ? 'neon-glow-warning'
        : variant === 'orange'
          ? 'neon-glow-orange'
          : 'neon-glow';

  return (
    <div
      className={[
        'inline-flex items-center justify-center transition-transform duration-300',
        hover ? 'neon-hover-target' : '',
        active ? 'neon-active-target' : '',
        breathe ? 'neon-breathe-target' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={['neon-glow-layer', glowClass].filter(Boolean).join(' ')}>{merged}</div>
    </div>
  );
}

export default function IconTest() {
  return (
    <>
      <Head>
        <title>Icon Test Page</title>
      </Head>

      <div className="min-h-screen bg-[#0B0F1A] text-white p-10">
        <h1 className="text-3xl font-bold mb-2">SVG Icon Preview</h1>
        <p className="text-gray-400 mb-10">Testing new icon system - this page is isolated and won't affect anything else.</p>

        {/* Core Icons */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-cyan-400 mb-6">Core Dashboard Icons</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            
            {/* Calendar */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-10 h-10 icon-neon">
                <rect x="3" y="5" width="18" height="16" rx="2"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
                <line x1="8" y1="3" x2="8" y2="7"/>
                <line x1="16" y1="3" x2="16" y2="7"/>
              </svg>
              <span className="text-sm text-gray-400">Calendar</span>
            </div>

            {/* Wrench */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-10 h-10 icon-neon">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
              </svg>
              <span className="text-sm text-gray-400">Wrench</span>
            </div>

            {/* Invoice */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-10 h-10 icon-neon">
                <rect x="4" y="3" width="16" height="18" rx="2"/>
                <line x1="8" y1="8" x2="16" y2="8"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
                <line x1="8" y1="16" x2="12" y2="16"/>
              </svg>
              <span className="text-sm text-gray-400">Invoice</span>
            </div>

            {/* Warranty/Shield */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-10 h-10 icon-neon">
                <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>
                <polyline points="9 12 11 14 15 10"/>
              </svg>
              <span className="text-sm text-gray-400">Warranty</span>
            </div>

            {/* Messages */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-10 h-10 icon-neon">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span className="text-sm text-gray-400">Messages</span>
            </div>

            {/* Settings */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-10 h-10 icon-neon">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              <span className="text-sm text-gray-400">Settings</span>
            </div>

            {/* Home */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-10 h-10 icon-neon">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              <span className="text-sm text-gray-400">Home</span>
            </div>

            {/* Folder/Documents */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-10 h-10 icon-neon">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <span className="text-sm text-gray-400">Documents</span>
            </div>

            {/* Laptop/Devices */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-10 h-10 icon-neon">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="2" y1="20" x2="22" y2="20"/>
              </svg>
              <span className="text-sm text-gray-400">Devices</span>
            </div>

            {/* User */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-10 h-10 icon-neon">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span className="text-sm text-gray-400">User</span>
            </div>

            {/* Bell */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-10 h-10 icon-neon">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <span className="text-sm text-gray-400">Bell</span>
            </div>

            {/* Phone */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-10 h-10 icon-neon">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              <span className="text-sm text-gray-400">Phone</span>
            </div>

          </div>
        </section>

        {/* Appliance Icons */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-orange-400 mb-6">Appliance Icons</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
            
            {/* Refrigerator */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-12 h-12 icon-neon">
                <rect x="6" y="2" width="12" height="20" rx="2"/>
                <line x1="6" y1="10" x2="18" y2="10"/>
                <line x1="10" y1="5" x2="10" y2="8"/>
                <line x1="10" y1="13" x2="10" y2="16"/>
              </svg>
              <span className="text-sm text-gray-400">Fridge</span>
            </div>

            {/* Washer */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-12 h-12 icon-neon">
                <rect x="4" y="2" width="16" height="20" rx="2"/>
                <circle cx="12" cy="13" r="5"/>
                <circle cx="12" cy="13" r="2"/>
                <circle cx="8" y1="6" r="1"/>
              </svg>
              <span className="text-sm text-gray-400">Washer</span>
            </div>

            {/* Dryer */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-12 h-12 icon-neon">
                <rect x="4" y="2" width="16" height="20" rx="2"/>
                <circle cx="12" cy="13" r="5"/>
                <path d="M10 11a2 2 0 0 0 4 0"/>
                <circle cx="8" cy="6" r="1"/>
              </svg>
              <span className="text-sm text-gray-400">Dryer</span>
            </div>

            {/* Oven */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-12 h-12 icon-neon">
                <rect x="4" y="2" width="16" height="20" rx="2"/>
                <rect x="6" y="10" width="12" height="9" rx="1"/>
                <line x1="7" y1="6" x2="7" y2="6"/>
                <line x1="10" y1="6" x2="10" y2="6"/>
                <line x1="13" y1="6" x2="13" y2="6"/>
                <line x1="16" y1="6" x2="16" y2="6"/>
              </svg>
              <span className="text-sm text-gray-400">Oven</span>
            </div>

            {/* Dishwasher */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-12 h-12 icon-neon">
                <rect x="4" y="2" width="16" height="20" rx="2"/>
                <line x1="4" y1="8" x2="20" y2="8"/>
                <line x1="9" y1="5" x2="15" y2="5"/>
              </svg>
              <span className="text-sm text-gray-400">Dishwasher</span>
            </div>

            {/* Microwave */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-12 h-12 icon-neon">
                <rect x="2" y="6" width="20" height="12" rx="2"/>
                <rect x="4" y="8" width="12" height="8"/>
                <line x1="18" y1="10" x2="18" y2="10"/>
                <line x1="18" y1="12" x2="18" y2="12"/>
                <line x1="18" y1="14" x2="18" y2="14"/>
              </svg>
              <span className="text-sm text-gray-400">Microwave</span>
            </div>

            {/* Freezer */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-12 h-12 icon-neon">
                <rect x="3" y="6" width="18" height="14" rx="2"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
                <line x1="12" y1="6" x2="12" y2="10"/>
              </svg>
              <span className="text-sm text-gray-400">Freezer</span>
            </div>

            {/* TV Modern */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-12 h-12 icon-neon">
                <rect x="2" y="4" width="20" height="14" rx="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="18" x2="12" y2="21"/>
              </svg>
              <span className="text-sm text-gray-400">TV</span>
            </div>

            {/* TV Retro */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-12 h-12 icon-neon">
                <rect x="4" y="7" width="16" height="13" rx="2"/>
                <polyline points="8 7 12 3 16 7"/>
              </svg>
              <span className="text-sm text-gray-400">TV Retro</span>
            </div>

          </div>
        </section>

        {/* Appliance Icons — Thinner (1.5) Comparison */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-orange-400/70 mb-2">Appliance Icons — Thinner (1.5 stroke)</h2>
          <p className="text-gray-500 text-sm mb-6">Compare to the 1.75 stroke above.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
            
            {/* Refrigerator */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-12 h-12 icon-neon-thin">
                <rect x="6" y="2" width="12" height="20" rx="2"/>
                <line x1="6" y1="10" x2="18" y2="10"/>
                <line x1="10" y1="5" x2="10" y2="8"/>
                <line x1="10" y1="13" x2="10" y2="16"/>
              </svg>
              <span className="text-sm text-gray-400">Fridge</span>
            </div>

            {/* Washer */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-12 h-12 icon-neon-thin">
                <rect x="4" y="2" width="16" height="20" rx="2"/>
                <circle cx="12" cy="13" r="5"/>
                <circle cx="12" cy="13" r="2"/>
                <circle cx="8" y1="6" r="1"/>
              </svg>
              <span className="text-sm text-gray-400">Washer</span>
            </div>

            {/* Dryer */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-12 h-12 icon-neon-thin">
                <rect x="4" y="2" width="16" height="20" rx="2"/>
                <circle cx="12" cy="13" r="5"/>
                <path d="M10 11a2 2 0 0 0 4 0"/>
                <circle cx="8" cy="6" r="1"/>
              </svg>
              <span className="text-sm text-gray-400">Dryer</span>
            </div>

            {/* Oven */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-12 h-12 icon-neon-thin">
                <rect x="4" y="2" width="16" height="20" rx="2"/>
                <rect x="6" y="10" width="12" height="9" rx="1"/>
                <line x1="7" y1="6" x2="7" y2="6"/>
                <line x1="10" y1="6" x2="10" y2="6"/>
                <line x1="13" y1="6" x2="13" y2="6"/>
                <line x1="16" y1="6" x2="16" y2="6"/>
              </svg>
              <span className="text-sm text-gray-400">Oven</span>
            </div>

            {/* Dishwasher */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-12 h-12 icon-neon-thin">
                <rect x="4" y="2" width="16" height="20" rx="2"/>
                <line x1="4" y1="8" x2="20" y2="8"/>
                <line x1="9" y1="5" x2="15" y2="5"/>
              </svg>
              <span className="text-sm text-gray-400">Dishwasher</span>
            </div>

            {/* Microwave */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-12 h-12 icon-neon-thin">
                <rect x="2" y="6" width="20" height="12" rx="2"/>
                <rect x="4" y="8" width="12" height="8"/>
                <line x1="18" y1="10" x2="18" y2="10"/>
                <line x1="18" y1="12" x2="18" y2="12"/>
                <line x1="18" y1="14" x2="18" y2="14"/>
              </svg>
              <span className="text-sm text-gray-400">Microwave</span>
            </div>

            {/* Freezer */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-12 h-12 icon-neon-thin">
                <rect x="3" y="6" width="18" height="14" rx="2"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
                <line x1="12" y1="6" x2="12" y2="10"/>
              </svg>
              <span className="text-sm text-gray-400">Freezer</span>
            </div>

            {/* TV Modern */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-12 h-12 icon-neon-thin">
                <rect x="2" y="4" width="20" height="14" rx="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="18" x2="12" y2="21"/>
              </svg>
              <span className="text-sm text-gray-400">TV</span>
            </div>

            {/* TV Retro */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-12 h-12 icon-neon-thin">
                <rect x="4" y="7" width="16" height="13" rx="2"/>
                <polyline points="8 7 12 3 16 7"/>
              </svg>
              <span className="text-sm text-gray-400">TV Retro</span>
            </div>

          </div>
        </section>

        {/* Status Icons */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-green-400 mb-6">Status Icons</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            
            {/* Check */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-10 h-10 icon-neon">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="9 12 12 15 16 9"/>
              </svg>
              <span className="text-sm text-gray-400">Check</span>
            </div>

            {/* Progress */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-10 h-10 icon-orange">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 2a10 10 0 0 1 10 10" strokeWidth="2.5"/>
              </svg>
              <span className="text-sm text-gray-400">Progress</span>
            </div>

            {/* Warning */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-10 h-10 icon-orange">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span className="text-sm text-gray-400">Warning</span>
            </div>

            {/* Error */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-10 h-10" style={{ stroke: '#ef4444', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', filter: 'drop-shadow(0 0 6px rgba(239,68,68,0.6))' }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              <span className="text-sm text-gray-400">Error</span>
            </div>

            {/* Info */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-10 h-10 icon-neon">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              <span className="text-sm text-gray-400">Info</span>
            </div>

            {/* Clock */}
            <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10">
              <svg viewBox="0 0 24 24" className="w-10 h-10 icon-neon">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <span className="text-sm text-gray-400">Clock</span>
            </div>

          </div>
        </section>

        {/* Size Comparison */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-purple-400 mb-6">Size Comparison</h2>
          <div className="flex items-end gap-8 p-6 rounded-2xl bg-white/5 border border-white/10">
            
            <div className="text-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6 icon-neon mx-auto">
                <rect x="6" y="2" width="12" height="20" rx="2"/>
                <line x1="6" y1="10" x2="18" y2="10"/>
              </svg>
              <span className="text-xs text-gray-500 mt-2 block">24px</span>
            </div>

            <div className="text-center">
              <svg viewBox="0 0 24 24" className="w-8 h-8 icon-neon mx-auto">
                <rect x="6" y="2" width="12" height="20" rx="2"/>
                <line x1="6" y1="10" x2="18" y2="10"/>
              </svg>
              <span className="text-xs text-gray-500 mt-2 block">32px</span>
            </div>

            <div className="text-center">
              <svg viewBox="0 0 24 24" className="w-10 h-10 icon-neon mx-auto">
                <rect x="6" y="2" width="12" height="20" rx="2"/>
                <line x1="6" y1="10" x2="18" y2="10"/>
              </svg>
              <span className="text-xs text-gray-500 mt-2 block">40px</span>
            </div>

            <div className="text-center">
              <svg viewBox="0 0 24 24" className="w-12 h-12 icon-neon mx-auto">
                <rect x="6" y="2" width="12" height="20" rx="2"/>
                <line x1="6" y1="10" x2="18" y2="10"/>
              </svg>
              <span className="text-xs text-gray-500 mt-2 block">48px</span>
            </div>

            <div className="text-center">
              <svg viewBox="0 0 24 24" className="w-16 h-16 icon-neon mx-auto">
                <rect x="6" y="2" width="12" height="20" rx="2"/>
                <line x1="6" y1="10" x2="18" y2="10"/>
              </svg>
              <span className="text-xs text-gray-500 mt-2 block">64px</span>
            </div>

            <div className="text-center">
              <svg viewBox="0 0 24 24" className="w-20 h-20 icon-neon mx-auto">
                <rect x="6" y="2" width="12" height="20" rx="2"/>
                <line x1="6" y1="10" x2="18" y2="10"/>
              </svg>
              <span className="text-xs text-gray-500 mt-2 block">80px</span>
            </div>

          </div>
        </section>

        {/* Design System Info */}
        <section className="p-6 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-orange-500/10 border border-white/10">
          <h2 className="text-xl font-semibold text-white mb-4">Design System Specs</h2>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <h3 className="text-cyan-400 font-medium mb-2">Cyan Icons (Default)</h3>
              <code className="block bg-black/30 p-3 rounded-lg text-gray-300">
                stroke: #00D4FF<br/>
                stroke-width: 1.75<br/>
                fill: none<br/>
                filter: drop-shadow(0 0 6px #00D4FF66)
              </code>
            </div>
            <div>
              <h3 className="text-orange-400 font-medium mb-2">Orange Icons (Accent)</h3>
              <code className="block bg-black/30 p-3 rounded-lg text-gray-300">
                stroke: #FF7A00<br/>
                stroke-width: 1.75<br/>
                fill: none<br/>
                filter: drop-shadow(0 0 6px #FF7A0066)
              </code>
            </div>
          </div>
        </section>

        {/* ——— Below: additive “Neon Lab” — same page only; does not change sections above ——— */}
        <div className="icon-test-neon-lab mt-16 pt-16 border-t border-white/15">
          <h2 className="text-2xl font-bold mb-2 text-white">Neon Lab (layered CSS)</h2>
          <p className="text-gray-400 mb-8 max-w-3xl">
            Compare to the sections above: those bake <code className="text-cyan-300/90">filter</code> on the SVG.
            Here the stroke stays on the icon; glow, pulse, and hover/active live on wrappers—no glow baked into the asset.
          </p>

          <section className="mb-12">
            <h3 className="text-lg font-semibold text-cyan-300 mb-4">A vs B — same calendar glyph</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-4">A — Original page style (glow on SVG)</p>
                <div className="flex justify-center py-8">
                  <svg viewBox="0 0 24 24" className="w-16 h-16 icon-neon" aria-hidden>
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                    <line x1="8" y1="3" x2="8" y2="7" />
                    <line x1="16" y1="3" x2="16" y2="7" />
                  </svg>
                </div>
              </div>
              <div className="p-6 rounded-2xl bg-white/5 border border-cyan-500/20">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-4">B — Layered (clean stroke + wrapper glow)</p>
                <div className="flex justify-center py-8">
                  <IconWrapper hover breathe={false}>
                    <svg viewBox="0 0 24 24" className="w-16 h-16" aria-hidden>
                      <rect x="3" y="5" width="18" height="16" rx="2" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                      <line x1="8" y1="3" x2="8" y2="7" />
                      <line x1="16" y1="3" x2="16" y2="7" />
                    </svg>
                  </IconWrapper>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h3 className="text-lg font-semibold text-cyan-300 mb-4">Interaction demos (hover / active / breathe)</h3>
            <div className="flex flex-wrap gap-8 items-end justify-center p-8 rounded-2xl bg-white/5 border border-white/10">
              <div className="text-center">
                <IconWrapper hover>
                  <svg viewBox="0 0 24 24" className="w-10 h-10" aria-hidden>
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                </IconWrapper>
                <span className="text-xs text-gray-500 mt-3 block">Hover</span>
              </div>
              <div className="text-center">
                <IconWrapper active hover={false}>
                  <svg viewBox="0 0 24 24" className="w-12 h-12" aria-hidden>
                    <rect x="4" y="3" width="16" height="18" rx="2" />
                    <circle cx="12" cy="13" r="4" />
                    <line x1="8" y1="6" x2="16" y2="6" />
                  </svg>
                </IconWrapper>
                <span className="text-xs text-gray-500 mt-3 block">Active</span>
              </div>
              <div className="text-center">
                <IconWrapper breathe hover={false}>
                  <svg viewBox="0 0 24 24" className="w-16 h-16" aria-hidden>
                    <rect x="6" y="2" width="12" height="20" rx="2" />
                    <line x1="6" y1="12" x2="18" y2="12" />
                    <line x1="10" y1="6" x2="10" y2="10" />
                  </svg>
                </IconWrapper>
                <span className="text-xs text-gray-500 mt-3 block">Breathe</span>
              </div>
              <div className="text-center">
                <IconWrapper variant="orange" breathe hover={false}>
                  <svg viewBox="0 0 24 24" className="w-10 h-10" aria-hidden>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                </IconWrapper>
                <span className="text-xs text-gray-500 mt-3 block">Orange + breathe</span>
              </div>
              <div className="text-center">
                <IconWrapper status="success" hover={false}>
                  <svg viewBox="0 0 24 24" className="w-10 h-10" aria-hidden>
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="9 12 12 15 16 9" />
                  </svg>
                </IconWrapper>
                <span className="text-xs text-gray-500 mt-3 block">Completed</span>
              </div>
              <div className="text-center">
                <IconWrapper status="warning" hover={false}>
                  <svg viewBox="0 0 24 24" className="w-10 h-10" aria-hidden>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </IconWrapper>
                <span className="text-xs text-gray-500 mt-3 block">In progress</span>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h3 className="text-lg font-semibold text-orange-300 mb-2">Starter pack paths (exact copy — layered only)</h3>
            <p className="text-gray-500 text-sm mb-6">Same line art as your production pack; shown only in the new system.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[
                { label: 'Calendar', svg: (
                  <>
                    <rect x="3" y="5" width="18" height="16" rx="2" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                    <line x1="8" y1="3" x2="8" y2="7" />
                    <line x1="16" y1="3" x2="16" y2="7" />
                  </>
                ) },
                { label: 'Wrench (pack)', svg: (
                  <path d="M14 7a4 4 0 0 0 5 5l-9 9-3-3 9-9a4 4 0 0 0-2-7z" />
                ) },
                { label: 'Invoice', svg: (
                  <>
                    <rect x="4" y="3" width="16" height="18" rx="2" />
                    <line x1="8" y1="8" x2="16" y2="8" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                    <text x="9" y="17" fontSize="6" fill="none" strokeWidth="1.75">
                      $
                    </text>
                  </>
                ) },
                { label: 'Warranty', svg: (
                  <>
                    <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />
                    <polyline points="9 12 11 14 15 10" />
                  </>
                ) },
                { label: 'Messages', svg: (
                  <>
                    <rect x="3" y="5" width="18" height="12" rx="2" />
                    <polyline points="7 17 7 21 12 17" />
                  </>
                ) },
                { label: 'Settings', svg: (
                  <>
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1-2 3.5-.2-.1a1 1 0 0 0-1.1.2l-.2.2a1 1 0 0 0-.3.8v.2H8v-.2a1 1 0 0 0-.3-.8l-.2-.2a1 1 0 0 0-1.1-.2l-.2.1-2-3.5.1-.1a1 1 0 0 0 .2-1.1l-.1-.2a1 1 0 0 0-.8-.3H3v-4h.2a1 1 0 0 0 .8-.3l.1-.2a1 1 0 0 0-.2-1.1l-.1-.1 2-3.5.2.1a1 1 0 0 0 1.1-.2l.2-.2a1 1 0 0 0 .3-.8V3h8v.2a1 1 0 0 0 .3.8l.2.2a1 1 0 0 0 1.1.2l.2-.1 2 3.5-.1.1a1 1 0 0 0-.2 1.1l.1.2a1 1 0 0 0 .8.3H21v4h-.2a1 1 0 0 0-.8.3z" />
                  </>
                ) },
                { label: 'Fridge', svg: (
                  <>
                    <rect x="6" y="2" width="12" height="20" rx="2" />
                    <line x1="6" y1="12" x2="18" y2="12" />
                    <line x1="10" y1="6" x2="10" y2="10" />
                  </>
                ) },
                { label: 'Washer', svg: (
                  <>
                    <rect x="4" y="3" width="16" height="18" rx="2" />
                    <circle cx="12" cy="13" r="4" />
                    <line x1="8" y1="6" x2="8" y2="6" />
                  </>
                ) },
                { label: 'Oven', svg: (
                  <>
                    <rect x="4" y="3" width="16" height="18" rx="2" />
                    <rect x="7" y="10" width="10" height="7" />
                    <line x1="6" y1="6" x2="6" y2="6" />
                    <line x1="10" y1="6" x2="10" y2="6" />
                  </>
                ) },
                { label: 'Dishwasher', svg: (
                  <>
                    <rect x="5" y="3" width="14" height="18" rx="2" />
                    <line x1="7" y1="7" x2="17" y2="7" />
                  </>
                ) },
                { label: 'Chest freezer', svg: (
                  <>
                    <rect x="3" y="8" width="18" height="10" rx="2" />
                    <line x1="3" y1="8" x2="21" y2="8" />
                  </>
                ) },
                { label: 'TV modern', svg: (
                  <>
                    <rect x="3" y="5" width="18" height="12" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                  </>
                ) },
                { label: 'TV retro', svg: (
                  <>
                    <rect x="5" y="6" width="14" height="10" rx="2" />
                    <line x1="9" y1="2" x2="12" y2="6" />
                    <line x1="15" y1="2" x2="12" y2="6" />
                  </>
                ) },
                { label: 'Check', svg: (
                  <>
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="8 12 11 15 16 9" />
                  </>
                ) },
                { label: 'Progress', svg: (
                  <>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </>
                ), variant: 'orange' },
              ].map(({ label, svg, variant: v }) => (
                <div key={label} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/[0.04] border border-white/10">
                  <IconWrapper hover variant={v || 'blue'}>
                    <svg viewBox="0 0 24 24" className="w-9 h-9" aria-hidden>
                      {svg}
                    </svg>
                  </IconWrapper>
                  <span className="text-xs text-gray-500 text-center leading-tight">{label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-8">
            <h3 className="text-lg font-semibold text-purple-300 mb-4">Extra icons (new — layered only)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[
                {
                  label: 'Search',
                  svg: (
                    <>
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </>
                  ),
                },
                {
                  label: 'Map pin',
                  svg: (
                    <>
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </>
                  ),
                },
                {
                  label: 'Truck',
                  svg: (
                    <>
                      <rect x="1" y="3" width="15" height="13" rx="1" />
                      <path d="M16 8h4l3 3v4h-7V8z" />
                      <circle cx="5.5" cy="18.5" r="2.5" />
                      <circle cx="18.5" cy="18.5" r="2.5" />
                    </>
                  ),
                },
                {
                  label: 'Clipboard',
                  svg: (
                    <>
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                      <rect x="8" y="2" width="8" height="4" rx="1" />
                      <line x1="9" y1="12" x2="15" y2="12" />
                      <line x1="9" y1="16" x2="15" y2="16" />
                    </>
                  ),
                },
                {
                  label: 'Credit card',
                  svg: (
                    <>
                      <rect x="1" y="4" width="22" height="16" rx="2" />
                      <line x1="1" y1="10" x2="23" y2="10" />
                      <line x1="5" y1="15" x2="9" y2="15" />
                    </>
                  ),
                },
                {
                  label: 'Download',
                  svg: (
                    <>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </>
                  ),
                },
                {
                  label: 'Zap / urgent',
                  svg: (
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  ),
                },
                {
                  label: 'Thermometer',
                  svg: (
                    <>
                      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
                      <line x1="10" y1="9" x2="10" y2="5" />
                      <line x1="10" y1="13" x2="10" y2="11" />
                    </>
                  ),
                },
              ].map(({ label, svg }) => (
                <div key={label} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/[0.04] border border-white/10">
                  <IconWrapper hover>
                    <svg viewBox="0 0 24 24" className="w-9 h-9" aria-hidden>
                      {svg}
                    </svg>
                  </IconWrapper>
                  <span className="text-xs text-gray-500 text-center">{label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ——— ELITE UI SYSTEM ——— */}
        <div className="elite-ui-lab mt-16 pt-16 border-t border-white/15 relative">
          {/* Ambient background glows */}
          <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-[radial-gradient(circle,rgba(0,212,255,0.12),transparent_70%)]" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[radial-gradient(circle,rgba(255,122,0,0.1),transparent_70%)]" />
          </div>

          <h2 className="text-2xl font-bold mb-2 text-white">Elite UI System</h2>
          <p className="text-gray-400 mb-10 max-w-3xl">
            Depth, motion hierarchy, sensory feedback. Glass cards, glow utilities, sweep effects, ambient pulse — all scoped to this page only.
          </p>

          {/* Glass Cards with Hover Lift */}
          <section className="mb-16">
            <h3 className="text-lg font-semibold text-cyan-300 mb-6">Glass Cards + Hover Lift</h3>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: (
                  <>
                    <rect x="6" y="2" width="12" height="20" rx="2" />
                    <line x1="6" y1="10" x2="18" y2="10" />
                    <line x1="10" y1="5" x2="10" y2="8" />
                  </>
                ), title: 'Refrigerator Repair', desc: 'Not cooling? Leaking? We fix it fast.' },
                { icon: (
                  <>
                    <rect x="4" y="2" width="16" height="20" rx="2" />
                    <circle cx="12" cy="13" r="5" />
                    <circle cx="12" cy="13" r="2" />
                  </>
                ), title: 'Washer Repair', desc: 'Drain issues, spin problems, we handle it.' },
                { icon: (
                  <>
                    <rect x="4" y="2" width="16" height="20" rx="2" />
                    <rect x="6" y="10" width="12" height="9" rx="1" />
                    <line x1="7" y1="6" x2="7" y2="6" />
                    <line x1="10" y1="6" x2="10" y2="6" />
                  </>
                ), title: 'Oven Repair', desc: 'Not heating? Uneven cooking? Fixed.' },
              ].map(({ icon, title, desc }, i) => (
                <div
                  key={i}
                  className="elite-glass-card elite-hover-lift elite-glow-sweep rounded-2xl p-6 relative overflow-hidden"
                >
                  {/* Gradient overlay on hover */}
                  <div className="absolute inset-0 opacity-0 elite-gradient-overlay transition-opacity duration-500 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-transparent blur-xl" />
                  </div>

                  {/* Icon wrapper */}
                  <div className="elite-icon-wrap w-14 h-14 rounded-xl flex items-center justify-center mb-4 relative z-10">
                    <svg viewBox="0 0 24 24" className="w-8 h-8 elite-icon-stroke" aria-hidden>
                      {icon}
                    </svg>
                  </div>

                  <h4 className="text-white text-lg font-semibold mb-1 relative z-10">{title}</h4>
                  <p className="text-gray-400 text-sm relative z-10">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Button System */}
          <section className="mb-16">
            <h3 className="text-lg font-semibold text-cyan-300 mb-6">Button System</h3>
            <div className="flex flex-wrap gap-6 items-center">
              <button className="elite-btn-blue px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300">
                Book Service
              </button>
              <button className="elite-btn-orange px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300">
                Confirm Appointment
              </button>
              <button className="elite-btn-outline px-6 py-3 rounded-xl font-semibold transition-all duration-300">
                Learn More
              </button>
              <button className="elite-btn-ghost px-6 py-3 rounded-xl font-semibold transition-all duration-300">
                Cancel
              </button>
            </div>
          </section>

          {/* Icon Wrapper System */}
          <section className="mb-16">
            <h3 className="text-lg font-semibold text-cyan-300 mb-6">Icon Wrapper System</h3>
            <p className="text-gray-500 text-sm mb-6">Background + border + hover glow — icons feel tangible.</p>
            <div className="flex flex-wrap gap-4">
              {[
                (<><rect x="6" y="2" width="12" height="20" rx="2" /><line x1="6" y1="10" x2="18" y2="10" /></>),
                (<><rect x="4" y="2" width="16" height="20" rx="2" /><circle cx="12" cy="13" r="5" /></>),
                (<><rect x="4" y="2" width="16" height="20" rx="2" /><rect x="6" y="10" width="12" height="9" rx="1" /></>),
                (<><rect x="5" y="3" width="14" height="18" rx="2" /><line x1="7" y1="7" x2="17" y2="7" /></>),
                (<><rect x="2" y="4" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="18" x2="12" y2="21" /></>),
                (<><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></>),
              ].map((icon, i) => (
                <div key={i} className="elite-icon-wrap-standalone p-4 rounded-xl transition-all duration-300">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 elite-icon-stroke" aria-hidden>
                    {icon}
                  </svg>
                </div>
              ))}
            </div>
          </section>

          {/* Step Indicator */}
          <section className="mb-16">
            <h3 className="text-lg font-semibold text-cyan-300 mb-6">Step Indicator</h3>
            <div className="flex items-center gap-4">
              {[1, 2, 3, 4, 5].map((step, i) => (
                <div
                  key={i}
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                    transition-all duration-300
                    ${i === 1
                      ? 'elite-step-active text-white'
                      : i < 1
                        ? 'elite-step-done text-cyan-300'
                        : 'elite-step-pending text-gray-500'
                    }
                  `}
                >
                  {i < 1 ? (
                    <svg viewBox="0 0 24 24" className="w-5 h-5 elite-icon-stroke">
                      <polyline points="9 12 12 15 16 9" />
                    </svg>
                  ) : (
                    step
                  )}
                </div>
              ))}
            </div>
            <p className="text-gray-500 text-xs mt-4">Step 2 is active, step 1 completed, rest pending.</p>
          </section>

          {/* Ambient Pulse */}
          <section className="mb-16">
            <h3 className="text-lg font-semibold text-cyan-300 mb-6">Ambient Pulse</h3>
            <p className="text-gray-500 text-sm mb-6">Subtle animation draws the eye — use sparingly on hero elements.</p>
            <div className="flex flex-wrap gap-8 items-center">
              <div className="elite-ambient-pulse-blue w-20 h-20 rounded-2xl flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-10 h-10 elite-icon-stroke" aria-hidden>
                  <rect x="6" y="2" width="12" height="20" rx="2" />
                  <line x1="6" y1="10" x2="18" y2="10" />
                </svg>
              </div>
              <div className="elite-ambient-pulse-orange w-20 h-20 rounded-2xl flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-10 h-10 elite-icon-stroke-orange" aria-hidden>
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
            </div>
          </section>

          {/* Glow Sweep Effect */}
          <section className="mb-16">
            <h3 className="text-lg font-semibold text-cyan-300 mb-6">Glow Sweep Effect</h3>
            <p className="text-gray-500 text-sm mb-6">Hover to see the sweep — premium micro-interaction.</p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="elite-glass-card elite-glow-sweep rounded-2xl p-8 relative overflow-hidden">
                <h4 className="text-white font-semibold mb-2">Hover this card</h4>
                <p className="text-gray-400 text-sm">Watch the light sweep across on hover.</p>
              </div>
              <button className="elite-btn-blue elite-glow-sweep-btn px-8 py-4 rounded-xl font-semibold text-white transition-all duration-300 relative overflow-hidden">
                Hover this button
              </button>
            </div>
          </section>

          {/* Text Glow */}
          <section className="mb-16">
            <h3 className="text-lg font-semibold text-cyan-300 mb-6">Text Glow</h3>
            <div className="flex flex-wrap gap-8 items-baseline">
              <span className="text-3xl font-bold elite-text-neon-blue">Quantum</span>
              <span className="text-3xl font-bold elite-text-neon-orange">Repair</span>
              <span className="text-xl font-semibold elite-text-neon-blue">$89</span>
              <span className="text-sm elite-text-neon-orange uppercase tracking-widest">Priority</span>
            </div>
          </section>

          {/* Full Card Example */}
          <section className="mb-8">
            <h3 className="text-lg font-semibold text-cyan-300 mb-6">Full Premium Card</h3>
            <div className="max-w-md">
              <div className="elite-glass-card elite-hover-lift elite-glow-sweep rounded-2xl p-8 relative overflow-hidden">
                {/* Ambient glow */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

                {/* Icon */}
                <div className="elite-icon-wrap w-16 h-16 rounded-xl flex items-center justify-center mb-5 relative z-10">
                  <svg viewBox="0 0 24 24" className="w-9 h-9 elite-icon-stroke" aria-hidden>
                    <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                </div>

                {/* Content */}
                <h4 className="text-xl font-bold text-white mb-2 relative z-10">90-Day Warranty</h4>
                <p className="text-gray-400 text-sm mb-6 relative z-10 leading-relaxed">
                  Every repair backed by our guarantee. If it breaks again within 90 days, we fix it free.
                </p>

                {/* CTA */}
                <button className="elite-btn-blue px-5 py-2.5 rounded-lg font-medium text-white text-sm transition-all duration-300 relative z-10">
                  Learn More
                </button>
              </div>
            </div>
          </section>
        </div>

      </div>

      <style jsx>{`
        .icon-neon {
          stroke: #00D4FF;
          stroke-width: 1.75;
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          filter: drop-shadow(0 0 6px rgba(0, 212, 255, 0.6));
        }
        .icon-orange {
          stroke: #FF7A00;
          stroke-width: 1.75;
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          filter: drop-shadow(0 0 6px rgba(255, 122, 0, 0.6));
        }
        .icon-neon-thin {
          stroke: #00D4FF;
          stroke-width: 1.5;
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          filter: drop-shadow(0 0 6px rgba(0, 212, 255, 0.6));
        }
      `}</style>

      <style jsx global>{`
        .icon-test-neon-lab {
          --neon-blue: #00d4ff;
          --neon-orange: #ff7a00;
        }

        /* Base icon: clean stroke only (no filter) */
        .icon-test-neon-lab .neon-icon-base {
          stroke: var(--neon-blue);
          stroke-width: 1.75;
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          transition: stroke 0.25s ease;
        }

        .icon-test-neon-lab .neon-icon-base text {
          fill: none;
        }

        .icon-test-neon-lab .neon-icon-stroke-orange.neon-icon-base {
          stroke: var(--neon-orange);
        }

        .icon-test-neon-lab .neon-icon-stroke-success.neon-icon-base {
          stroke: #22c55e;
        }

        .icon-test-neon-lab .neon-icon-stroke-warning.neon-icon-base {
          stroke: var(--neon-orange);
        }

        /* Glow layer (wrapper) */
        .icon-test-neon-lab .neon-glow-layer {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: filter 0.25s ease, transform 0.25s ease;
        }

        .icon-test-neon-lab .neon-glow {
          filter: drop-shadow(0 0 2px rgba(0, 212, 255, 0.8))
            drop-shadow(0 0 6px rgba(0, 212, 255, 0.6))
            drop-shadow(0 0 12px rgba(0, 212, 255, 0.4));
        }

        .icon-test-neon-lab .neon-glow-orange {
          filter: drop-shadow(0 0 2px rgba(255, 122, 0, 0.9))
            drop-shadow(0 0 8px rgba(255, 122, 0, 0.6))
            drop-shadow(0 0 16px rgba(255, 122, 0, 0.4));
        }

        .icon-test-neon-lab .neon-glow-success {
          filter: drop-shadow(0 0 4px rgba(34, 197, 94, 0.85))
            drop-shadow(0 0 10px rgba(34, 197, 94, 0.8));
        }

        .icon-test-neon-lab .neon-glow-warning {
          filter: drop-shadow(0 0 4px rgba(255, 122, 0, 0.95))
            drop-shadow(0 0 14px rgba(255, 122, 0, 0.9));
        }

        @keyframes icon-test-neon-breathe-cyan {
          0%,
          100% {
            filter: drop-shadow(0 0 2px rgba(0, 212, 255, 0.6))
              drop-shadow(0 0 6px rgba(0, 212, 255, 0.4));
          }
          50% {
            filter: drop-shadow(0 0 4px rgba(0, 212, 255, 1))
              drop-shadow(0 0 12px rgba(0, 212, 255, 0.8));
          }
        }

        @keyframes icon-test-neon-breathe-orange {
          0%,
          100% {
            filter: drop-shadow(0 0 2px rgba(255, 122, 0, 0.6))
              drop-shadow(0 0 8px rgba(255, 122, 0, 0.45));
          }
          50% {
            filter: drop-shadow(0 0 5px rgba(255, 122, 0, 1))
              drop-shadow(0 0 14px rgba(255, 122, 0, 0.85));
          }
        }

        .icon-test-neon-lab .neon-breathe-target .neon-glow-layer.neon-glow {
          animation: icon-test-neon-breathe-cyan 3s ease-in-out infinite;
        }

        .icon-test-neon-lab .neon-breathe-target .neon-glow-layer.neon-glow-orange {
          animation: icon-test-neon-breathe-orange 3s ease-in-out infinite;
        }

        /* Hover: scale outer + brighten stroke + stronger glow */
        .icon-test-neon-lab .neon-hover-target:hover {
          transform: scale(1.08);
        }

        .icon-test-neon-lab .neon-hover-target:hover .neon-icon-base:not(.neon-icon-stroke-orange):not(.neon-icon-stroke-success):not(.neon-icon-stroke-warning) {
          stroke: #66e6ff;
        }

        .icon-test-neon-lab .neon-hover-target:hover .neon-glow-layer.neon-glow {
          filter: drop-shadow(0 0 4px rgba(0, 212, 255, 1))
            drop-shadow(0 0 14px rgba(0, 212, 255, 0.9))
            drop-shadow(0 0 24px rgba(0, 212, 255, 0.6));
        }

        .icon-test-neon-lab .neon-hover-target:hover .neon-glow-layer.neon-glow-orange {
          filter: drop-shadow(0 0 4px rgba(255, 122, 0, 1))
            drop-shadow(0 0 16px rgba(255, 122, 0, 0.95))
            drop-shadow(0 0 28px rgba(255, 122, 0, 0.65));
        }

        .icon-test-neon-lab .neon-hover-target:hover .neon-glow-success {
          filter: drop-shadow(0 0 6px rgba(34, 197, 94, 1))
            drop-shadow(0 0 16px rgba(34, 197, 94, 0.85));
        }

        .icon-test-neon-lab .neon-hover-target:hover .neon-glow-warning {
          filter: drop-shadow(0 0 6px rgba(255, 122, 0, 1))
            drop-shadow(0 0 20px rgba(255, 122, 0, 0.95));
        }

        /* Active / selected */
        .icon-test-neon-lab .neon-active-target {
          transform: scale(1.05);
        }

        .icon-test-neon-lab .neon-active-target .neon-icon-base:not(.neon-icon-stroke-orange):not(.neon-icon-stroke-success):not(.neon-icon-stroke-warning) {
          stroke: var(--neon-blue);
        }

        .icon-test-neon-lab .neon-active-target .neon-glow-layer.neon-glow {
          filter: drop-shadow(0 0 6px rgba(0, 212, 255, 1))
            drop-shadow(0 0 16px rgba(0, 212, 255, 0.9))
            drop-shadow(0 0 32px rgba(0, 212, 255, 0.7));
        }

        /* ============================================
           ELITE UI SYSTEM — scoped to .elite-ui-lab
           ============================================ */

        .elite-ui-lab {
          --elite-blue: #00d4ff;
          --elite-blue-soft: rgba(0, 212, 255, 0.35);
          --elite-orange: #ff7a00;
          --elite-orange-soft: rgba(255, 122, 0, 0.35);
        }

        /* --- Glass Card --- */
        .elite-ui-lab .elite-glass-card {
          background: rgba(10, 20, 40, 0.6);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(0, 212, 255, 0.15);
          transition: all 0.35s ease;
        }

        .elite-ui-lab .elite-glass-card:hover {
          border-color: rgba(0, 212, 255, 0.35);
          box-shadow:
            0 0 5px var(--elite-blue),
            0 0 15px var(--elite-blue-soft),
            0 0 30px rgba(0, 212, 255, 0.2);
        }

        .elite-ui-lab .elite-glass-card:hover .elite-gradient-overlay {
          opacity: 1;
        }

        /* --- Hover Lift --- */
        .elite-ui-lab .elite-hover-lift {
          transition: transform 0.35s ease, box-shadow 0.35s ease;
        }

        .elite-ui-lab .elite-hover-lift:hover {
          transform: translateY(-6px) scale(1.02);
        }

        /* --- Icon Stroke (base) --- */
        .elite-ui-lab .elite-icon-stroke {
          stroke: var(--elite-blue);
          stroke-width: 1.75;
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .elite-ui-lab .elite-icon-stroke-orange {
          stroke: var(--elite-orange);
          stroke-width: 1.75;
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        /* --- Icon Wrapper (inside cards) --- */
        .elite-ui-lab .elite-icon-wrap {
          background: rgba(0, 212, 255, 0.1);
          border: 1px solid rgba(0, 212, 255, 0.2);
          transition: all 0.3s ease;
        }

        .elite-ui-lab .elite-glass-card:hover .elite-icon-wrap {
          background: rgba(0, 212, 255, 0.18);
          box-shadow:
            0 0 8px var(--elite-blue),
            0 0 20px var(--elite-blue-soft);
        }

        /* --- Icon Wrapper Standalone --- */
        .elite-ui-lab .elite-icon-wrap-standalone {
          background: rgba(0, 212, 255, 0.1);
          border: 1px solid rgba(0, 212, 255, 0.2);
        }

        .elite-ui-lab .elite-icon-wrap-standalone:hover {
          background: rgba(0, 212, 255, 0.2);
          box-shadow:
            0 0 5px var(--elite-blue),
            0 0 15px var(--elite-blue-soft),
            0 0 30px rgba(0, 212, 255, 0.2);
        }

        /* --- Buttons --- */
        .elite-ui-lab .elite-btn-blue {
          background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%);
        }

        .elite-ui-lab .elite-btn-blue:hover {
          transform: scale(1.05);
          box-shadow: 0 0 25px rgba(0, 212, 255, 0.6);
        }

        .elite-ui-lab .elite-btn-blue:active {
          transform: scale(0.95);
        }

        .elite-ui-lab .elite-btn-orange {
          background: linear-gradient(135deg, #f97316 0%, #fbbf24 100%);
        }

        .elite-ui-lab .elite-btn-orange:hover {
          transform: scale(1.05);
          box-shadow: 0 0 25px rgba(255, 122, 0, 0.6);
        }

        .elite-ui-lab .elite-btn-orange:active {
          transform: scale(0.95);
        }

        .elite-ui-lab .elite-btn-outline {
          background: transparent;
          border: 1px solid rgba(0, 212, 255, 0.4);
          color: var(--elite-blue);
        }

        .elite-ui-lab .elite-btn-outline:hover {
          background: rgba(0, 212, 255, 0.1);
          border-color: var(--elite-blue);
          box-shadow: 0 0 15px var(--elite-blue-soft);
        }

        .elite-ui-lab .elite-btn-ghost {
          background: transparent;
          color: #9ca3af;
        }

        .elite-ui-lab .elite-btn-ghost:hover {
          color: #e5e7eb;
          background: rgba(255, 255, 255, 0.05);
        }

        /* --- Step Indicator --- */
        .elite-ui-lab .elite-step-active {
          background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%);
          box-shadow:
            0 0 5px var(--elite-blue),
            0 0 15px var(--elite-blue-soft),
            0 0 30px rgba(0, 212, 255, 0.2);
        }

        .elite-ui-lab .elite-step-done {
          background: rgba(0, 212, 255, 0.15);
          border: 1px solid rgba(0, 212, 255, 0.4);
        }

        .elite-ui-lab .elite-step-pending {
          background: rgba(55, 65, 81, 0.5);
          border: 1px solid rgba(75, 85, 99, 0.5);
        }

        /* --- Ambient Pulse --- */
        @keyframes elite-pulse-blue {
          0%, 100% {
            box-shadow: 0 0 10px rgba(0, 212, 255, 0.2);
          }
          50% {
            box-shadow: 0 0 25px rgba(0, 212, 255, 0.6);
          }
        }

        @keyframes elite-pulse-orange {
          0%, 100% {
            box-shadow: 0 0 10px rgba(255, 122, 0, 0.2);
          }
          50% {
            box-shadow: 0 0 25px rgba(255, 122, 0, 0.6);
          }
        }

        .elite-ui-lab .elite-ambient-pulse-blue {
          background: rgba(0, 212, 255, 0.1);
          border: 1px solid rgba(0, 212, 255, 0.25);
          animation: elite-pulse-blue 3s infinite ease-in-out;
        }

        .elite-ui-lab .elite-ambient-pulse-orange {
          background: rgba(255, 122, 0, 0.1);
          border: 1px solid rgba(255, 122, 0, 0.25);
          animation: elite-pulse-orange 3s infinite ease-in-out;
        }

        /* --- Glow Sweep (cards) --- */
        .elite-ui-lab .elite-glow-sweep::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            120deg,
            transparent 0%,
            rgba(0, 212, 255, 0.4) 50%,
            transparent 100%
          );
          opacity: 0;
          transform: translateX(-100%);
          transition: opacity 0.3s ease;
          pointer-events: none;
        }

        .elite-ui-lab .elite-glow-sweep:hover::after {
          opacity: 1;
          animation: elite-sweep 0.8s ease-out;
        }

        @keyframes elite-sweep {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(100%);
          }
        }

        /* --- Glow Sweep (buttons) --- */
        .elite-ui-lab .elite-glow-sweep-btn::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            120deg,
            transparent 0%,
            rgba(255, 255, 255, 0.3) 50%,
            transparent 100%
          );
          opacity: 0;
          transform: translateX(-100%);
          transition: opacity 0.3s ease;
          pointer-events: none;
        }

        .elite-ui-lab .elite-glow-sweep-btn:hover::after {
          opacity: 1;
          animation: elite-sweep 0.6s ease-out;
        }

        /* --- Text Glow --- */
        .elite-ui-lab .elite-text-neon-blue {
          color: var(--elite-blue);
          text-shadow:
            0 0 6px var(--elite-blue),
            0 0 12px var(--elite-blue-soft);
        }

        .elite-ui-lab .elite-text-neon-orange {
          color: var(--elite-orange);
          text-shadow:
            0 0 6px var(--elite-orange),
            0 0 12px var(--elite-orange-soft);
        }
      `}</style>
    </>
  );
}
