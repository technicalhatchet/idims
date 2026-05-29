import { useEffect, useState } from 'react';
import { getDmaTags } from '../../services/api/dmaApi';

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export default function DmaTagPicker({ value = [], onChange, label = 'Repair tags', variant = 'dark' }) {
  const [catalog, setCatalog] = useState([]);
  const [catalogState, setCatalogState] = useState('loading');
  const [custom, setCustom] = useState('');
  const isDark = variant === 'dark';

  useEffect(() => {
    getDmaTags()
      .then((data) => {
        setCatalog(data?.items || []);
        setCatalogState('ready');
      })
      .catch(() => {
        setCatalog([]);
        setCatalogState('error');
      });
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

  const chipClass = (active) => {
    if (active) {
      return isDark
        ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200'
        : 'border-cyan-600 bg-cyan-50 text-cyan-800';
    }
    return isDark
      ? 'border-white/10 bg-white/[0.03] text-gray-400 hover:border-cyan-500/30'
      : 'border-gray-300 bg-gray-50 text-gray-700 hover:border-cyan-400';
  };

  return (
    <div>
      <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700 dark:text-gray-300'}`}>
        {label}
      </label>
      <p className={`text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
        Tap preset tags to select them. Use the box below only for tags not in the list.
      </p>
      {catalogState === 'loading' && (
        <p className={`text-xs mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>Loading tags…</p>
      )}
      {catalogState === 'error' && (
        <p className="text-xs mb-2 text-amber-600 dark:text-amber-300">
          Could not load preset tags. You can still add custom tags below, or check that the DMA tags migration ran.
        </p>
      )}
      {catalogState === 'ready' && catalog.length === 0 && (
        <p className="text-xs mb-2 text-amber-600 dark:text-amber-300">
          No preset tags in the catalog yet. Run <code className="text-[11px]">supabase_dma_tags.sql</code> in Supabase, or add custom tags below.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {catalog.map((tag) => {
          const active = selected.has(tag.slug);
          return (
            <button
              key={tag.slug}
              type="button"
              onClick={() => toggle(tag.slug)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${chipClass(active)}`}
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
          className={
            isDark
              ? 'flex-1 rounded-lg border border-white/10 bg-[#0A0F1E] px-3 py-2 text-sm text-white placeholder:text-gray-500'
              : 'flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 dark:border-white/10 dark:bg-[#0A0F1E] dark:text-white'
          }
        />
        <button
          type="button"
          onClick={addCustom}
          className={
            isDark
              ? 'px-3 py-2 rounded-lg border border-white/10 text-xs text-gray-300 hover:border-cyan-500/30'
              : 'px-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-700 hover:border-cyan-400 dark:border-white/10 dark:text-gray-300'
          }
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
