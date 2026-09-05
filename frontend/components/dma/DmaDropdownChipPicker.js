import { useState } from 'react';
import { joinChipList, parseChipList } from '../../utils/dmaListField';

/**
 * Dropdown picker — each selection adds a chip underneath. Already-selected options are hidden.
 */
export default function DmaDropdownChipPicker({
  value = '',
  onChange,
  label,
  options = [],
  placeholder = 'Select…',
  disabled = false,
  variant = 'dark',
  hint = null,
}) {
  const isDark = variant === 'dark';
  const chips = parseChipList(value);
  const [draft, setDraft] = useState('');

  const labelFor = (token) => {
    return options.find((o) => o.value === token)?.label || token.replace(/_/g, ' ');
  };

  const addChip = (token) => {
    if (!token || chips.includes(token)) return;
    onChange(joinChipList([...chips, token]));
    setDraft('');
  };

  const removeChip = (token) => {
    onChange(joinChipList(chips.filter((c) => c !== token)));
  };

  const availableOptions = options.filter((o) => o.value && !chips.includes(o.value));

  const chipClass = isDark
    ? 'border-cyan-500/35 bg-cyan-500/10 text-cyan-100'
    : 'border-cyan-600/40 bg-cyan-50 text-cyan-900 dark:border-cyan-500/35 dark:bg-cyan-500/10 dark:text-cyan-100';

  const labelClass = isDark
    ? 'block text-xs uppercase tracking-wide text-gray-400 mb-1'
    : 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  const selectClass = isDark
    ? 'w-full rounded-lg border border-white/10 bg-[#0A0F1E] px-3 py-2.5 text-sm text-white focus:border-cyan-500/50 focus:outline-none'
    : 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-[#0A0F1E] dark:text-white';

  return (
    <div>
      {label ? <label className={labelClass}>{label}</label> : null}
      {hint ? (
        <p className={`text-[10px] mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
          {hint}
        </p>
      ) : null}

      {!disabled ? (
        <select
          value={draft}
          onChange={(e) => {
            const next = e.target.value;
            setDraft(next);
            if (next) addChip(next);
          }}
          disabled={disabled || availableOptions.length === 0}
          className={selectClass}
        >
          <option value="">
            {availableOptions.length === 0 && chips.length
              ? 'All options selected'
              : placeholder}
          </option>
          {availableOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : null}

      {chips.length > 0 ? (
        <div className={`flex flex-wrap gap-1.5 ${!disabled ? 'mt-2' : ''}`}>
          {chips.map((token) => (
            <span
              key={token}
              className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${chipClass}`}
            >
              <span>{labelFor(token)}</span>
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => removeChip(token)}
                  className="opacity-70 hover:opacity-100 leading-none"
                  aria-label={`Remove ${labelFor(token)}`}
                >
                  ×
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
