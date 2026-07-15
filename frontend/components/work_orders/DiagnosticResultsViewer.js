import {
  formatDiagnosticChecklist,
  formatDiagnosticVisitLabel,
  getDiagnosticTemplate,
} from '../../constants/diagnosticTemplates';
import { formatAutoNoteForTextarea } from '../diagnostics/intelligence/formatAutoNoteSection';

export default function DiagnosticResultsViewer({ payload, workOrder, variant = 'desktop' }) {
  const isMobile = variant === 'mobile';
  const template = getDiagnosticTemplate(payload?.templateId);
  const checklistText = formatDiagnosticChecklist(payload, { workOrder });
  const appointments = Array.isArray(workOrder?.appointments) ? workOrder.appointments : [];
  const visitLabel = formatDiagnosticVisitLabel(
    appointments.find((a) => String(a.id) === String(payload?.appointmentId || '')),
  );

  const displaySummary = payload?.includeAutoNoteInSummary !== false && payload?.autoNoteBullets?.length
    ? formatAutoNoteForTextarea(payload.autoNoteBullets, payload?.autoNoteFormat || 'bullets')
    : '';

  return (
    <div className="space-y-5">
      <div
        className={`rounded-xl border px-4 py-3 text-sm space-y-1 ${
          isMobile
            ? 'border-white/10 bg-white/[0.02] text-gray-300'
            : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
        }`}
      >
        <div>
          <span className="font-medium">Appliance:</span> {template?.label || payload?.templateId || '—'}
        </div>
        {visitLabel && (
          <div>
            <span className="font-medium">Visit:</span> {visitLabel}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${
            isMobile ? 'text-emerald-300/90' : 'text-emerald-700 dark:text-emerald-300'
          }`}
        >
          Summary
        </p>
        {displaySummary ? (
          <pre
            className={`whitespace-pre-wrap rounded-lg border px-3 py-3 text-sm font-sans ${
              isMobile
                ? 'border-white/10 bg-black/20 text-gray-100'
                : 'border-gray-200 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100'
            }`}
          >
            {displaySummary}
          </pre>
        ) : (
          <p className={`text-sm ${isMobile ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
            No summary was recorded for this diagnostic.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${
            isMobile ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          Full checklist
        </p>
        <pre
          className={`whitespace-pre-wrap rounded-lg border px-3 py-3 text-sm font-sans ${
            isMobile
              ? 'border-white/10 bg-black/20 text-gray-200'
              : 'border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'
          }`}
        >
          {checklistText || 'No checklist readings recorded.'}
        </pre>
      </div>
    </div>
  );
}
