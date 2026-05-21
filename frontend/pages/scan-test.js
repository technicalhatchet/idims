/**
 * /scan-test — isolated prototype, does NOT affect production.
 * Safe to delete when done.
 */
import { useState } from 'react';
import Head from 'next/head';

const SPEEDS = { slow: '7s', medium: '4s', fast: '2s' };

const COLORS = {
  orange: {
    label: 'Orange',
    sweep: 'rgba(255,122,0,0.25)',
    sweepCenter: 'rgba(255,122,0,0.45)',
    grid: 'rgba(255,122,0,0.05)',
    border: 'rgba(255,122,0,0.4)',
    glow: '0 0 40px rgba(255,122,0,0.15)',
    accent: '#FF7A00',
  },
  cyan: {
    label: 'Cyan',
    sweep: 'rgba(0,212,255,0.2)',
    sweepCenter: 'rgba(0,212,255,0.4)',
    grid: 'rgba(0,212,255,0.05)',
    border: 'rgba(0,212,255,0.4)',
    glow: '0 0 40px rgba(0,212,255,0.15)',
    accent: '#00D4FF',
  },
};

export default function ScanTest() {
  const [color, setColor]     = useState('orange');
  const [speed, setSpeed]     = useState('medium');
  const [width, setWidth]     = useState(80);
  const [opacity, setOpacity] = useState(100);
  const [logo, setLogo]       = useState('atomwrenches');
  const [gridOn, setGridOn]   = useState(true);
  const [paused, setPaused]   = useState(false);

  const c = COLORS[color];
  const dur = SPEEDS[speed];

  const scanStyle = {
    position: 'absolute',
    top: 0, bottom: 0, left: 0,
    width: `${width}px`,
    background: `linear-gradient(to right, transparent 0%, ${c.sweep} 30%, ${c.sweepCenter} 50%, ${c.sweep} 70%, transparent 100%)`,
    mixBlendMode: 'screen',
    opacity: opacity / 100,
    zIndex: 1,
    pointerEvents: 'none',
    animation: paused ? 'none' : `tacticalScan ${dur} ease-in-out infinite`,
  };

  const gridStyle = gridOn ? {
    backgroundImage: `linear-gradient(${c.grid} 1px, transparent 1px), linear-gradient(90deg, ${c.grid} 1px, transparent 1px)`,
    backgroundSize: '28px 28px',
  } : {};

  return (
    <>
      <Head>
        <title>Scan Line Test | IDIMS</title>
        <style>{`
          body { background: #000208; margin: 0; font-family: sans-serif; }
          @keyframes tacticalScan {
            0%   { transform: translateX(-${width * 1.5}px); }
            50%  { transform: translateX(100vw); }
            100% { transform: translateX(-${width * 1.5}px); }
          }
          .ctrl-btn {
            padding: 6px 14px; border-radius: 6px; font-size: 12px;
            cursor: pointer; border: 1px solid rgba(255,255,255,0.15);
            background: #0D1525; color: #ccc; transition: all 0.2s;
          }
          .ctrl-btn.active { border-color: var(--accent); color: var(--accent); box-shadow: 0 0 8px var(--accent-glow); }
          input[type=range] { accent-color: ${c.accent}; width: 100%; }
        `}</style>
      </Head>

      <div style={{ minHeight: '100vh', padding: '24px 16px', color: '#ccc' }}>
        <p style={{ color: '#444', fontSize: 11, marginBottom: 24, textAlign: 'center', letterSpacing: 2 }}>
          SCAN LINE TEST · /scan-test · does not affect production
        </p>

        {/* ── DEMO ── */}
        <div style={{
          position: 'relative', overflow: 'hidden', borderRadius: 16,
          border: `1px solid ${c.border}`, boxShadow: c.glow,
          background: '#080C14', height: 260, maxWidth: 400,
          margin: '0 auto 32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ position: 'absolute', inset: 0, ...gridStyle }} />
          <div style={scanStyle} />
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <img
              src={logo === 'atomwrenches' ? '/atomwrenches.png' : '/arpano.png'}
              alt="Logo"
              style={{ height: logo === 'atomwrenches' ? 80 : 48, width: 'auto', objectFit: 'contain', filter: `drop-shadow(0 0 12px ${c.accent}66)` }}
            />
            <p style={{ fontSize: 10, color: '#555', letterSpacing: 2, margin: 0 }}>ATOMIC REPAIR 419</p>
          </div>
          {/* Corner accents */}
          {[
            { top: 0, left: 0, borderTop: `1px solid ${c.accent}`, borderLeft: `1px solid ${c.accent}` },
            { top: 0, right: 0, borderTop: `1px solid ${c.accent}`, borderRight: `1px solid ${c.accent}` },
            { bottom: 0, left: 0, borderBottom: `1px solid ${c.accent}`, borderLeft: `1px solid ${c.accent}` },
            { bottom: 0, right: 0, borderBottom: `1px solid ${c.accent}`, borderRight: `1px solid ${c.accent}` },
          ].map((s, i) => (
            <div key={i} style={{ position: 'absolute', width: 16, height: 16, ...s }} />
          ))}
        </div>

        {/* ── CONTROLS ── */}
        <div style={{
          maxWidth: 400, margin: '0 auto', background: '#0A0F1E',
          borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)',
          padding: 20, display: 'flex', flexDirection: 'column', gap: 20,
        }}>
          {/* Color */}
          <div>
            <p style={{ fontSize: 11, color: '#555', marginBottom: 8, letterSpacing: 1 }}>COLOR</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {Object.keys(COLORS).map(k => (
                <button key={k} className={`ctrl-btn ${color === k ? 'active' : ''}`}
                  style={{ '--accent': COLORS[k].accent, '--accent-glow': COLORS[k].accent + '66' }}
                  onClick={() => setColor(k)}>{COLORS[k].label}</button>
              ))}
            </div>
          </div>
          {/* Logo */}
          <div>
            <p style={{ fontSize: 11, color: '#555', marginBottom: 8, letterSpacing: 1 }}>LOGO</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {['atomwrenches', 'arpano'].map(k => (
                <button key={k} className={`ctrl-btn ${logo === k ? 'active' : ''}`}
                  style={{ '--accent': c.accent, '--accent-glow': c.accent + '66' }}
                  onClick={() => setLogo(k)}>{k}</button>
              ))}
            </div>
          </div>
          {/* Speed */}
          <div>
            <p style={{ fontSize: 11, color: '#555', marginBottom: 8, letterSpacing: 1 }}>SPEED</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {Object.keys(SPEEDS).map(k => (
                <button key={k} className={`ctrl-btn ${speed === k ? 'active' : ''}`}
                  style={{ '--accent': c.accent, '--accent-glow': c.accent + '66' }}
                  onClick={() => setSpeed(k)}>{k}</button>
              ))}
            </div>
          </div>
          {/* Beam width */}
          <div>
            <p style={{ fontSize: 11, color: '#555', marginBottom: 8, letterSpacing: 1 }}>
              BEAM WIDTH — <span style={{ color: c.accent }}>{width}px</span>
            </p>
            <input type="range" min={20} max={200} value={width} onChange={e => setWidth(Number(e.target.value))} />
          </div>
          {/* Opacity */}
          <div>
            <p style={{ fontSize: 11, color: '#555', marginBottom: 8, letterSpacing: 1 }}>
              INTENSITY — <span style={{ color: c.accent }}>{opacity}%</span>
            </p>
            <input type="range" min={10} max={100} value={opacity} onChange={e => setOpacity(Number(e.target.value))} />
          </div>
          {/* Toggles */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`ctrl-btn ${gridOn ? 'active' : ''}`}
              style={{ '--accent': c.accent, '--accent-glow': c.accent + '66' }}
              onClick={() => setGridOn(g => !g)}>{gridOn ? 'Grid ON' : 'Grid OFF'}</button>
            <button className={`ctrl-btn ${paused ? 'active' : ''}`}
              style={{ '--accent': c.accent, '--accent-glow': c.accent + '66' }}
              onClick={() => setPaused(p => !p)}>{paused ? '▶ Resume' : '⏸ Pause'}</button>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 10, color: '#333', marginTop: 24 }}>
          Note your settings then ping Claude to apply them.
        </p>
      </div>
    </>
  );
}

ScanTest.getLayout = (page) => page;