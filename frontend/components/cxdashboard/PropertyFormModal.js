import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FaTimes } from 'react-icons/fa';
import { propertyPrimaryTitle } from '../../utils/propertyDisplay';

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

export const emptyPortalPropertyForm = {
  nickname: '',
  address: '',
  unit_number: '',
  property_type: 'residential',
  gate_code: '',
  access_instructions: '',
  tenant_name: '',
  tenant_phone: '',
  tenant_email: '',
};

const PROPERTY_TYPES = [
  { value: 'residential', label: 'Residential' },
  { value: 'rental', label: 'Rental' },
  { value: 'commercial', label: 'Commercial' },
];

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

export function propertyToForm(property) {
  if (!property) return { ...emptyPortalPropertyForm };
  return {
    nickname: property.nickname || '',
    address: property.address || '',
    unit_number: property.unit_number || '',
    property_type: property.property_type || 'residential',
    gate_code: property.gate_code || '',
    access_instructions: property.access_instructions || '',
    tenant_name: property.tenant_name || '',
    tenant_phone: property.tenant_phone || '',
    tenant_email: property.tenant_email || '',
  };
}

export default function PropertyFormModal({
  title,
  initial,
  editingProperty,
  onSave,
  onClose,
  submitting,
  readOnly = false,
}) {
  const [form, setForm] = useState({ ...emptyPortalPropertyForm, ...initial });
  const [areaWarning, setAreaWarning] = useState(null);
  const [areaChecking, setAreaChecking] = useState(false);
  const isMobile = useIsMobileSheet();

  const addressLocked = Boolean(editingProperty?.address_editable === false);

  useEffect(() => {
    setForm({ ...emptyPortalPropertyForm, ...initial });
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

  const checkServiceArea = useCallback(async (address) => {
    const trimmed = address?.trim();
    if (!trimmed || addressLocked) {
      setAreaWarning(null);
      return;
    }
    setAreaChecking(true);
    try {
      const response = await fetch('/api/public/booking-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appliance: 'washer',
          address: trimmed,
        }),
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const detail = errBody.detail;
        const message = Array.isArray(detail)
          ? detail.map((d) => d.msg || d).join(', ')
          : detail || 'Could not verify service area';
        setAreaWarning(message);
        return;
      }
      const data = await response.json();
      if (data?.serviceable === false) {
        setAreaWarning("We can't service this address online. Call (419) 740-0146 for help.");
      } else {
        setAreaWarning(null);
      }
    } catch {
      setAreaWarning(null);
    } finally {
      setAreaChecking(false);
    }
  }, [addressLocked]);

  useEffect(() => {
    if (!form.address?.trim()) {
      setAreaWarning(null);
      return undefined;
    }
    const timer = setTimeout(() => checkServiceArea(form.address), 800);
    return () => clearTimeout(timer);
  }, [form.address, checkServiceArea]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (readOnly) return;
    if (!form.address?.trim()) return;
    const payload = {
      ...form,
      address: form.address.trim(),
      nickname: form.nickname?.trim() || null,
      unit_number: form.unit_number?.trim() || null,
      gate_code: form.gate_code?.trim() || null,
      access_instructions: form.access_instructions?.trim() || null,
      tenant_name: form.tenant_name?.trim() || null,
      tenant_phone: form.tenant_phone?.trim() || null,
      tenant_email: form.tenant_email?.trim() || null,
    };
    onSave(payload);
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
          {readOnly ? (
            <p className="text-sm text-amber-300/90 mb-3">
              Preview is locked — unlock editing in the banner above to change properties.
            </p>
          ) : null}
          {editingProperty ? (
            <p className="text-xs text-gray-500 mb-3">
              Editing {propertyPrimaryTitle(editingProperty)}
            </p>
          ) : null}

          <div className="grid gap-3">
            <div>
              <label style={labelStyle}>Nickname (optional)</label>
              <input
                value={form.nickname || ''}
                onChange={(e) => set({ nickname: e.target.value.slice(0, 60) })}
                placeholder={`e.g. Home, Mom's house, Rental on Main St`}
                style={fieldStyle}
                disabled={readOnly}
                maxLength={60}
              />
            </div>

            <div>
              <label style={labelStyle}>Street address *</label>
              <input
                value={form.address}
                onChange={(e) => set({ address: e.target.value })}
                placeholder="123 Main St, Toledo, OH 43604"
                style={fieldStyle}
                required
                disabled={readOnly || addressLocked}
                autoComplete="street-address"
              />
              {addressLocked ? (
                <p className="mt-1.5 text-[0.7rem] text-amber-400/90">
                  This address has service history and can&apos;t be changed here. Add a new property or call us to update it.
                </p>
              ) : null}
              {areaChecking ? (
                <p className="mt-1.5 text-[0.7rem] text-gray-500">Checking service area…</p>
              ) : null}
              {areaWarning ? (
                <p className="mt-1.5 text-[0.7rem] text-orange-400">{areaWarning}</p>
              ) : null}
            </div>

            <div>
              <label style={labelStyle}>Unit / apt</label>
              <input
                value={form.unit_number || ''}
                onChange={(e) => set({ unit_number: e.target.value })}
                placeholder="Apt 4B"
                style={fieldStyle}
                disabled={readOnly || addressLocked}
              />
            </div>

            <div>
              <label style={labelStyle}>Property type</label>
              <select
                value={form.property_type || 'residential'}
                onChange={(e) => set({ property_type: e.target.value })}
                style={fieldStyle}
                disabled={readOnly}
              >
                {PROPERTY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Gate code</label>
              <input
                value={form.gate_code || ''}
                onChange={(e) => set({ gate_code: e.target.value })}
                style={fieldStyle}
                disabled={readOnly}
              />
            </div>

            <div>
              <label style={labelStyle}>Access instructions</label>
              <input
                value={form.access_instructions || ''}
                onChange={(e) => set({ access_instructions: e.target.value })}
                placeholder="Side door, park in back…"
                style={fieldStyle}
                disabled={readOnly}
              />
            </div>

            <div className="pt-2 border-t border-white/10">
              <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Tenant / occupant (optional)
              </p>
              <div className="grid gap-3">
                <input
                  value={form.tenant_name || ''}
                  onChange={(e) => set({ tenant_name: e.target.value })}
                  placeholder="Tenant name"
                  style={fieldStyle}
                  disabled={readOnly}
                />
                <input
                  value={form.tenant_phone || ''}
                  onChange={(e) => set({ tenant_phone: e.target.value })}
                  placeholder="Tenant phone"
                  style={fieldStyle}
                  disabled={readOnly}
                />
                <input
                  value={form.tenant_email || ''}
                  onChange={(e) => set({ tenant_email: e.target.value })}
                  placeholder="Tenant email"
                  style={fieldStyle}
                  disabled={readOnly}
                />
              </div>
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
          {!readOnly ? (
            <button
              type="submit"
              disabled={submitting || !form.address?.trim()}
              className="flex-[2] rounded-lg border-0 bg-[#00D4FF] px-3 py-3 font-bold text-[#0A0F1E] disabled:opacity-60"
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
          ) : null}
        </footer>
      </form>
    </div>,
    document.body,
  );
}
