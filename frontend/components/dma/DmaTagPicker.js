import { useEffect, useState } from 'react';
import { getDmaTags } from '../../services/api/dmaApi';

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export default function DmaTagPicker({ value = [], onChange, label = 'Repair tags' }) {
  const [catalog, setCatalog] = useState([]);
  const [custom, setCustom] = useState('');

  useEffect(() => {
    getDmaTags()
      .then((data) => setCatalog(data?.items || []))
      .catch(() => setCatalog([]));
  }, []);

  const selected = new Set((value || []).map(normalizeSlug).filter(Boolean));
  const catalogBySlug = Object.fromEntries(catalog.map((tag) => [tag.slug, tag]));

  const emit = (nextSet) => {
    onChange(Array.from(nextSet));
  };

  const toggle = (slug) => {
    const normalized = normalizeSlug(slug);
    if (!normalized) return;
    const next = new Set(selected);
    if (next.has(normalized)) next.delete(normalized);
    else next.add(normalized);
    emit(next);
  };

  const addCustom = () => {
    const normalized = normalizeSlug(custom);
    if (!normalized) return;
    const next = new Set(selected);
    next.add(normalized);
    emit(next);
    setCustom('');
  };

  const labelFor = (slug) => catalogBySlug[slug]?.label || slug.replace(/_/g, ' ');

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        {catalog.map((tag) => {
          const active = selected.has(tag.slug);
          return (
            <button
              key={tag.slug}
              type="button"
              onClick={() => toggle(tag.slug)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                active
                  ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200'
                  : 'border-white/10 bg-white/[0.03] text-gray-400 hover:border-cyan-500/30'
              }`}
            >
              {tag.label}
            </button>
          );
        })}
      </div>
      {selected.size > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {Array.from(selected)
            .filter((slug) => !catalogBySlug[slug])
            .map((slug) => (
              <button
                key={slug}
                type="button"
                onClick={() => toggle(slug)}
                className="text-xs px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-200"
              >
                {labelFor(slug)} ×
              </button>
            ))}
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Add custom tag…"
          className="flex-1 rounded-lg border border-white/10 bg-[#0A0F1E] px-3 py-2 text-sm text-white placeholder:text-gray-500"
        />
        <button
          type="button"
          onClick={addCustom}
          className="px-3 py-2 rounded-lg border border-white/10 text-xs text-gray-300 hover:border-cyan-500/30"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function DmaTagPills({ tags = [] }) {
  if (!tags?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag.slug || tag.label}
          className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
        >
          {tag.label || tag.slug}
        </span>
      ))}
    </div>
  );
}
