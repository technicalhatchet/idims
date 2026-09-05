import { useEffect, useState } from 'react';
import {
  DMA_APPLIANCE_SUBTYPES,
  DMA_EQUIPMENT_TYPES,
  DMA_MANUFACTURERS,
  EMPTY_FIELD_RECORD,
  OUTCOME_CONFIDENCE_OPTIONS,
  OUTCOME_CONFIDENCE_OPTIONS_DIY,
} from '../../constants/dmaEquipmentOptions';
import { codeOptions, DMA_PROBLEM_CODES, DMA_RESOLUTION_CODES } from '../../constants/dmaCodes';
import { applyExternalCausePreset } from '../../constants/externalCauseOutcomes';
import ExternalCauseOutcomePick from './ExternalCauseOutcomePick';
import { getDmaCodes } from '../../services/api/dmaApi';
import DmaTagPicker from './DmaTagPicker';
import { sanitizeSolomonAlphanumeric } from '../../utils/solomonFieldSanitize';
import {
  SOLOMON_FORM_LABEL_CLASS,
  SOLOMON_FORM_PANEL_CLASS,
  SOLOMON_FORM_SECTION_TITLE_CLASS,
  SOLOMON_FORM_SUBMIT_CLASS,
  SOLOMON_GLASS_INPUT_CLASS,
} from '../solomon/solomonListPageUi';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-[#0A0F1E] px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none';

const labelClass = 'block text-xs uppercase tracking-wide text-gray-400 mb-1';

const defaultPanelClass = 'rounded-xl border border-white/10 bg-[#0D1525] p-4 space-y-3';
const defaultSectionTitleClass = 'text-[10px] uppercase tracking-[0.2em] text-cyan-400/90';
const defaultSubmitClass =
  'w-full h-11 rounded-xl bg-gradient-to-br from-cyan-600 to-cyan-700 text-sm font-semibold uppercase tracking-wide text-white disabled:opacity-60';

export default function DmaFieldRecordForm({
  initialValues = EMPTY_FIELD_RECORD,
  onSubmit,
  isSaving = false,
  submitLabel = 'Save record',
  error = null,
  variant = 'default',
  surfaceVariant = 'default',
}) {
  const isDiy = variant === 'diy';
  const isSolomon = surfaceVariant === 'solomon';
  const inputCls = isSolomon ? SOLOMON_GLASS_INPUT_CLASS : inputClass;
  const labelCls = isSolomon ? SOLOMON_FORM_LABEL_CLASS : labelClass;
  const panelCls = isSolomon ? SOLOMON_FORM_PANEL_CLASS : defaultPanelClass;
  const sectionTitleCls = isSolomon ? SOLOMON_FORM_SECTION_TITLE_CLASS : defaultSectionTitleClass;
  const submitCls = isSolomon ? SOLOMON_FORM_SUBMIT_CLASS : defaultSubmitClass;
  const [codes, setCodes] = useState(null);
  const [values, setValues] = useState(initialValues);

  useEffect(() => {
    getDmaCodes()
      .then(setCodes)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setValues(initialValues);
  }, [initialValues]);

  const set = (field) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setValues((prev) => ({ ...prev, [field]: v }));
  };

  const setAlphanumeric = (field) => (e) => {
    setValues((prev) => ({
      ...prev,
      [field]: isSolomon ? sanitizeSolomonAlphanumeric(e.target.value) : e.target.value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isSolomon) {
      onSubmit(values);
      return;
    }
    onSubmit({
      ...values,
      equipment_model: sanitizeSolomonAlphanumeric(values.equipment_model),
      replaced_parts: sanitizeSolomonAlphanumeric(values.replaced_parts),
    });
  };

  const problemOptions = codes?.problem_codes || DMA_PROBLEM_CODES;
  const resolutionOptions = codes?.resolution_codes || DMA_RESOLUTION_CODES;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className={panelCls}>
        <p className={sectionTitleCls}>Equipment</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!isDiy ? (
            <div>
              <label className={labelCls}>Type</label>
              <select value={values.equipment_type} onChange={set('equipment_type')} className={inputCls}>
                {DMA_EQUIPMENT_TYPES.map((o) => (
                  <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <label className={labelCls}>Make</label>
            <select value={values.equipment_make} onChange={set('equipment_make')} className={inputCls}>
              {DMA_MANUFACTURERS.map((o) => (
                <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Model</label>
            <input
              type="text"
              value={values.equipment_model}
              onChange={isSolomon ? setAlphanumeric('equipment_model') : set('equipment_model')}
              placeholder="e.g. WFW5620HW"
              className={inputCls}
              autoCapitalize={isSolomon ? 'characters' : 'off'}
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <div>
            <label className={labelCls}>Appliance type</label>
            <select value={values.equipment_subtype} onChange={set('equipment_subtype')} className={inputCls}>
              {DMA_APPLIANCE_SUBTYPES.map((o) => (
                <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className={panelCls}>
        <p className={sectionTitleCls}>
          {isDiy ? 'What happened' : 'Repair outcome'}
        </p>

        {!isDiy ? (
          <ExternalCauseOutcomePick
            variant={isSolomon ? 'solomon' : 'default'}
            onSelectPreset={(presetId) => {
              setValues((prev) => applyExternalCausePreset(presetId, prev));
            }}
          />
        ) : null}

        {!isDiy ? (
          <div>
            <label className={labelCls}>Date performed (optional)</label>
            <input type="date" value={values.performed_on} onChange={set('performed_on')} className={inputCls} />
          </div>
        ) : null}

        <div>
          <label className={labelCls}>{isDiy ? 'What was going wrong?' : 'Symptom / complaint'}</label>
          <textarea
            rows={2}
            value={values.customer_complaint}
            onChange={set('customer_complaint')}
            placeholder="Not draining, F9E1 on display…"
            className={inputCls}
          />
        </div>

        {!isDiy ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Problem code</label>
              <select value={values.problem_code} onChange={set('problem_code')} className={inputCls}>
                <option value="">Select problem…</option>
                {codeOptions(problemOptions).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Resolution code</label>
              <select value={values.resolution_code} onChange={set('resolution_code')} className={inputCls}>
                <option value="">Select resolution…</option>
                {codeOptions(resolutionOptions).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

        <div>
          <label className={labelCls}>Error code (optional)</label>
          <input
            type="text"
            value={values.error_code_text}
            onChange={set('error_code_text')}
            placeholder="F9E1"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>
            {isDiy ? 'What fixed it (or what you found)' : 'Confirmed fix (required)'}
          </label>
          <input
            type="text"
            value={values.confirmed_fix}
            onChange={set('confirmed_fix')}
            required
            placeholder="Cleared pressure hose obstruction"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>
            {isDiy ? 'How sure are you?' : 'Outcome confidence'}
          </label>
          <select
            value={values.outcome_confidence || ''}
            onChange={set('outcome_confidence')}
            className={inputCls}
          >
            {(isDiy ? OUTCOME_CONFIDENCE_OPTIONS_DIY : OUTCOME_CONFIDENCE_OPTIONS).map((o) => (
              <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
            ))}
          </select>
          {!isDiy ? (
            <p className="text-[10px] text-gray-500 mt-1">
              Only confirmed outcomes strengthen shared repair memory.
            </p>
          ) : null}
        </div>

        <div>
          <label className={labelCls}>Replaced parts</label>
          <input
            type="text"
            value={values.replaced_parts}
            onChange={isSolomon ? setAlphanumeric('replaced_parts') : set('replaced_parts')}
            placeholder="Part # or NONE"
            className={inputCls}
            autoCapitalize={isSolomon ? 'characters' : 'off'}
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        {!isDiy ? (
          <DmaTagPicker
            label="Repair tags"
            value={Array.isArray(values.tags) ? values.tags : []}
            onChange={(tags) => setValues((prev) => ({ ...prev, tags }))}
          />
        ) : null}

        <div>
          <label className={labelCls}>{isDiy ? 'Your notes' : 'Technician notes'}</label>
          <textarea
            rows={3}
            value={values.technician_summary}
            onChange={set('technician_summary')}
            className={inputCls}
          />
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={values.repair_successful} onChange={set('repair_successful')} className="rounded" />
            {isDiy ? 'Issue resolved' : 'Visit resolved (includes external cause / no parts)'}
          </label>
          {!isDiy ? (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={values.callback_required} onChange={set('callback_required')} className="rounded" />
              Callback required
            </label>
          ) : null}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={isSaving}
        className={submitCls}
      >
        {isSaving ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
