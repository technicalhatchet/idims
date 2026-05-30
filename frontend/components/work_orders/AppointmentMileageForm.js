import { useEffect, useState } from 'react';
import { upsertAppointmentMileage } from '../../services/api/jobEconomicsApi';

function scheduleMilesFromAppointment(appointment) {
  const meters = appointment?.travel_distance_before;
  if (meters == null || Number(meters) <= 0) return null;
  return (Number(meters) / 1609.34).toFixed(1);
}

export default function AppointmentMileageForm({ appointment, variant = 'mobile', embedded = false }) {
  const isMobile = variant === 'mobile';
  const scheduleMiles = scheduleMilesFromAppointment(appointment);
  const [method, setMethod] = useState('estimated');
  const [miles, setMiles] = useState('');
  const [odometerStart, setOdometerStart] = useState('');
  const [odometerEnd, setOdometerEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const m = appointment?.mileage;
    if (m) {
      setMethod(m.method || 'estimated');
      setMiles(m.miles != null ? String(m.miles) : '');
      setOdometerStart(m.odometer_start != null ? String(m.odometer_start) : '');
      setOdometerEnd(m.odometer_end != null ? String(m.odometer_end) : '');
      setNotes(m.notes || '');
      return;
    }

    if (scheduleMiles) {
      setMethod('calculated');
      setMiles(scheduleMiles);
    } else {
      setMethod('estimated');
      setMiles('');
    }
    setOdometerStart('');
    setOdometerEnd('');
    setNotes('');
  }, [appointment?.id, appointment?.mileage, scheduleMiles]);

  const handleMethodChange = (nextMethod) => {
    setMethod(nextMethod);
    if (nextMethod === 'calculated' && scheduleMiles) {
      setMiles(scheduleMiles);
    }
  };

  const resolveMilesForSave = () => {
    if (method === 'odometer') return 0;
    const parsed = Number(miles);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    if (scheduleMiles) return Number(scheduleMiles);
    return 0;
  };

  const inputClass = isMobile
    ? 'w-full rounded border border-cyan-500/20 bg-black/30 px-2 py-1.5 text-xs text-white'
    : 'w-full rounded border border-gray-300 px-2 py-1.5 text-xs';

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await upsertAppointmentMileage(appointment.id, {
        method,
        miles: resolveMilesForSave(),
        odometer_start: odometerStart ? Number(odometerStart) : undefined,
        odometer_end: odometerEnd ? Number(odometerEnd) : undefined,
        notes: notes || undefined,
      });
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Failed to save mileage');
    } finally {
      setSaving(false);
    }
  };

  if (!appointment?.id) return null;

  return (
    <div className={embedded ? '' : `mt-3 pt-3 border-t ${isMobile ? 'border-cyan-500/15' : 'border-gray-200'}`}>
      {!embedded && (
        <p className={`text-xs font-medium mb-2 ${isMobile ? 'text-cyan-400/90' : 'text-gray-600'}`}>Trip mileage</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <select className={inputClass} value={method} onChange={(e) => handleMethodChange(e.target.value)}>
          <option value="calculated">From schedule</option>
          <option value="estimated">Estimated miles</option>
          <option value="odometer">Odometer</option>
        </select>
        {method !== 'odometer' ? (
          <input
            type="number"
            step="0.1"
            min="0"
            className={inputClass}
            value={miles}
            onChange={(e) => setMiles(e.target.value)}
            placeholder={scheduleMiles ? scheduleMiles : 'Miles'}
          />
        ) : (
          <div className="col-span-2 grid grid-cols-2 gap-2">
            <input type="number" step="0.1" className={inputClass} value={odometerStart} onChange={(e) => setOdometerStart(e.target.value)} placeholder="Start odometer" />
            <input type="number" step="0.1" className={inputClass} value={odometerEnd} onChange={(e) => setOdometerEnd(e.target.value)} placeholder="End odometer" />
          </div>
        )}
      </div>
      {method === 'calculated' && scheduleMiles && (
        <p className="text-[10px] text-gray-500 mt-1">Prefilled from schedule ({scheduleMiles} mi). Edit miles above if needed.</p>
      )}
      {!scheduleMiles && method === 'calculated' && (
        <p className="text-[10px] text-amber-500/90 mt-1">No schedule distance on this visit — enter miles manually or pick another method.</p>
      )}
      <input type="text" className={`${inputClass} mt-2`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" />
      <div className="flex items-center gap-2 mt-2">
        <button type="button" onClick={handleSave} disabled={saving} className={`text-xs px-3 py-1.5 rounded ${isMobile ? 'bg-cyan-600 text-white' : 'bg-blue-600 text-white'} disabled:opacity-50`}>
          {saving ? 'Saving…' : 'Save mileage'}
        </button>
        {saved && <span className="text-xs text-green-400">Saved</span>}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}
