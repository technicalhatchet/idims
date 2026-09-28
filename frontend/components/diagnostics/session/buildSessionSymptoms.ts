import { getComplaintChipIds } from '../routing/routingEngine';
import type { DiagnosticSymptom } from './types';

const ERROR_CODES_FIELD = 'customer_complaint.error_codes';

function parseErrorCodeTokens(raw: unknown): string[] {
  if (!raw) return [];
  const text = String(raw).trim();
  if (!text) return [];
  const tokens = text.split(/[\s,;]+/).map((part) => part.trim()).filter(Boolean);
  return tokens;
}

export function buildSessionSymptoms(fields: Record<string, unknown> = {}): DiagnosticSymptom[] {
  const symptoms: DiagnosticSymptom[] = [];

  for (const chipId of getComplaintChipIds(fields)) {
    symptoms.push({
      id: chipId,
      source: 'wizard_selection',
      value: chipId,
    });
  }

  const complaintText = fields['customer_complaint.complaint'];
  if (typeof complaintText === 'string' && complaintText.trim()) {
    symptoms.push({
      id: 'customer_complaint',
      source: 'customer_report',
      value: complaintText.trim(),
    });
  }

  for (const code of parseErrorCodeTokens(fields[ERROR_CODES_FIELD])) {
    symptoms.push({
      id: code,
      source: 'error_code',
      value: code,
    });
  }

  return symptoms;
}
