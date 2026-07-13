import DiagnosticSectionFields from '../DiagnosticSectionFields';
import { COMPLAINT_TAGS_FIELD } from '../routing/routingEngine';

function ComplaintChipPicker({ chips, selectedIds, onChange, readOnly, variant }) {
  const isMobile = variant === 'mobile';
  if (!chips?.length) return null;

  const toggle = (id) => {
    if (readOnly) return;
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <p className={`text-sm font-medium ${isMobile ? 'text-gray-300' : 'text-gray-700 dark:text-gray-300'}`}>
        Complaint category (select all that apply)
      </p>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const active = selectedIds.includes(chip.id);
          return (
            <button
              key={chip.id}
              type="button"
              disabled={readOnly}
              onClick={() => toggle(chip.id)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? isMobile
                    ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200'
                    : 'border-cyan-600 bg-cyan-50 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200'
                  : isMobile
                    ? 'border-white/10 bg-white/[0.03] text-gray-400'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
      <p className={`text-[11px] ${isMobile ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
        Your selections determine which diagnostic steps appear next.
      </p>
    </div>
  );
}

/** Complaint step with structured chips + template fields. */
export default function ComplaintStep({ context, meta, readOnly, variant }) {
  const section = meta?.section;
  if (!section) return null;

  const fields = context?.payload?.fields || {};
  const chips = context?.complaintChips || [];
  const selectedIds = Array.isArray(fields[COMPLAINT_TAGS_FIELD])
    ? fields[COMPLAINT_TAGS_FIELD]
    : [];

  const handleChipChange = (nextIds) => {
    context.onFieldChange(COMPLAINT_TAGS_FIELD, nextIds);
  };

  return (
    <div className="space-y-4">
      {chips.length > 0 && (
        <ComplaintChipPicker
          chips={chips}
          selectedIds={selectedIds}
          onChange={handleChipChange}
          readOnly={readOnly}
          variant={variant}
        />
      )}
      <DiagnosticSectionFields
        section={section}
        fields={fields}
        onFieldChange={context.onFieldChange}
        readOnly={readOnly}
        variant={variant}
        fieldVisibilityRules={context?.fieldVisibilityRules}
        fieldHelp={context?.fieldHelp}
        activeRecommendations={context?.activeRecommendations}
      />
    </div>
  );
}
