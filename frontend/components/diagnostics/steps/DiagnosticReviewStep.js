import { formatDiagnosticSummary } from '../../../constants/diagnosticTemplates';

export default function DiagnosticReviewStep({ context, readOnly, variant }) {
  const isMobile = variant === 'mobile';
  const summary = formatDiagnosticSummary(context?.payload, { workOrder: context?.workOrder });

  return (
    <div
      className={`rounded-xl border p-4 ${
        isMobile ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <h4
        className={`text-sm font-semibold mb-3 ${
          isMobile ? 'text-cyan-300' : 'text-gray-900 dark:text-white'
        }`}
      >
        Review & Save
      </h4>
      <pre
        className={`whitespace-pre-wrap text-sm font-sans ${
          isMobile ? 'text-gray-200' : 'text-gray-800 dark:text-gray-200'
        }`}
      >
        {summary}
      </pre>
      {readOnly && (
        <p className={`text-xs mt-3 ${isMobile ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
          Use Previous to walk through each section.
        </p>
      )}
    </div>
  );
}
