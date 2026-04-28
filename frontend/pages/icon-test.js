import Head from 'next/head';

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
                <path d="M12 2a10 10 0 0 1 10 10" strokeWidth="3"/>
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
              <svg viewBox="0 0 24 24" className="w-10 h-10" style={{ stroke: '#ef4444', strokeWidth: 2.25, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', filter: 'drop-shadow(0 0 6px rgba(239,68,68,0.6))' }}>
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
                stroke-width: 2.25<br/>
                fill: none<br/>
                filter: drop-shadow(0 0 6px #00D4FF66)
              </code>
            </div>
            <div>
              <h3 className="text-orange-400 font-medium mb-2">Orange Icons (Accent)</h3>
              <code className="block bg-black/30 p-3 rounded-lg text-gray-300">
                stroke: #FF7A00<br/>
                stroke-width: 2.25<br/>
                fill: none<br/>
                filter: drop-shadow(0 0 6px #FF7A0066)
              </code>
            </div>
          </div>
        </section>

      </div>

      <style jsx>{`
        .icon-neon {
          stroke: #00D4FF;
          stroke-width: 2.25;
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          filter: drop-shadow(0 0 6px rgba(0, 212, 255, 0.6));
        }
        .icon-orange {
          stroke: #FF7A00;
          stroke-width: 2.25;
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          filter: drop-shadow(0 0 6px rgba(255, 122, 0, 0.6));
        }
      `}</style>
    </>
  );
}
