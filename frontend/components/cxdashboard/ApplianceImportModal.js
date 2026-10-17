import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaCheck, FaCompressArrowsAlt, FaTimes } from 'react-icons/fa';
import ApplianceIcon from './ApplianceIcon';
import { applianceDisplayName, EQUIPMENT_SUBTYPES, EQUIPMENT_TYPES, MANUFACTURERS } from '../../constants/applianceEquipment';

const fieldStyle = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '0.875rem',
  boxSizing: 'border-box',
};

function CandidateRow({ item, selected, onToggle, onChange }) {
  return (
    <div
      style={{
        border: `1px solid ${selected ? 'rgba(0,212,255,0.35)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '10px',
        padding: '1rem',
        background: selected ? 'rgba(0,212,255,0.05)' : '#0D1525',
      }}
    >
      <label style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', cursor: 'pointer' }}>
        <input type="checkbox" checked={selected} onChange={onToggle} style={{ marginTop: '4px' }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
            <ApplianceIcon type={item.equipment_subtype || item.equipment_type} className="w-7 h-7" />
            <div>
              <p style={{ color: '#fff', fontWeight: 600, margin: 0 }}>{applianceDisplayName(item)}</p>
              <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '2px 0 0' }}>
                {item.service_count} past service{item.service_count !== 1 ? 's' : ''}
                {item.property?.address ? ` · ${item.property.address}` : ''}
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <select
              value={item.equipment_type || 'appliance'}
              onChange={(e) => onChange({ equipment_type: e.target.value, equipment_subtype: '' })}
              style={fieldStyle}
            >
              {EQUIPMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={item.equipment_subtype || ''}
              onChange={(e) => onChange({ equipment_subtype: e.target.value })}
              style={fieldStyle}
            >
              <option value="">Subtype</option>
              {(EQUIPMENT_SUBTYPES[item.equipment_type || 'appliance'] || []).map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <input
              list={`makes-${item.candidate_id}`}
              placeholder="Make *"
              value={item.make || ''}
              onChange={(e) => onChange({ make: e.target.value })}
              style={fieldStyle}
            />
            <datalist id={`makes-${item.candidate_id}`}>
              {MANUFACTURERS.map((m) => <option key={m} value={m} />)}
            </datalist>
            <input
              placeholder="Model"
              value={item.model || ''}
              onChange={(e) => onChange({ model: e.target.value })}
              style={fieldStyle}
            />
            <input
              placeholder="Serial"
              value={item.serial || ''}
              onChange={(e) => onChange({ serial: e.target.value })}
              style={fieldStyle}
            />
          </div>
        </div>
      </label>
    </div>
  );
}

export default function ApplianceImportModal({
  candidates,
  onConfirm,
  onSkip,
  submitting,
  mode = 'onboarding',
}) {
  const isOnboarding = mode === 'onboarding';
  const [items, setItems] = useState(() => candidates.map((c) => ({ ...c, selected: true })));
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const mergeGroups = useMemo(() => {
    const groups = {};
    items.forEach((item) => {
      if (!item.merge_group_hint) return;
      groups[item.merge_group_hint] = groups[item.merge_group_hint] || [];
      groups[item.merge_group_hint].push(item.candidate_id);
    });
    return Object.entries(groups).filter(([, ids]) => ids.length > 1);
  }, [items]);

  const updateItem = (candidateId, patch) => {
    setItems((prev) => prev.map((item) => (
      item.candidate_id === candidateId ? { ...item, ...patch } : item
    )));
  };

  const handleMergeGroup = (hint) => {
    const group = items.filter((i) => i.merge_group_hint === hint);
    if (group.length < 2) return;
    const keep = group[0];
    const others = group.slice(1);
    setItems((prev) => prev.filter((i) => !others.some((o) => o.candidate_id === i.candidate_id))
      .map((i) => (
        i.candidate_id === keep.candidate_id
          ? {
            ...i,
            work_order_ids: [...new Set([...(i.work_order_ids || []), ...others.flatMap((o) => o.work_order_ids || [])])],
            service_count: (i.service_count || 0) + others.reduce((sum, o) => sum + (o.service_count || 0), 0),
          }
          : i
      )));
  };

  const selectedItems = items.filter((i) => i.selected);
  const title = isOnboarding ? 'Import your appliances' : 'Add from service history';
  const subtitle = isOnboarding
    ? 'We found these from your service history. Confirm or edit before saving.'
    : 'These appliances were found on past work orders. Select what to add to your account.';

  if (typeof document === 'undefined') return null;

  const shellClass = isMobile
    ? 'relative z-[1] flex h-full w-full max-h-full flex-col rounded-none border-0 bg-[#0B0F1A]'
    : 'relative z-[1] flex w-full max-h-[min(90vh,720px)] max-w-[640px] flex-col overflow-hidden rounded-2xl border border-cyan-500/20 bg-[#0B0F1A]';

  const overlayAlign = isMobile ? 'items-stretch justify-stretch p-0' : 'items-center justify-center p-4';

  return createPortal(
    <div className={`fixed inset-0 z-[9999] flex ${overlayAlign} touch-manipulation`}>
      <button type="button" aria-label="Close dialog backdrop" className="absolute inset-0 bg-black/75" onClick={onSkip} />

      <div className={shellClass}>
        <header
          className={`sticky top-0 z-10 flex shrink-0 items-start justify-between gap-3 border-b border-white/10 bg-[#0B0F1A] px-4 py-3 ${
            isMobile ? 'pt-[max(12px,env(safe-area-inset-top))]' : ''
          }`}
        >
          <div className="min-w-0 pr-2">
            <h2 className="m-0 text-lg font-semibold text-white">{title}</h2>
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:text-gray-300"
            aria-label="Close"
          >
            <FaTimes />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {mergeGroups.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
              <p className="mb-2 text-[0.8125rem] text-amber-400">
                Some items look like duplicates. Merge them into one appliance?
              </p>
              {mergeGroups.map(([hint, ids]) => (
                <button
                  key={hint}
                  type="button"
                  onClick={() => handleMergeGroup(hint)}
                  className="mb-1 mr-2 inline-flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-xs text-amber-300"
                >
                  <FaCompressArrowsAlt /> Merge {ids.length} similar
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <CandidateRow
                key={item.candidate_id}
                item={item}
                selected={item.selected}
                onToggle={() => updateItem(item.candidate_id, { selected: !item.selected })}
                onChange={(patch) => updateItem(item.candidate_id, patch)}
              />
            ))}
          </div>
        </div>

        <footer
          className={`sticky bottom-0 z-10 flex shrink-0 gap-3 border-t border-white/10 bg-[#0B0F1A] px-4 py-3 ${
            isMobile ? 'pb-[max(12px,env(safe-area-inset-bottom))]' : ''
          }`}
        >
          <button type="button" onClick={onSkip} className="flex-1 rounded-lg border border-white/10 px-3 py-3 text-gray-400">
            {isOnboarding ? 'Skip for now' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={submitting || selectedItems.length === 0}
            onClick={() => onConfirm(selectedItems)}
            className="flex-[2] rounded-lg border-0 bg-[#00D4FF] px-3 py-3 font-bold text-[#0A0F1E] disabled:opacity-60"
          >
            <FaCheck className="mr-1 inline" />
            {submitting ? 'Saving...' : `Save ${selectedItems.length} appliance${selectedItems.length !== 1 ? 's' : ''}`}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
