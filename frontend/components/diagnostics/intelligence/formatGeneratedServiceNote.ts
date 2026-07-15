export interface GeneratedDiagnosticNotes {
  rootCauseSummary: string;
  technicianNote: string;
  customerExplanation: string;
  source?: string;
  model?: string | null;
  fallbackReason?: string | null;
}

/** Merge Gemini (or fallback) sections into one editable prose block. */
export function formatGeneratedServiceNote(
  response: GeneratedDiagnosticNotes,
): string[] {
  const sections: string[] = [];

  const summary = response.rootCauseSummary?.trim();
  const technicianNote = response.technicianNote?.trim();
  const customer = response.customerExplanation?.trim();

  if (summary) {
    sections.push(`Diagnosis\n${summary}`);
  }
  if (technicianNote) {
    sections.push(technicianNote);
  }
  if (customer) {
    sections.push(`Customer explanation\n\n${customer}`);
  }

  const prose = sections.join('\n\n').trim();
  return prose ? [prose] : [];
}
