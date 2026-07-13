import { useCallback, useEffect, useMemo, useRef } from 'react';
import { SelectInput } from '../ui/FormElements';
import { Wizard } from '../wizard';
import {
  getWizardDefinition,
  resolveWizardSteps,
} from '../diagnostics';
import {
  clearDiagnosticDraft,
  getDiagnosticDraftKey,
  loadDiagnosticDraft,
  persistDiagnosticDraft,
} from '../diagnostics/diagnosticDraft';
import {
  formatDiagnosticVisitLabel,
  getDiagnosticTemplate,
  getInitialDiagnosticFieldValues,
  listDiagnosticTemplates,
} from '../../constants/diagnosticTemplates';

export { clearDiagnosticDraft, getDiagnosticDraftKey };

export default function DiagnosticResultsForm({
  payload,
  onChange,
  workOrder = null,
  workOrderId = null,
  draftNoteId = null,
  readOnly = false,
  variant = 'mobile',
  onSave = null,
  isSaving = false,
}) {
  const template = getDiagnosticTemplate(payload?.templateId);
  const wizardDefinition = getWizardDefinition(payload?.templateId);
  const templateOptions = listDiagnosticTemplates().map((t) => ({ value: t.id, label: t.label }));
  const draftKey = getDiagnosticDraftKey(workOrderId, draftNoteId);
  const draftRestoredRef = useRef(false);

  const steps = useMemo(
    () => resolveWizardSteps(wizardDefinition, template),
    [wizardDefinition, template],
  );

  useEffect(() => {
    if (readOnly || draftRestoredRef.current || !draftKey || draftNoteId) return;
    const draft = loadDiagnosticDraft(draftKey);
    draftRestoredRef.current = true;
    if (draft) {
      onChange({
        templateId: draft.templateId,
        appointmentId: draft.appointmentId || '',
        fields: draft.fields || {},
      });
    }
  }, [draftKey, draftNoteId, onChange, readOnly]);

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

  const emitChange = useCallback(
    (nextPayload) => {
      onChange(nextPayload);
      if (!readOnly) persistDiagnosticDraft(draftKey, nextPayload);
    },
    [draftKey, onChange, readOnly],
  );

  const handleTemplateChange = (templateId) => {
    emitChange({
      templateId,
      appointmentId: payload?.appointmentId || '',
      fields: getInitialDiagnosticFieldValues(templateId),
    });
  };

  const handleFieldChange = useCallback(
    (key, value) => {
      emitChange({
        ...payload,
        fields: {
          ...(payload?.fields || {}),
          [key]: value,
        },
      });
    },
    [emitChange, payload],
  );

  const handleAppointmentChange = (appointmentId) => {
    emitChange({ ...payload, appointmentId });
  };

  const wizardContext = useMemo(
    () => ({
      payload,
      workOrder,
      onFieldChange: handleFieldChange,
    }),
    [handleFieldChange, payload, workOrder],
  );

  const handleWizardAutoSave = useCallback(() => {
    if (!readOnly && payload?.templateId) {
      persistDiagnosticDraft(draftKey, payload);
    }
  }, [draftKey, payload, readOnly]);

  const draftHint = !readOnly && draftKey ? (
    <p className={`text-[11px] text-center ${variant === 'mobile' ? 'text-gray-600' : 'text-gray-400'}`}>
      Draft saved automatically
    </p>
  ) : null;

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
            onChange={(e) => handleAppointmentChange(e.target.value)}
            options={appointmentOptions}
            disabled={readOnly}
          />
        </>
      )}

      <Wizard
        steps={steps}
        context={wizardContext}
        readOnly={readOnly}
        variant={variant}
        resetKey={payload?.templateId}
        onAutoSave={handleWizardAutoSave}
        onComplete={onSave ?? undefined}
        completeLabel="Save Note"
        isCompleting={isSaving}
        footerExtra={draftHint}
      />
    </div>
  );
}
