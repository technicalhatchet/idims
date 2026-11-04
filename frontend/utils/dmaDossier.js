/**
 * Repair Memory dossier: what an opened search result shows.
 */
import { format } from 'date-fns';
import { codeLabel } from '../constants/dmaCodes';

/** Folder-tab text: "DMA // F21", or "DMA // NO CODE" when the repair had no error code. */
export function dossierTag(item) {
  const raw = String(item?.error_code_text || '').trim().toUpperCase();
  const code = raw.split(/[\s,;/]+/).filter(Boolean)[0] || '';
  return `DMA // ${code ? code.slice(0, 12) : 'NO CODE'}`;
}

/** Corner stamp: how the repair turned out. */
export function dossierStamp(item) {
  if (item?.callback_required) return { label: 'CALLBACK', tone: 'orange' };
  if (item && item.repair_successful === false) return { label: 'UNSUCCESSFUL', tone: 'orange' };
  return { label: 'CONFIRMED', tone: 'green' };
}

function performedLabel(item) {
  if (!item?.performed_on) return '';
  try {
    return format(new Date(`${item.performed_on}T12:00:00`), 'MMM d, yyyy');
  } catch {
    return '';
  }
}

/**
 * Dossier sections in reading order; empty ones are left out.
 * @returns {{ key: string, label: string, value: string, tone?: string }[]}
 */
export function dossierRows(item, { problemOptions = {}, resolutionOptions = {} } = {}) {
  if (!item) return [];
  const problem = codeLabel(problemOptions, item.problem_code);
  const resolution = codeLabel(resolutionOptions, item.resolution_code);
  const model = [item.equipment_model, item.equipment_serial ? `S/N ${item.equipment_serial}` : ''].filter(Boolean).join(' · ');
  const outcome = item.repair_successful === false
    ? `Unsuccessful${item.callback_required ? ' · Callback required' : ''}`
    : `Successful${item.callback_required ? ' · Callback required' : ''}`;
  const rows = [
    { key: 'symptom', label: 'SYMPTOM', value: item.customer_complaint || item.work_order_description || '' },
    { key: 'path', label: 'PROBLEM → RESOLUTION', value: problem && resolution ? `${problem} → ${resolution}` : problem || resolution },
    { key: 'parts', label: 'PARTS REPLACED', value: item.replaced_parts || '' },
    { key: 'notes', label: 'TECH NOTES', value: item.technician_summary || '' },
    { key: 'model', label: 'MODEL', value: model },
    { key: 'performed', label: 'PERFORMED', value: performedLabel(item) },
    { key: 'outcome', label: 'OUTCOME', value: outcome, tone: item.repair_successful === false || item.callback_required ? 'orange' : 'green' },
  ];
  return rows.filter((r) => String(r.value || '').trim());
}
