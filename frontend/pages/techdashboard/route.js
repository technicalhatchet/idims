import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { format, isToday } from 'date-fns';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { apiClient } from '../../utils/api-client';

// ── Appliance Icons ───────────────────────────────────────────────────────
const APPLIANCE_ICONS = {
  refrigerator:   { color: 'cyan',   svg: '<rect x="6" y="2" width="12" height="20" rx="2"/><line x1="6" y1="10" x2="18" y2="10"/><line x1="10" y1="5" x2="10" y2="8"/><line x1="10" y1="13" x2="10" y2="16"/>' },
  fridge:         { color: 'cyan',   svg: '<rect x="6" y="2" width="12" height="20" rx="2"/><line x1="6" y1="10" x2="18" y2="10"/><line x1="10" y1="5" x2="10" y2="8"/><line x1="10" y1="13" x2="10" y2="16"/>' },
  washingmachine: { color: 'cyan',   svg: '<rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><circle cx="12" cy="13" r="2"/><circle cx="8" cy="6" r="1"/>' },
  washer:         { color: 'cyan',   svg: '<rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><circle cx="12" cy="13" r="2"/><circle cx="8" cy="6" r="1"/>' },
  dryer:          { color: 'orange', svg: '<rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><path d="M10 11a2 2 0 0 0 4 0"/><circle cx="8" cy="6" r="1"/>' },
  dishwasher:     { color: 'cyan',   svg: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="4" y1="8" x2="20" y2="8"/><line x1="9" y1="5" x2="15" y2="5"/>' },
  oven:           { color: 'orange', svg: '<rect x="4" y="2" width="16" height="20" rx="2"/><rect x="6" y="10" width="12" height="9" rx="1"/>' },
  microwave:      { color: 'orange', svg: '<rect x="2" y="6" width="20" height="12" rx="2"/><rect x="4" y="8" width="12" height="8"/>' },
  freezer:        { color: 'cyan',   svg: '<rect x="3" y="6" width="18" height="14" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="6" x2="12" y2="10"/>' },
  tv:             { color: 'orange', svg: '<rect x="2" y="4" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="18" x2="12" y2="21"/>' },
  default:        { color: 'cyan',   svg: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>' },
};

function getIconKey(equipmentSubtype, equipmentType) {
  const raw = equipmentSubtype || equipmentType || '';
  return raw.toLowerCase().replace(/[^a-z]/g, '');
}

function getIconColor(equipmentSubtype, equipmentType) {
  const key = getIconKey(equipmentSubtype, equipmentType);
  const match = APPLIANCE_ICONS[key] || APPLIANCE_ICONS.default;
  return match.color === 'cyan' ? '#00D4FF' : '#FF7A00';
}

function ApplianceIconSvg({ equipmentType, equipmentSubtype, size = 20 }) {
  const raw = equipmentSubtype || equipmentType || '';
  const key = raw.toLowerCase().replace(/[^a-z]/g, '');
  const match = APPLIANCE_ICONS[key] || APPLIANCE_ICONS.default;
  const isCyan = match.color === 'cyan';
  const color = isCyan ? '#00D4FF' : '#FF7A00';
  const glow = isCyan ? 'drop-shadow(0 0 4px rgba(0,212,255,0.7))' : 'drop-shadow(0 0 4px rgba(255,122,0,0.7))';
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ stroke: color, strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', filter: glow }}
      dangerouslySetInnerHTML={{ __html: match.svg }} />
  );
}

// ── Geocode via Nominatim (free, no key) ──────────────────────────────────
async function geocodeAddress(address) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'IDIMS-AtomicRepair/1.0' } });
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.error('Geocode error:', e);
  }
  return null;
}

// ── Stop Card ─────────────────────────────────────────────────────────────
function StopCard({ stop, index, onNavigate }) {
  const isCyan = getIconColor(stop.equipment_type, stop.equipment_subtype) === '#00D4FF';
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: '#0D1525', border: '1px solid rgba(255,255,255,0.07)' }}>
      {/* Stop number */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{
        background: isCyan ? 'rgba(0,212,255,0.15)' : 'rgba(255,122,0,0.15)',
        border: isCyan ? '1px solid rgba(0,212,255,0.5)' : '1px solid rgba(255,122,0,0.5)',
        color: isCyan ? '#00D4FF' : '#FF7A00',
        textShadow: isCyan ? '0 0 6px rgba(0,212,255,0.6)' : '0 0 6px rgba(255,122,0,0.6)',
      }}>
        {index + 1}
      </div>

      {/* Appliance icon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#080C14', border: '1px solid rgba(255,255,255,0.07)' }}>
        <ApplianceIconSvg equipmentType={stop.equipment_type} equipmentSubtype={stop.equipment_subtype} size={22} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{stop.client_name || 'Unknown'}</p>
        <p className="text-xs text-gray-400 truncate">{[stop.equipment_make, stop.equipment_model].filter(Boolean).join(' ') || (stop.equipment_type || '').replace(/_/g, ' ') || 'Appliance'}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <svg viewBox="0 0 24 24" width="10" height="10" style={{ stroke: '#6B7280', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <p className="text-xs text-gray-500 truncate">{stop.address}</p>
        </div>
        {stop.scheduled_start && (
          <p className="text-xs mt-0.5" style={{ color: '#22D3EE' }}>
            {new Date(stop.scheduled_start.endsWith('Z') ? stop.scheduled_start : stop.scheduled_start + 'Z')
              .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' })}
          </p>
        )}
        {stop.geocodeError && <p className="text-xs text-red-400 mt-0.5">⚠ Could not geocode address</p>}
      </div>

      {/* Navigate button */}
      <a
        href={`https://maps.google.com/?daddr=${encodeURIComponent(stop.address)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg transition-opacity active:opacity-70"
        style={{ background: '#080C14', border: '1px solid rgba(34,211,238,0.3)' }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" style={{ stroke: '#22D3EE', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', filter: 'drop-shadow(0 0 4px rgba(0,212,255,0.6))' }}>
          <polygon points="3 11 22 2 13 21 11 13 3 11"/>
        </svg>
      </a>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function RouteTest() {
  const [stops, setStops] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  // Load today's appointments
  useEffect(() => {
    async function load() {
      try {
        const schedData = await apiClient(
          `scheduling/schedule/combined?start_date=${todayStr}&end_date=${todayStr}&view_type=day`
        );
        const appts = schedData?.appointments || schedData?.schedule || schedData?.data || [];
        const todayAppts = (Array.isArray(appts) ? appts : [])
          .filter(a => {
            const startField = a.scheduled_start || a.start;
            if (!startField) return false;
            const d = new Date(startField.endsWith('Z') ? startField : startField + 'Z');
            return isToday(d);
          })
          .sort((a, b) => new Date(a.scheduled_start || a.start) - new Date(b.scheduled_start || b.start))
          .map(a => ({
            ...a,
            scheduled_start: a.scheduled_start || a.start,
            address: a.service_address || a.location || a.service_location?.address || '',
            client_name: a.client_name || a.client?.name || '',
            equipment_type: a.equipment_type || '',
            equipment_subtype: a.equipment_subtype || '',
            equipment_make: a.equipment_make || '',
            equipment_model: a.equipment_model || '',
            lat: null,
            lng: null,
            geocodeError: false,
          }));
        setStops(todayAppts);
      } catch (e) {
        console.error('Route load error:', e);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [todayStr]);

  // Geocode addresses after stops load
  useEffect(() => {
    if (stops.length === 0 || geocoding) return;
    const needsGeocode = stops.filter(s => s.address && s.lat === null);
    if (needsGeocode.length === 0) return;

    async function geocodeAll() {
      setGeocoding(true);
      const updated = [...stops];
      for (let i = 0; i < updated.length; i++) {
        if (!updated[i].address) continue;
        // Rate limit: 1 request/second for Nominatim
        if (i > 0) await new Promise(r => setTimeout(r, 1100));
        const coords = await geocodeAddress(updated[i].address);
        if (coords) {
          updated[i] = { ...updated[i], lat: coords.lat, lng: coords.lng };
        } else {
          updated[i] = { ...updated[i], geocodeError: true };
        }
        setGeocodeProgress(i + 1);
        setStops([...updated]);
      }
      setGeocoding(false);
    }
    geocodeAll();
  }, [stops.length]);

  // Init/rebuild Leaflet map whenever geocoding finishes
  useEffect(() => {
    if (geocoding) return;
    if (typeof window === 'undefined') return;
    const geocoded = stops.filter(s => s.lat && s.lng);
    if (geocoded.length === 0) return;

    // Destroy existing map instance before rebuilding
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      setMapReady(false);
    }

    function buildMap() {
      if (!mapRef.current || !window.L) return;
      const L = window.L;
      const map = L.map(mapRef.current, { zoomControl: true });
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const bounds = [];

      geocoded.forEach((stop, i) => {
        const key = getIconKey(stop.equipment_subtype, stop.equipment_type);
        const iconDef = APPLIANCE_ICONS[key] || APPLIANCE_ICONS.default;
        const isCyan = iconDef.color === 'cyan';
        const color = isCyan ? '#00D4FF' : '#FF7A00';
        const glow = isCyan ? 'rgba(0,212,255,0.8)' : 'rgba(255,122,0,0.8)';

        const svgMarker = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="62" viewBox="0 0 44 62">
          <defs><filter id="pglow${i}" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter></defs>
          <ellipse cx="22" cy="59" rx="7" ry="3" fill="rgba(0,0,0,0.4)"/>
          <path d="M22 2 C12 2 4 10 4 20 C4 32 22 58 22 58 C22 58 40 32 40 20 C40 10 32 2 22 2Z"
            fill="#0D1525" stroke="${color}" stroke-width="2" filter="url(#pglow${i})"/>
          <svg x="8" y="4" width="28" height="28" viewBox="0 0 24 24"
            stroke="${color}" stroke-width="1.5" fill="none"
            stroke-linecap="round" stroke-linejoin="round">
            ${iconDef.svg}
          </svg>
          <text x="22" y="43" text-anchor="middle" dominant-baseline="middle"
            font-family="Arial" font-weight="bold" font-size="11"
            fill="${color}" opacity="0.9">${i + 1}</text>
        </svg>`;

        const icon = L.divIcon({ html: svgMarker, className: '', iconSize: [44, 62], iconAnchor: [22, 62], popupAnchor: [0, -62] });

        const time = stop.scheduled_start
          ? new Date(stop.scheduled_start.endsWith('Z') ? stop.scheduled_start : stop.scheduled_start + 'Z')
              .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' })
          : '';
        const equip = [stop.equipment_make, stop.equipment_model].filter(Boolean).join(' ')
          || (stop.equipment_type || '').replace(/_/g, ' ') || 'Appliance';

        L.marker([stop.lat, stop.lng], { icon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:sans-serif;min-width:160px;">
              <div style="color:${color};font-weight:bold;font-size:13px;">Stop ${i + 1} — ${time}</div>
              <div style="font-size:12px;margin-top:4px;color:white;">${stop.client_name || 'Unknown'}</div>
              <div style="font-size:11px;color:#9CA3AF;">${equip}</div>
              <div style="font-size:11px;color:#6B7280;margin-top:2px;">${stop.address}</div>
            </div>`, { className: 'dark-popup' });

        bounds.push([stop.lat, stop.lng]);
      });

      if (geocoded.length > 1) {
        const latlngs = geocoded.map(s => [s.lat, s.lng]);
        // Black outline underneath
        L.polyline(latlngs, { color: '#000000', weight: 4.5, opacity: 0.8 }).addTo(map);
        // Orange line on top
        L.polyline(latlngs, { color: '#FF7A00', weight: 3, opacity: 0.9, dashArray: '8, 6' }).addTo(map);
      }

      if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40] });
      setMapReady(true);
    }

    // Load Leaflet if not already loaded
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!window.L) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = buildMap;
      document.head.appendChild(script);
    } else {
      buildMap();
    }
  }, [geocoding, stops]);

  const geocoded = stops.filter(s => s.lat && s.lng);
  const allAddressUrl = stops.filter(s => s.address).map(s => encodeURIComponent(s.address)).join('/');

  return (
    <>
      <Head>
        <title>Today's Route | IDIMS</title>
        <style>{`
          header, nav, .header-bar, [class*='h-16'] {
            background-color: #0D1525 !important;
            border-bottom: 1px solid rgba(255,255,255,0.07) !important;
            z-index: 50 !important;
          }
          .dark-popup .leaflet-popup-content-wrapper {
            background: #0D1525 !important;
            border: 1px solid rgba(34,211,238,0.3) !important;
            box-shadow: 0 0 12px rgba(0,212,255,0.15) !important;
            color: white !important;
          }
          .dark-popup .leaflet-popup-tip { background: #0D1525 !important; }
        `}</style>
      </Head>

      <div className="min-h-screen pb-6" style={{ background: '#0A0F1E' }}>
        <div className="px-4 pt-5 pb-3 max-w-lg mx-auto">

          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-xl font-bold text-white">Today's Route</h1>
              <p className="text-xs text-gray-500">{format(today, 'EEEE, MMMM d')}</p>
            </div>
            <Link href="/techdashboard" className="text-xs text-gray-500 hover:text-gray-300">← Dashboard</Link>
          </div>

          {/* Map */}
          <div className="rounded-lg mb-4 overflow-hidden" style={{ height: 320, background: '#0D1525', border: '1px solid rgba(255,255,255,0.07)', position: 'relative' }}>
            {(isLoading || geocoding) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10" style={{ background: '#0D1525' }}>
                <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mb-3" />
                <p className="text-sm text-gray-400">
                  {isLoading ? 'Loading appointments...' : `Locating stops (${geocodeProgress}/${stops.filter(s => s.address).length})...`}
                </p>
              </div>
            )}
            {!isLoading && !geocoding && geocoded.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-gray-500">No geocodable addresses for today</p>
              </div>
            )}
            <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          </div>

          {/* Open in Google Maps button */}
          {stops.filter(s => s.address).length > 0 && (
            <a
              href={`https://www.google.com/maps/dir/${allAddressUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="relative flex items-center justify-center gap-2 w-full py-2.5 mb-4 rounded-lg text-sm font-medium text-white overflow-hidden active:opacity-70 transition-opacity"
              style={{ background: '#0D1525', border: '1px solid rgba(34,211,238,0.5)', boxShadow: '0 0 10px rgba(0,212,255,0.15)' }}
            >
              <div className="absolute inset-0 rounded-lg" style={{ background: 'radial-gradient(ellipse at 0% 0%, rgba(0,212,255,0.1) 0%, transparent 55%), radial-gradient(ellipse at 100% 0%, rgba(0,212,255,0.1) 0%, transparent 55%), radial-gradient(ellipse at 0% 100%, rgba(0,212,255,0.1) 0%, transparent 55%), radial-gradient(ellipse at 100% 100%, rgba(0,212,255,0.1) 0%, transparent 55%)' }} />
              <svg viewBox="0 0 24 24" className="relative z-10 w-4 h-4" style={{ stroke: '#00D4FF', strokeWidth: 1.75, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', filter: 'drop-shadow(0 0 4px rgba(0,212,255,0.8))' }}>
                <polygon points="3 11 22 2 13 21 11 13 3 11"/>
              </svg>
              <span className="relative z-10" style={{ textShadow: '0 0 8px rgba(0,212,255,0.5)' }}>
                Open Full Route in Google Maps
              </span>
            </a>
          )}

          {/* Stop count */}
          {!isLoading && (
            <div className="flex justify-between items-center mb-2 px-1">
              <p className="text-sm text-gray-300">{stops.length} stop{stops.length !== 1 ? 's' : ''} today</p>
              {geocoding && <p className="text-xs text-cyan-400 animate-pulse">Locating addresses...</p>}
            </div>
          )}

          {/* Stop cards */}
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-20 rounded-lg animate-pulse" style={{ background: '#0D1525' }} />)}
            </div>
          ) : stops.length === 0 ? (
            <div className="py-12 text-center">
              <svg viewBox="0 0 24 24" className="w-12 h-12 mx-auto mb-3" style={{ stroke: '#374151', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-sm text-gray-500">No stops scheduled for today</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stops.map((stop, i) => (
                <StopCard key={stop.id || i} stop={stop} index={i} />
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  );
}

RouteTest.getLayout = (page) => <DashboardLayout>{page}</DashboardLayout>;
