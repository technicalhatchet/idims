import { useEffect, useMemo, useState } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { SelectInput } from '../ui/FormElements';
import {
  formatDiagnosticVisitLabel,
  getDiagnosticTemplate,
  getInitialDiagnosticFieldValues,
  listDiagnosticTemplates,
} from '../../constants/diagnosticTemplates';

const TRI_OPTIONS = [
  { value: '', label: '—' },
  { value: 'not_checked', label: 'Not Checked' },
  { value: 'good', label: 'Good' },
  { value: 'bad', label: 'Bad' },
];

const YN_OPTIONS = [
  { value: '', label: '—' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

const GB_OPTIONS = [
  { value: '', label: '—' },
  { value: 'good', label: 'Good' },
  { value: 'bad', label: 'Bad' },
];

const LINT_OPTIONS = [
  { value: '', label: '—' },
  { value: 'normal', label: 'Normal' },
  { value: 'excessive', label: 'Excessive' },
];

const TUB_OPTIONS = [
  { value: '', label: '—' },
  { value: 'normal', label: 'Normal' },
  { value: 'excessive', label: 'Excessive' },
];

function fieldKey(sectionId, fieldId) {
  return `${sectionId}.${fieldId}`;
}

const DEFAULT_EXPANDED_SECTIONS = new Set(['commonly_missed', 'customer_complaint', 'diagnosis']);

function isFieldFilled(field, value) {
  if (field.type === 'check') return !!value;
  return value != null && String(value).trim() !== '';
}

function countSectionFilled(section, fields = {}) {
  return section.fields.reduce((count, field) => {
    return count + (isFieldFilled(field, fields[fieldKey(section.id, field.id)]) ? 1 : 0);
  }, 0);
}

function sectionSummary(section, fields = {}) {
  const filled = section.fields.filter((field) =>
    isFieldFilled(field, fields[fieldKey(section.id, field.id)]),
  );
  if (!filled.length) return 'No entries yet';
  if (filled.length === 1) {
    const field = filled[0];
    const value = fields[fieldKey(section.id, field.id)];
    if (field.type === 'check') return field.label;
    if (field.type === 'textarea' || field.type === 'text') {
      const text = String(value).trim();
      return text.length > 48 ? `${text.slice(0, 48)}…` : text;
    }
    return field.label;
  }
  return `${filled.length} of ${section.fields.length} filled`;
}

function buildInitialExpandedSections(sections, fields = {}) {
  const expanded = {};
  for (const section of sections) {
    const filled = countSectionFilled(section, fields);
    expanded[section.id] = filled > 0 || DEFAULT_EXPANDED_SECTIONS.has(section.id);
  }
  return expanded;
}

function DiagnosticSection({
  section,
  fields,
  expanded,
  onToggle,
  children,
  variant,
}) {
  const isMobile = variant === 'mobile';
  const filledCount = countSectionFilled(section, fields);
  const totalCount = section.fields.length;

  return (
    <div
      className={`rounded-xl border overflow-hidden ${
        isMobile ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
          isMobile ? 'active:bg-white/[0.04]' : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4
              className={`text-sm font-semibold ${
                isMobile ? 'text-cyan-300' : 'text-gray-900 dark:text-white'
              }`}
            >
              {section.title}
            </h4>
            <span
              className={`text-[10px] font-medium uppercase tracking-wide rounded-full px-2 py-0.5 ${
                filledCount > 0
                  ? isMobile
                    ? 'bg-cyan-500/15 text-cyan-200'
                    : 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200'
                  : isMobile
                    ? 'bg-white/5 text-gray-500'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              {filledCount}/{totalCount}
            </span>
          </div>
          {!expanded && (
            <p className={`text-xs truncate mt-0.5 ${isMobile ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
              {sectionSummary(section, fields)}
            </p>
          )}
        </div>
        {expanded ? (
          <FaChevronUp className={`h-4 w-4 flex-shrink-0 ${isMobile ? 'text-cyan-400/70' : 'text-gray-400'}`} />
        ) : (
          <FaChevronDown className={`h-4 w-4 flex-shrink-0 ${isMobile ? 'text-cyan-400/70' : 'text-gray-400'}`} />
        )}
      </button>
      {expanded && (
        <div
          className={`px-4 pb-4 pt-1 space-y-3 border-t ${
            isMobile ? 'border-white/10' : 'border-gray-200 dark:border-gray-700'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function ChipGroup({ value, options, onChange, disabled, variant = 'mobile' }) {
  const isMobile = variant === 'mobile';
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value || 'empty'}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
              active
                ? isMobile
                  ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200'
                  : 'border-cyan-600 bg-cyan-50 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200'
                : isMobile
                  ? 'border-white/10 bg-white/[0.03] text-gray-400'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function renderFieldControl(field, sectionId, value, onChange, readOnly, variant) {
  const key = fieldKey(sectionId, field.id);
  const disabled = readOnly;

  if (field.type === 'check') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!value}
          disabled={disabled}
          onChange={(e) => onChange(key, e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
        />
        <span className={variant === 'mobile' ? 'text-gray-300' : 'text-gray-700 dark:text-gray-300'}>
          {field.label}
        </span>
      </label>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-500">{field.label}</label>
        <textarea
          value={value || ''}
          disabled={disabled}
          rows={3}
          onChange={(e) => onChange(key, e.target.value)}
          className={`w-full rounded-lg border px-3 py-2 text-sm ${
            variant === 'mobile'
              ? 'border-white/10 bg-[#0A0F1E] text-white'
              : 'border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white'
          }`}
        />
      </div>
    );
  }

  if (field.type === 'text') {
    return (
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-500">{field.label}</label>
        <input
          type="text"
          value={value || ''}
          disabled={disabled}
          onChange={(e) => onChange(key, e.target.value)}
          className={`w-full rounded-lg border px-3 py-2 text-sm ${
            variant === 'mobile'
              ? 'border-white/10 bg-[#0A0F1E] text-white'
              : 'border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white'
          }`}
        />
      </div>
    );
  }

  let options = GB_OPTIONS;
  if (field.type === 'tri') options = TRI_OPTIONS;
  if (field.type === 'yn') options = YN_OPTIONS;
  if (field.id === 'lint_accumulation') options = LINT_OPTIONS;
  if (field.id === 'tub_movement') options = TUB_OPTIONS;

  return (
    <div>
      <p className="text-sm font-medium mb-1.5 text-gray-500">{field.label}</p>
      <ChipGroup
        value={value || ''}
        options={options}
        onChange={(next) => onChange(key, next)}
        disabled={disabled}
        variant={variant}
      />
    </div>
  );
}

export default function DiagnosticResultsForm({
  payload,
  onChange,
  workOrder = null,
  readOnly = false,
  variant = 'mobile',
}) {
  const template = getDiagnosticTemplate(payload?.templateId);
  const templateOptions = listDiagnosticTemplates().map((t) => ({ value: t.id, label: t.label }));
  const fields = payload?.fields || {};

  const [expandedSections, setExpandedSections] = useState(() =>
    buildInitialExpandedSections(template?.sections || [], fields),
  );

  useEffect(() => {
    setExpandedSections(buildInitialExpandedSections(template?.sections || [], fields));
  }, [payload?.templateId]);

  const appointments = (Array.isArray(workOrder?.appointments) ? workOrder.appointments : [])
    .filter((a) => String(a.status || '').toLowerCase() !== 'canceled');

  const selectedAppointment = useMemo(
    () => appointments.find((a) => String(a.id) === String(payload?.appointmentId || '')),
    [appointments, payload?.appointmentId],
  );
  const visitLabel = formatDiagnosticVisitLabel(selectedAppointment);

  const appointmentOptions = [
    { value: '', label: '— No visit linked —' },
    ...appointments.map((a) => ({
      value: String(a.id),
      label: formatDiagnosticVisitLabel(a) || String(a.id),
    })),
  ];

  const handleTemplateChange = (templateId) => {
    onChange({
      templateId,
      appointmentId: payload?.appointmentId || '',
      fields: getInitialDiagnosticFieldValues(templateId),
    });
  };

  const handleFieldChange = (key, value) => {
    onChange({
      ...payload,
      fields: {
        ...(payload?.fields || {}),
        [key]: value,
      },
    });
  };

  const toggleSection = (sectionId) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const expandAll = () => {
    const next = {};
    for (const section of template.sections) next[section.id] = true;
    setExpandedSections(next);
  };

  const collapseAll = () => {
    const next = {};
    for (const section of template.sections) next[section.id] = false;
    setExpandedSections(next);
  };

  if (!template) {
    return <p className="text-sm text-gray-500">Select an appliance template.</p>;
  }

  return (
    <div className="space-y-4">
      {readOnly ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm space-y-1 ${
            variant === 'mobile'
              ? 'border-white/10 bg-white/[0.02] text-gray-300'
              : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          <div>
            <span className="font-medium">Appliance:</span> {template.label}
          </div>
          {visitLabel && (
            <div>
              <span className="font-medium">Visit:</span> {visitLabel}
            </div>
          )}
        </div>
      ) : (
        <>
          <SelectInput
            label="Appliance template"
            id="diagTemplateId"
            value={payload?.templateId || ''}
            onChange={(e) => handleTemplateChange(e.target.value)}
            options={templateOptions}
            disabled={readOnly}
          />

          <SelectInput
            label="Visit (optional)"
            id="diagAppointmentId"
            value={payload?.appointmentId || ''}
            onChange={(e) => onChange({ ...payload, appointmentId: e.target.value })}
            options={appointmentOptions}
            disabled={readOnly}
          />
        </>
      )}

      <div className="flex items-center justify-end gap-3 text-xs">
        <button
          type="button"
          onClick={expandAll}
          className={variant === 'mobile' ? 'text-cyan-400/80' : 'text-cyan-700 dark:text-cyan-300'}
        >
          Expand all
        </button>
        <span className={variant === 'mobile' ? 'text-gray-600' : 'text-gray-400'}>|</span>
        <button
          type="button"
          onClick={collapseAll}
          className={variant === 'mobile' ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}
        >
          Collapse all
        </button>
      </div>

      {template.sections.map((section) => (
        <DiagnosticSection
          key={section.id}
          section={section}
          fields={fields}
          expanded={Boolean(expandedSections[section.id])}
          onToggle={() => toggleSection(section.id)}
          variant={variant}
        >
          {section.fields.map((field) => (
            <div key={field.id}>
              {renderFieldControl(
                field,
                section.id,
                fields[fieldKey(section.id, field.id)],
                handleFieldChange,
                readOnly,
                variant,
              )}
            </div>
          ))}
        </DiagnosticSection>
      ))}
    </div>
  );
}
