/** Render persisted auto-note bullets as a plain-text section for note display. */
export function formatAutoNoteSection(bullets: string[] | null | undefined): string {
  if (!bullets?.length) return '';
  return [
    'Diagnostic summary:',
    ...bullets.map((bullet) => `• ${bullet.trim()}`).filter((line) => line !== '•'),
  ].join('\n');
}

/** Normalize user-edited bullet text (one bullet per line) into a string array. */
export function parseAutoNoteBulletText(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^[•\-*]\s*/, '').trim())
    .filter(Boolean);
}
