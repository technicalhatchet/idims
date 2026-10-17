import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes } from 'react-icons/fa';
import { emptyApplianceForm, EQUIPMENT_SUBTYPES, EQUIPMENT_TYPES, MANUFACTURERS } from '../../constants/applianceEquipment';

const fieldStyle = {
  width: '100%',
  padding: '0.625rem 0.75rem',
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '0.875rem',
  boxSizing: 'border-box',
};

const labelStyle = { display: 'block', color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.35rem' };

function useIsMobileSheet() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isMobile;
}

export default function ApplianceFormModal({
  title,
  initial,
  properties = [],
  onSave,
  onClose,
  submitting,
}) {
  const [form, setForm] = useState({ ...emptyApplianceForm, ...initial });
  const isMobile = useIsMobileSheet();

  useEffect(() => {
    setForm({ ...emptyApplianceForm, ...initial });
  }, [initial]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.equipment_type || !form.equipment_subtype || !form.make?.trim()) {
      return;
    }
    if (properties.length > 0 && !form.property_id) {
      return;
    }
    onSave({
      ...form,
      property_id: form.property_id || null,
      make: form.make.trim(),
    });
  };

  if (typeof document === 'undefined') return null;

  const shellClass = isMobile
    ? 'relative z-[1] flex h-full w-full max-h-full flex-col rounded-none border-0 bg-[#0B0F1A]'
    : 'relative z-[1] flex w-full max-h-[min(90vh,720px)] max-w-[520px] flex-col overflow-hidden rounded-2xl border border-cyan-500/20 bg-[#0B0F1A]';

  const overlayAlign = isMobile ? 'items-stretch justify-stretch p-0' : 'items-center justify-center p-4';

  return createPortal(
    <div className={`fixed inset-0 z-[9999] flex ${overlayAlign} touch-manipulation`}>
      <button
        type="button"
        aria-label="Close dialog backdrop"
        className="absolute inset-0 bg-black/75"
        onClick={onClose}
      />

      <form onSubmit={handleSubmit} className={shellClass}>
        <header
          className={`sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#0B0F1A] px-4 py-3 ${
            isMobile ? 'pt-[max(12px,env(safe-area-inset-top))]' : ''
          }`}
        >
          <h2 className="m-0 text-lg font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:text-gray-300"
            aria-label="Close"
          >
            <FaTimes />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <div className="grid gap-3">
            {properties.length > 0 && (
              <div>
                <label style={labelStyle}>Service property *</label>
                <select value={form.property_id || ''} onChange={(e) => set({ property_id: e.target.value })} style={fieldStyle} required>
                  <option value="">Select property</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.address}{p.unit_number ? ` · Unit ${p.unit_number}` : ''}</option>
                  ))}
                </select>
                <p className="mt-1.5 text-[0.7rem] text-gray-500">
                  Required for online scheduling — choose where this appliance is located.
                </p>
              </div>
            )}

            <div>
              <label style={labelStyle}>Nickname (optional)</label>
              <input value={form.nickname || ''} onChange={(e) => set({ nickname: e.target.value })} placeholder="Kitchen fridge" style={fieldStyle} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label style={labelStyle}>Type *</label>
                <select
                  value={form.equipment_type}
                  onChange={(e) => set({ equipment_type: e.target.value, equipment_subtype: '' })}
                  style={fieldStyle}
                  required
                >
                  {EQUIPMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>{form.equipment_type === 'tv' ? 'TV size *' : 'Subtype *'}</label>
                <select
                  value={form.equipment_subtype || ''}
                  onChange={(e) => set({ equipment_subtype: e.target.value })}
                  style={fieldStyle}
                  required
                >
                  <option value="">Select...</option>
                  {(EQUIPMENT_SUBTYPES[form.equipment_type] || []).map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label style={labelStyle}>Make *</label>
                <input list="appliance-makes" value={form.make || ''} onChange={(e) => set({ make: e.target.value })} style={fieldStyle} required />
                <datalist id="appliance-makes">
                  {MANUFACTURERS.map((m) => <option key={m} value={m} />)}
                </datalist>
              </div>
              <div>
                <label style={labelStyle}>Model</label>
                <input value={form.model || ''} onChange={(e) => set({ model: e.target.value })} style={fieldStyle} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Serial number</label>
              <input value={form.serial || ''} onChange={(e) => set({ serial: e.target.value })} style={{ ...fieldStyle, fontFamily: 'monospace' }} />
            </div>

            <div>
              <label style={labelStyle}>Notes</label>
              <textarea value={form.notes || ''} onChange={(e) => set({ notes: e.target.value })} rows={2} style={fieldStyle} />
            </div>
          </div>
        </div>

        <footer
          className={`sticky bottom-0 z-10 flex shrink-0 gap-3 border-t border-white/10 bg-[#0B0F1A] px-4 py-3 ${
            isMobile ? 'pb-[max(12px,env(safe-area-inset-bottom))]' : ''
          }`}
        >
          <button type="button" onClick={onClose} className="flex-1 cursor-pointer" style={fieldStyle}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-[2] rounded-lg border-0 bg-[#00D4FF] px-3 py-3 font-bold text-[#0A0F1E] disabled:opacity-60"
          >
            {submitting ? 'Saving...' : 'Save'}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
