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

  const appointments = (Array.isArray(workOrder?.appointments) ? workOrder.appointments : [])
    .filter((a) => String(a.status || '').toLowerCase() !== 'canceled');

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

  if (!template) {
    return <p className="text-sm text-gray-500">Select an appliance template.</p>;
  }

  return (
    <div className="space-y-5">
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

      {template.sections.map((section) => (
        <div
          key={section.id}
          className={`rounded-xl border p-4 space-y-3 ${
            variant === 'mobile' ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 dark:border-gray-700'
          }`}
        >
          <h4
            className={`text-sm font-semibold ${
              variant === 'mobile' ? 'text-cyan-300' : 'text-gray-900 dark:text-white'
            }`}
          >
            {section.title}
          </h4>
          <div className="space-y-3">
            {section.fields.map((field) => (
              <div key={field.id}>
                {renderFieldControl(
                  field,
                  section.id,
                  payload?.fields?.[fieldKey(section.id, field.id)],
                  handleFieldChange,
                  readOnly,
                  variant,
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
