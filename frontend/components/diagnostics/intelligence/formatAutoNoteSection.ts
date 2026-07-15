export type AutoNoteFormat = 'bullets' | 'prose';

/** Render persisted auto-note content as a plain-text section for note display. */
export function formatAutoNoteSection(
  bullets: string[] | null | undefined,
  format: AutoNoteFormat = 'bullets',
): string {
  if (!bullets?.length) return '';

  if (format === 'prose') {
    return ['Diagnostic summary:', '', bullets.join('\n\n')].join('\n');
  }

  return [
    'Diagnostic summary:',
    ...bullets.map((bullet) => `• ${bullet.trim()}`).filter((line) => line !== '•'),
  ].join('\n');
}

/** Format stored note content for the Review textarea. */
export function formatAutoNoteForTextarea(
  bullets: string[] | null | undefined,
  format: AutoNoteFormat = 'bullets',
): string {
  if (!bullets?.length) return '';

  if (format === 'prose') {
    return bullets.join('\n\n');
  }

  return bullets.map((bullet) => `• ${bullet.trim()}`).join('\n');
}

/** Normalize user-edited bullet text (one bullet per line) into a string array. */
export function parseAutoNoteBulletText(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^[•\-*]\s*/, '').trim())
    .filter(Boolean);
}

/** Normalize edited textarea text back into stored auto-note bullets. */
export function parseAutoNoteText(text: string, format: AutoNoteFormat = 'bullets'): string[] {
  if (format === 'prose') {
    const trimmed = text.trim();
    return trimmed ? [trimmed] : [];
  }
  return parseAutoNoteBulletText(text);
}
