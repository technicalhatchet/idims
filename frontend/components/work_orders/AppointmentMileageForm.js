import { useEffect, useState } from 'react';
import { upsertAppointmentMileage } from '../../services/api/jobEconomicsApi';

export default function AppointmentMileageForm({ appointment, variant = 'mobile', embedded = false }) {
  const isMobile = variant === 'mobile';
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
    if (!m) return;
    setMethod(m.method || 'estimated');
    setMiles(m.miles != null ? String(m.miles) : '');
    setOdometerStart(m.odometer_start != null ? String(m.odometer_start) : '');
    setOdometerEnd(m.odometer_end != null ? String(m.odometer_end) : '');
    setNotes(m.notes || '');
  }, [appointment?.id, appointment?.mileage]);

  const suggestedMiles = appointment?.travel_distance_before
    ? (Number(appointment.travel_distance_before) / 1609.34).toFixed(1)
    : null;

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
        miles: method === 'odometer' ? 0 : Number(miles || 0),
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
        <select className={inputClass} value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="estimated">Estimated miles</option>
          <option value="odometer">Odometer</option>
          <option value="calculated">From schedule</option>
        </select>
        {method !== 'odometer' ? (
          <input type="number" step="0.1" min="0" className={inputClass} value={miles} onChange={(e) => setMiles(e.target.value)} placeholder="Miles" />
        ) : (
          <div className="col-span-2 grid grid-cols-2 gap-2">
            <input type="number" step="0.1" className={inputClass} value={odometerStart} onChange={(e) => setOdometerStart(e.target.value)} placeholder="Start odometer" />
            <input type="number" step="0.1" className={inputClass} value={odometerEnd} onChange={(e) => setOdometerEnd(e.target.value)} placeholder="End odometer" />
          </div>
        )}
      </div>
      {suggestedMiles && method === 'calculated' && (
        <button type="button" className="text-xs text-cyan-400 mt-1" onClick={() => { setMiles(suggestedMiles); setMethod('estimated'); }}>
          Use calculated {suggestedMiles} mi
        </button>
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
