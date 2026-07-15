import type { EvidenceLedgerEntry } from './evidenceTypes';
import { isOppositeOkComponentElimination } from './ledgerTrigger';

/**
 * Collapse redundant component ledger lines (mirror OK eliminations, duplicate confirms).
 */
export function dedupeLedgerEntries(entries: EvidenceLedgerEntry[]): EvidenceLedgerEntry[] {
  if (!entries.length) return [];

  const componentLayer = entries[0]?.targetLayer === 'component';
  let filtered = entries;

  if (componentLayer) {
    const hasConfirm = entries.some((entry) => entry.effect === 'confirm');
    if (hasConfirm) {
      filtered = entries.filter(
        (entry) => !isOppositeOkComponentElimination(entry.explanation, entry.effect, entry.targetLayer),
      );
    }
  }

  const byKey = new Map<string, EvidenceLedgerEntry>();
  for (const entry of filtered) {
    const triggerKey = entry.trigger
      ? `${entry.trigger.type}:${entry.trigger.label}:${entry.trigger.value || ''}`
      : '';
    const key = `${entry.effect}:${entry.explanation}:${triggerKey}`;
    const existing = byKey.get(key);
    if (!existing || Math.abs(entry.delta) > Math.abs(existing.delta)) {
      byKey.set(key, entry);
    }
  }

  return [...byKey.values()].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}
