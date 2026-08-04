import { useMemo, useState } from 'react';
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

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
    >
      <div style={{
        width: '100%', maxWidth: '640px', maxHeight: '90vh', overflow: 'auto',
        background: '#0B0F1A', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '16px', padding: '1.5rem',
      }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ color: '#fff', margin: 0, fontSize: '1.25rem' }}>
              {isOnboarding ? 'Import your appliances' : 'Add from service history'}
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
              {isOnboarding
                ? 'We found these from your service history. Confirm or edit before saving.'
                : 'These appliances were found on past work orders. Select what to add to your account.'}
            </p>
          </div>
          <button type="button" onClick={onSkip} style={{ color: '#6b7280', background: 'none', border: 'none' }}>
            <FaTimes />
          </button>
        </div>

        {mergeGroups.length > 0 && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <p style={{ color: '#f59e0b', fontSize: '0.8125rem', margin: '0 0 0.5rem' }}>
              Some items look like duplicates. Merge them into one appliance?
            </p>
            {mergeGroups.map(([hint, ids]) => (
              <button
                key={hint}
                type="button"
                onClick={() => handleMergeGroup(hint)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  marginRight: '0.5rem', marginBottom: '0.35rem',
                  background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)',
                  borderRadius: '6px', padding: '0.35rem 0.65rem', fontSize: '0.75rem', cursor: 'pointer',
                }}
              >
                <FaCompressArrowsAlt /> Merge {ids.length} similar
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button
            type="button"
            onClick={onSkip}
            style={{
              flex: 1, padding: '0.75rem', borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#9ca3af',
            }}
          >
            {isOnboarding ? 'Skip for now' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={submitting || selectedItems.length === 0}
            onClick={() => onConfirm(selectedItems)}
            style={{
              flex: 2, padding: '0.75rem', borderRadius: '8px', border: 'none',
              background: '#00D4FF', color: '#0A0F1E', fontWeight: 700,
              opacity: submitting || selectedItems.length === 0 ? 0.6 : 1,
            }}
          >
            <FaCheck style={{ marginRight: '0.35rem' }} />
            {submitting ? 'Saving...' : `Save ${selectedItems.length} appliance${selectedItems.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
