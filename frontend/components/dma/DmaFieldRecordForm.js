import { useEffect, useState } from 'react';
import {
  DMA_APPLIANCE_SUBTYPES,
  DMA_EQUIPMENT_TYPES,
  DMA_MANUFACTURERS,
  EMPTY_FIELD_RECORD,
} from '../../constants/dmaEquipmentOptions';
import { codeOptions, DMA_PROBLEM_CODES, DMA_RESOLUTION_CODES } from '../../constants/dmaCodes';
import { getDmaCodes } from '../../services/api/dmaApi';
import DmaTagPicker from './DmaTagPicker';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-[#0A0F1E] px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none';

const labelClass = 'block text-xs uppercase tracking-wide text-gray-400 mb-1';

export default function DmaFieldRecordForm({
  initialValues = EMPTY_FIELD_RECORD,
  onSubmit,
  isSaving = false,
  submitLabel = 'Save record',
  error = null,
  variant = 'default',
}) {
  const isDiy = variant === 'diy';
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

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(values);
  };

  const problemOptions = codes?.problem_codes || DMA_PROBLEM_CODES;
  const resolutionOptions = codes?.resolution_codes || DMA_RESOLUTION_CODES;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-[#0D1525] p-4 space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/90">Equipment</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {!isDiy ? (
            <div>
              <label className={labelClass}>Type</label>
              <select value={values.equipment_type} onChange={set('equipment_type')} className={inputClass}>
                {DMA_EQUIPMENT_TYPES.map((o) => (
                  <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <label className={labelClass}>Make</label>
            <select value={values.equipment_make} onChange={set('equipment_make')} className={inputClass}>
              {DMA_MANUFACTURERS.map((o) => (
                <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Model</label>
            <input
              type="text"
              value={values.equipment_model}
              onChange={set('equipment_model')}
              placeholder="e.g. WFW5620HW"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Appliance type</label>
            <select value={values.equipment_subtype} onChange={set('equipment_subtype')} className={inputClass}>
              {DMA_APPLIANCE_SUBTYPES.map((o) => (
                <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0D1525] p-4 space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/90">
          {isDiy ? 'What happened' : 'Repair outcome'}
        </p>

        {!isDiy ? (
          <div>
            <label className={labelClass}>Date performed (optional)</label>
            <input type="date" value={values.performed_on} onChange={set('performed_on')} className={inputClass} />
          </div>
        ) : null}

        <div>
          <label className={labelClass}>{isDiy ? 'What was going wrong?' : 'Symptom / complaint'}</label>
          <textarea
            rows={2}
            value={values.customer_complaint}
            onChange={set('customer_complaint')}
            placeholder="Not draining, F9E1 on display…"
            className={inputClass}
          />
        </div>

        {!isDiy ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Problem code</label>
              <select value={values.problem_code} onChange={set('problem_code')} className={inputClass}>
                <option value="">Select problem…</option>
                {codeOptions(problemOptions).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Resolution code</label>
              <select value={values.resolution_code} onChange={set('resolution_code')} className={inputClass}>
                <option value="">Select resolution…</option>
                {codeOptions(resolutionOptions).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

        <div>
          <label className={labelClass}>Error code (optional)</label>
          <input
            type="text"
            value={values.error_code_text}
            onChange={set('error_code_text')}
            placeholder="F9E1"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>
            {isDiy ? 'What fixed it (or what you found)' : 'Confirmed fix (required)'}
          </label>
          <input
            type="text"
            value={values.confirmed_fix}
            onChange={set('confirmed_fix')}
            required
            placeholder="Cleared pressure hose obstruction"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Replaced parts</label>
          <input
            type="text"
            value={values.replaced_parts}
            onChange={set('replaced_parts')}
            placeholder="Part # or description, or None"
            className={inputClass}
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
          <label className={labelClass}>{isDiy ? 'Your notes' : 'Technician notes'}</label>
          <textarea
            rows={3}
            value={values.technician_summary}
            onChange={set('technician_summary')}
            className={inputClass}
          />
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-gray-300">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={values.repair_successful} onChange={set('repair_successful')} className="rounded" />
            {isDiy ? 'Issue resolved' : 'Repair successful'}
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
        className="w-full h-11 rounded-xl bg-gradient-to-br from-cyan-600 to-cyan-700 text-sm font-semibold uppercase tracking-wide text-white disabled:opacity-60"
      >
        {isSaving ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
