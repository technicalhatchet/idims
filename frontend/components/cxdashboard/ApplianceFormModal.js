import { useEffect, useState } from 'react';
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

export default function ApplianceFormModal({
  title,
  initial,
  properties = [],
  onSave,
  onClose,
  submitting,
}) {
  const [form, setForm] = useState({ ...emptyApplianceForm, ...initial });

  useEffect(() => {
    setForm({ ...emptyApplianceForm, ...initial });
  }, [initial]);

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.equipment_type || !form.equipment_subtype || !form.make?.trim()) {
      return;
    }
    onSave({
      ...form,
      property_id: form.property_id || null,
      make: form.make.trim(),
    });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%', maxWidth: '520px', maxHeight: '90vh', overflow: 'auto',
          background: '#0B0F1A', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '16px', padding: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ color: '#fff', margin: 0, fontSize: '1.125rem' }}>{title}</h2>
          <button type="button" onClick={onClose} style={{ color: '#6b7280', background: 'none', border: 'none' }}>
            <FaTimes />
          </button>
        </div>

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {properties.length > 0 && (
            <div>
              <label style={labelStyle}>Property</label>
              <select value={form.property_id || ''} onChange={(e) => set({ property_id: e.target.value })} style={fieldStyle}>
                <option value="">Select property</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.address}{p.unit_number ? ` · Unit ${p.unit_number}` : ''}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={labelStyle}>Nickname (optional)</label>
            <input value={form.nickname || ''} onChange={(e) => set({ nickname: e.target.value })} placeholder="Kitchen fridge" style={fieldStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button type="button" onClick={onClose} style={{ flex: 1, ...fieldStyle, cursor: 'pointer' }}>Cancel</button>
          <button
            type="submit"
            disabled={submitting}
            style={{
              flex: 2, padding: '0.75rem', borderRadius: '8px', border: 'none',
              background: '#00D4FF', color: '#0A0F1E', fontWeight: 700, cursor: 'pointer',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Saving...' : 'Save appliance'}
          </button>
        </div>
      </form>
    </div>
  );
}
