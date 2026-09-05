/** Parse comma-separated stored values into a de-duplicated chip list. */
export function parseChipList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
  }
  const parts = String(value).split(',');
  const seen = new Set();
  const out = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export function joinChipList(items) {
  return parseChipList(items).join(', ');
}

export function formatCodeListLabels(codeMap, value) {
  return parseChipList(value)
    .map((token) => codeMap[token] || token.replace(/_/g, ' '))
    .join(', ');
}

/** Resolve typed text to a suggestion value (slug), or null if no match. */
export function resolveSuggestionToken(raw, suggestions = []) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const exact = suggestions.find((s) => s.value === trimmed || s.value === lower);
  if (exact) return exact.value;
  const byLabel = suggestions.find((s) => String(s.label || '').toLowerCase() === lower);
  if (byLabel) return byLabel.value;
  const partial = suggestions.find(
    (s) => String(s.label || '').toLowerCase().includes(lower)
      || String(s.value || '').toLowerCase().includes(lower),
  );
  return partial?.value ?? null;
}
