import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import Head from 'next/head';
import { format, isToday } from 'date-fns';
import TechDashboardLayout from '../../components/layouts/TechDashboardLayout';
import { apiClient } from '../../utils/api-client';
import { getEquipmentIconKey } from '../../utils/equipment-icon-key';

// ── Home Base (Shop) Address ──────────────────────────────────────────────
const HOME_BASE_ADDRESS = '641 Barclay Drive, Toledo, OH 43609';

const ROUTE_PAGE_BG = '#0A0F1E';
const ROUTE_TACTICAL_NOISE_BG =
  'url("data:image/svg+xml,%3Csvg viewBox=%270 0 256 256%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")';

/** Match tactical field grid (`bg-[size:42px_42px]`). */
const HUD_GRID_STEP = 42;
const HUD_GRID_NUDGE_X = -1;
const HUD_GRID_NUDGE_Y = -1;

function positiveMod(n, m) {
  return ((n % m) + m) % m;
}

function hudGridShiftForTitleplate(dx, dy, step) {
  return {
    x: -positiveMod(dx, step),
    y: -positiveMod(dy, step),
  };
}

// ── Home Base SVG Icon ────────────────────────────────────────────────────
const HOME_BASE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none">
  <defs>
    <linearGradient id="homeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#00D4FF;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#FF7A00;stop-opacity:1" />
    </linearGradient>
    <filter id="homeGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="1.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" 
        stroke="url(#homeGrad)" 
        stroke-width="1.5" 
        stroke-linejoin="round"
        fill="#0D1525"
        filter="url(#homeGlow)"/>
  <path d="M8 12L12 9L16 12V16C16 16.5523 15.5523 17 15 17H9C8.44772 17 8 16.5523 8 16V12Z" 
        stroke="#00D4FF" 
        stroke-width="1.5" 
        stroke-linejoin="round"
        fill="none"/>
  <path d="M11 17V14H13V17" 
        stroke="#FF7A00" 
        stroke-width="1.5" 
        stroke-linecap="round"
        fill="none"/>
</svg>`;

// ── Appliance Icons ───────────────────────────────────────────────────────
const APPLIANCE_ICONS = {
  refrigerator:   { color: 'cyan',   svg: '<rect x="6" y="2" width="12" height="20" rx="2"/><line x1="6" y1="10" x2="18" y2="10"/><line x1="10" y1="5" x2="10" y2="8"/><line x1="10" y1="13" x2="10" y2="16"/>' },
  fridge:         { color: 'cyan',   svg: '<rect x="6" y="2" width="12" height="20" rx="2"/><line x1="6" y1="10" x2="18" y2="10"/><line x1="10" y1="5" x2="10" y2="8"/><line x1="10" y1="13" x2="10" y2="16"/>' },
  washingmachine: { color: 'cyan',   svg: '<rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><circle cx="12" cy="13" r="2"/><circle cx="8" cy="6" r="1"/>' },
  washer:         { color: 'cyan',   svg: '<rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><circle cx="12" cy="13" r="2"/><circle cx="8" cy="6" r="1"/>' },
  dryer:          { color: 'orange', svg: '<rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><path d="M10 11a2 2 0 0 0 4 0"/><circle cx="8" cy="6" r="1"/>' },
  dishwasher:     { color: 'cyan',   svg: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="4" y1="8" x2="20" y2="8"/><line x1="9" y1="5" x2="15" y2="5"/>' },
  oven:           { color: 'orange', svg: '<rect x="4" y="2" width="16" height="20" rx="2"/><rect x="6" y="10" width="12" height="9" rx="1"/><line x1="7" y1="6" x2="7" y2="6"/><line x1="10" y1="6" x2="10" y2="6"/><line x1="13" y1="6" x2="13" y2="6"/><line x1="16" y1="6" x2="16" y2="6"/>' },
  microwave:      { color: 'orange', svg: '<rect x="2" y="6" width="20" height="12" rx="2"/><rect x="4" y="8" width="12" height="8"/>' },
  freezer:        { color: 'cyan',   svg: '<rect x="3" y="6" width="18" height="14" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="6" x2="12" y2="10"/>' },
  tv:             { color: 'orange', svg: '<rect x="2" y="4" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="18" x2="12" y2="21"/>' },
  default:        { color: 'cyan',   svg: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>' },
};

function getIconColor(equipmentType, equipmentSubtype) {
  const key = getEquipmentIconKey(equipmentType, equipmentSubtype);
  const match = APPLIANCE_ICONS[key] || APPLIANCE_ICONS.default;
  return match.color === 'cyan' ? '#00D4FF' : '#FF7A00';
}

function ApplianceIconSvg({ equipmentType, equipmentSubtype, size = 20 }) {
  const key = getEquipmentIconKey(equipmentType, equipmentSubtype);
  const match = APPLIANCE_ICONS[key] || APPLIANCE_ICONS.default;
  const isCyan = match.color === 'cyan';
  const color = isCyan ? '#00D4FF' : '#FF7A00';
  const glow = isCyan ? 'drop-shadow(0 0 4px rgba(0,212,255,0.7))' : 'drop-shadow(0 0 4px rgba(255,122,0,0.7))';
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ stroke: color, strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', filter: glow }}
      dangerouslySetInnerHTML={{ __html: match.svg }} />
  );
}

// ── Address Cleaning Helpers ──────────────────────────────────────────────
// Normalize address formatting (fix spacing issues)
function normalizeAddress(address) {
  return address
    .replace(/,([^\s])/g, ', $1')  // Add space after commas if missing
    .replace(/\s+/g, ' ')          // Collapse multiple spaces
    .trim();
}

// Strip USA/country from address (for local use)
function stripCountry(address) {
  return address
    .replace(/,?\s*(USA|United States|US|U\.S\.A\.?)$/gi, '')
    .replace(/,\s*$/,'')
    .trim();
}

// Strip unit/apt numbers for geocoding retry
function stripUnitNumber(address) {
  const unitPatterns = [
    /,?\s*(apt\.?|apartment)\s*#?\s*[\w-]+/gi,
    /,?\s*(unit|ste\.?|suite)\s*#?\s*[\w-]+/gi,
    /,?\s*(bldg\.?|building)\s*#?\s*[\w-]+/gi,
    /,?\s*(floor|fl\.?)\s*#?\s*[\w-]+/gi,
    /,?\s*#\s*[\w-]+/gi,
  ];
  
  let cleaned = address;
  for (const pattern of unitPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned.replace(/\s+/g, ' ').replace(/,\s*,/g, ', ').replace(/,\s*$/,'').trim();
}

// Clean address for display (strip country)
function displayAddress(address) {
  return stripCountry(normalizeAddress(address));
}

// ── Geocode via Nominatim (free, no key) ──────────────────────────────────
async function geocodeAddress(address) {
  const headers = { 'Accept-Language': 'en', 'User-Agent': 'IDIMS-AtomicRepair/1.0' };
  
  // Normalize and strip country first
  let cleanAddress = stripCountry(normalizeAddress(address));
  console.log(`Geocoding: "${cleanAddress}"`);
  
  // First attempt: try with cleaned address (may include unit)
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleanAddress)}&limit=1`;
    const res = await fetch(url, { headers });
    const data = await res.json();
    if (data && data.length > 0) {
      console.log(`Geocoded OK: "${cleanAddress}"`);
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.error('Geocode error (first attempt):', e);
  }

  // Second attempt: strip unit number and retry
  const noUnitAddress = stripUnitNumber(cleanAddress);
  if (noUnitAddress !== cleanAddress) {
    console.log(`Retrying without unit: "${noUnitAddress}"`);
    await new Promise(r => setTimeout(r, 1100)); // Rate limit delay
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(noUnitAddress)}&limit=1`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (data && data.length > 0) {
        console.log(`Geocoded OK (no unit): "${noUnitAddress}"`);
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch (e) {
      console.error('Geocode error (retry without unit):', e);
    }
  }

  // Third attempt: try just street + city + state (strip zip)
  const simplifiedAddress = noUnitAddress
    .replace(/,?\s*\d{5}(-\d{4})?/g, '')  // Remove zip and preceding comma
    .replace(/,\s*$/,'')                   // Remove trailing comma
    .trim();
  if (simplifiedAddress !== noUnitAddress) {
    console.log(`Retrying simplified: "${simplifiedAddress}"`);
    await new Promise(r => setTimeout(r, 1100));
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(simplifiedAddress)}&limit=1`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (data && data.length > 0) {
        console.log(`Geocoded OK (simplified): "${simplifiedAddress}"`);
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch (e) {
      console.error('Geocode error (simplified):', e);
    }
  }

  // Fourth attempt: try street + zip only (for when OSM has wrong city but correct zip)
  const zipMatch = noUnitAddress.match(/\d{5}(-\d{4})?/);
  const streetMatch = noUnitAddress.match(/^([^,]+)/);
  if (zipMatch && streetMatch) {
    const streetPlusZip = `${streetMatch[1].trim()}, ${zipMatch[0]}`;
    console.log(`Retrying street+zip: "${streetPlusZip}"`);
    await new Promise(r => setTimeout(r, 1100));
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(streetPlusZip)}&limit=1`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (data && data.length > 0) {
        console.log(`Geocoded OK (street+zip): "${streetPlusZip}"`);
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch (e) {
      console.error('Geocode error (street+zip):', e);
    }
  }

  console.warn(`Failed to geocode: "${address}"`);
  return null;
}

// ── Stop Card ─────────────────────────────────────────────────────────────
function StopCard({ stop, index, onNavigate }) {
  const isCyan = getIconColor(stop.equipment_type, stop.equipment_subtype) === '#00D4FF';
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg" style={{ background: '#0D1525', border: '1px solid rgba(255,255,255,0.07)' }}>
      {/* Stop number + Appliance icon stacked */}
      <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{
          background: isCyan ? 'rgba(0,212,255,0.15)' : 'rgba(255,122,0,0.15)',
          border: isCyan ? '1px solid rgba(0,212,255,0.5)' : '1px solid rgba(255,122,0,0.5)',
          color: isCyan ? '#00D4FF' : '#FF7A00',
          textShadow: isCyan ? '0 0 6px rgba(0,212,255,0.6)' : '0 0 6px rgba(255,122,0,0.6)',
        }}>
          {index + 1}
        </div>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#080C14', border: '1px solid rgba(255,255,255,0.07)' }}>
          <ApplianceIconSvg equipmentType={stop.equipment_type} equipmentSubtype={stop.equipment_subtype} size={20} />
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{stop.client_name || 'Unknown'}</p>
        <p className="text-xs text-gray-400">{[stop.equipment_make, stop.equipment_model].filter(Boolean).join(' ') || (stop.equipment_type || '').replace(/_/g, ' ') || 'Appliance'}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <svg viewBox="0 0 24 24" width="10" height="10" style={{ stroke: '#6B7280', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <p className="text-xs text-gray-500">{displayAddress(stop.address)}</p>
        </div>
        {stop.scheduled_start && (
          <p className="text-xs mt-0.5" style={{ color: '#22D3EE' }}>
            {new Date(stop.scheduled_start.endsWith('Z') ? stop.scheduled_start : stop.scheduled_start + 'Z')
              .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' })}
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
  const [homeBase, setHomeBase] = useState(null); // { lat, lng }
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  // Geocode home base address on mount
  useEffect(() => {
    async function geocodeHome() {
      const coords = await geocodeAddress(HOME_BASE_ADDRESS);
      if (coords) {
        setHomeBase(coords);
      }
    }
    geocodeHome();
  }, []);

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
    // Show map if we have stops OR home base
    if (geocoded.length === 0 && !homeBase) return;

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

      // Add home base marker if geocoded
      if (homeBase) {
        const homeIcon = L.divIcon({ 
          html: HOME_BASE_SVG, 
          className: '', 
          iconSize: [48, 48], 
          iconAnchor: [24, 24], 
          popupAnchor: [0, -24] 
        });

        L.marker([homeBase.lat, homeBase.lng], { icon: homeIcon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:sans-serif;min-width:140px;">
              <div style="background: linear-gradient(135deg, #00D4FF, #FF7A00); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight:bold;font-size:13px;">Home Base</div>
              <div style="font-size:11px;color:#9CA3AF;margin-top:4px;">Atomic Repair Shop</div>
              <div style="font-size:11px;color:#6B7280;margin-top:2px;">${HOME_BASE_ADDRESS}</div>
            </div>`, { className: 'dark-popup' });

        bounds.push([homeBase.lat, homeBase.lng]);
      }

      geocoded.forEach((stop, i) => {
        const key = getEquipmentIconKey(stop.equipment_type, stop.equipment_subtype);
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
              .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' })
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
              <div style="font-size:11px;color:#6B7280;margin-top:2px;">${displayAddress(stop.address)}</div>
            </div>`, { className: 'dark-popup' });

        bounds.push([stop.lat, stop.lng]);
      });

      // Build route line starting from home base
      const routePoints = [];
      if (homeBase) {
        routePoints.push([homeBase.lat, homeBase.lng]);
      }
      geocoded.forEach(s => routePoints.push([s.lat, s.lng]));

      if (routePoints.length > 1) {
        // Black outline underneath
        L.polyline(routePoints, { color: '#000000', weight: 3.5, opacity: 0.7 }).addTo(map);
        // Orange line on top
        L.polyline(routePoints, { color: '#FF7A00', weight: 3, opacity: 0.9, dashArray: '8, 6' }).addTo(map);
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
  }, [geocoding, stops, homeBase]);

  const tacticalColumnRef = useRef(null);
  const titleplateRef = useRef(null);
  const [hudGridShift, setHudGridShift] = useState({ x: 0, y: 0 });

  const syncHudGridAlignment = useCallback(() => {
    const col = tacticalColumnRef.current;
    const plate = titleplateRef.current;
    if (!col || !plate) return;
    const c = col.getBoundingClientRect();
    const p = plate.getBoundingClientRect();
    const dx = p.left - c.left;
    const dy = p.top - c.top;
    const base = hudGridShiftForTitleplate(dx, dy, HUD_GRID_STEP);
    setHudGridShift({ x: base.x + HUD_GRID_NUDGE_X, y: base.y + HUD_GRID_NUDGE_Y });
  }, []);

  useLayoutEffect(() => {
    syncHudGridAlignment();
    const raf = requestAnimationFrame(() => syncHudGridAlignment());
    const col = tacticalColumnRef.current;
    if (!col) {
      return () => cancelAnimationFrame(raf);
    }
    const ro = new ResizeObserver(() => syncHudGridAlignment());
    ro.observe(col);
    window.addEventListener('resize', syncHudGridAlignment);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', syncHudGridAlignment);
    };
  }, [syncHudGridAlignment]);

  const geocoded = stops.filter(s => s.lat && s.lng);
  const allAddressUrl = stops.filter(s => s.address).map(s => encodeURIComponent(s.address)).join('/');

  return (
    <>
      <Head>
        <title>Today's Route | IDIMS</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <style>{`
          @keyframes td-route-tactical-scan {
            0% { left: -48%; }
            100% { left: 115%; }
          }
          @keyframes td-route-titleplate-scan {
            100% { left: 120%; }
          }
          .td-route-titleplate-grid {
            background-image:
              linear-gradient(rgba(0, 217, 255, 0.07) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 217, 255, 0.07) 1px, transparent 1px);
            background-size: ${HUD_GRID_STEP}px ${HUD_GRID_STEP}px;
            background-position: var(--td-route-hud-grid-x, 0px) var(--td-route-hud-grid-y, 0px);
          }
          .td-route-titleplate-orbitron {
            font-family: 'Orbitron', system-ui, sans-serif;
          }
          .td-route-titleplate-title-glow {
            text-shadow:
              0 0 8px rgba(255, 255, 255, 0.15),
              0 0 18px rgba(34, 211, 238, 0.35),
              0 0 40px rgba(0, 212, 255, 0.22);
          }
          .td-route-titleplate-edge {
            position: relative;
          }
          .td-route-titleplate-edge::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: inherit;
            padding: 1px;
            background: linear-gradient(
              135deg,
              rgba(34, 211, 238, 0.72),
              rgba(8, 51, 68, 0.28),
              rgba(0, 212, 255, 0.5)
            );
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            mask-composite: exclude;
            pointer-events: none;
          }
          .td-route-titleplate-scan::after {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(
              90deg,
              transparent,
              rgba(34, 211, 238, 0.085),
              transparent
            );
            animation: td-route-titleplate-scan 5s linear infinite;
            border-radius: inherit;
            pointer-events: none;
          }
          /* Do not pin header z-index here — Leaflet controls use z-index ~1000 */
          header, nav, .header-bar, [class*='h-16'] {
            background-color: #0D1525 !important;
            border-bottom: 1px solid rgba(255,255,255,0.07) !important;
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

      <div className="min-h-screen pb-6" style={{ background: ROUTE_PAGE_BG }}>
        <div ref={tacticalColumnRef} className="relative px-4 pt-0 pb-5 max-w-lg mx-auto">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="absolute inset-0" style={{ background: ROUTE_PAGE_BG }} />
            <div
              className="absolute inset-0 opacity-[0.11]
                bg-[linear-gradient(rgba(0,217,255,.28)_1px,transparent_1px),linear-gradient(90deg,rgba(0,217,255,.28)_1px,transparent_1px)]
                bg-[size:42px_42px]"
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(0,217,255,.13),transparent_48%)]" />
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[min(560px,120%)] h-[220px] bg-cyan-400/[0.085] blur-[120px] rounded-full" />
            <div
              className="absolute inset-0 opacity-[0.028]
                bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,.1),rgba(255,255,255,.1)_1px,transparent_1px,transparent_14px)]"
            />
            <div
              className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
              style={{ backgroundImage: ROUTE_TACTICAL_NOISE_BG }}
            />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-300/45 to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_35%,rgba(0,0,0,.52)_100%)] pointer-events-none" />
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div
                className="absolute top-0 bottom-0 w-[42%]"
                style={{
                  left: '-48%',
                  background:
                    'linear-gradient(90deg, transparent 0%, transparent 32%, rgba(255,255,255,0.024) 50%, transparent 68%, transparent 100%)',
                  animation: 'td-route-tactical-scan 6.5s linear infinite',
                }}
              />
            </div>
            <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] pointer-events-none" />
          </div>

          <div className="relative z-10 p-4 sm:p-6">
          <div className="mb-5">
            <div
              ref={titleplateRef}
              className="relative overflow-hidden rounded-[18px] md:rounded-[22px] border border-cyan-400/35 bg-[rgba(5,12,22,.84)] backdrop-blur-2xl px-3.5 py-3 md:px-5 md:py-4 shadow-[0_0_30px_rgba(0,212,255,.28)] td-route-titleplate-edge td-route-titleplate-scan"
              style={{
                ['--td-route-hud-grid-x']: `${hudGridShift.x}px`,
                ['--td-route-hud-grid-y']: `${hudGridShift.y}px`,
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-50 td-route-titleplate-grid"
                aria-hidden
              />
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-cyan-950/0 opacity-60 pointer-events-none rounded-[inherit]" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none z-[1]" />
              <div className="absolute bottom-0 left-4 right-4 md:left-8 md:right-8 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent pointer-events-none z-[1]" />

              <div className="relative z-[2] min-w-0">
                <p className="td-route-titleplate-orbitron text-[8px] md:text-[9px] uppercase tracking-[0.2em] md:tracking-[0.28em] text-cyan-300/95 mb-1.5 font-semibold leading-tight">
                  Field routing · map & stops
                </p>
                <h1 className="td-route-titleplate-orbitron td-route-titleplate-title-glow text-[1.0625rem] sm:text-xl md:text-2xl font-black uppercase tracking-[0.06em] sm:tracking-[0.1em] md:tracking-[0.14em] leading-none text-white">
                  Today&apos;s Route
                </h1>
                <div className="mt-2 md:mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <div className="h-px w-10 md:w-16 shrink-0 bg-gradient-to-r from-cyan-300 to-transparent" />
                  <span className="td-route-titleplate-orbitron text-white/45 text-[9px] md:text-[10px] tracking-[0.12em] md:tracking-[0.2em] uppercase">
                    {format(today, 'EEEE, MMMM d').toUpperCase()}
                    <span className="mx-2 text-white/25">/</span>
                    {stops.length} stop{stops.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>
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
      </div>
    </>
  );
}

RouteTest.getLayout = (page) => <TechDashboardLayout>{page}</TechDashboardLayout>;

export async function getServerSideProps() {
  return { props: {} };
}
