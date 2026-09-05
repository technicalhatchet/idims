import { useState } from 'react';
import { joinChipList, parseChipList } from '../../utils/dmaListField';
import { uppercasePreserve } from '../../utils/solomonFieldSanitize';

/**
 * Free-text multi-value chip input — press Enter to add each value.
 */
export default function DmaChipInput({
  value = '',
  onChange,
  label,
  placeholder = 'Type and press Enter…',
  uppercase = false,
  disabled = false,
  variant = 'dark',
  hint = null,
}) {
  const isDark = variant === 'dark';
  const chips = parseChipList(value);
  const [draft, setDraft] = useState('');

  const normalizeToken = (raw) => {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return null;
    return uppercase ? uppercasePreserve(trimmed) : trimmed;
  };

  const addChip = (raw) => {
    const token = normalizeToken(raw);
    if (!token || chips.includes(token)) return;
    onChange(joinChipList([...chips, token]));
    setDraft('');
  };

  const removeChip = (token) => {
    onChange(joinChipList(chips.filter((c) => c !== token)));
  };

  const chipClass = isDark
    ? 'border-cyan-500/35 bg-cyan-500/10 text-cyan-100'
    : 'border-cyan-600/40 bg-cyan-50 text-cyan-900 dark:border-cyan-500/35 dark:bg-cyan-500/10 dark:text-cyan-100';

  const inputClass = isDark
    ? 'w-full rounded-lg border border-white/10 bg-[#0A0F1E] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none'
    : 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 dark:border-white/10 dark:bg-[#0A0F1E] dark:text-white';

  const labelClass = isDark
    ? 'block text-xs uppercase tracking-wide text-gray-400 mb-1'
    : 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  return (
    <div>
      {label ? <label className={labelClass}>{label}</label> : null}
      {hint ? (
        <p className={`text-[10px] mb-2 ${isDark ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
          {hint}
        </p>
      ) : null}

      {!disabled ? (
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(uppercase ? uppercasePreserve(e.target.value) : e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addChip(draft);
            }
            if (e.key === 'Backspace' && !draft && chips.length) {
              removeChip(chips[chips.length - 1]);
            }
          }}
          disabled={disabled}
          placeholder={placeholder}
          className={inputClass}
          autoCapitalize={uppercase ? 'characters' : 'off'}
          autoCorrect="off"
          spellCheck={false}
        />
      ) : null}

      {chips.length > 0 ? (
        <div className={`flex flex-wrap gap-1.5 ${!disabled ? 'mt-2' : ''}`}>
          {chips.map((token) => (
            <span
              key={token}
              className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${chipClass}`}
            >
              <span>{token}</span>
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => removeChip(token)}
                  className="opacity-70 hover:opacity-100 leading-none"
                  aria-label={`Remove ${token}`}
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
