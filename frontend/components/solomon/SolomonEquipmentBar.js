import { useState } from 'react';
import Link from 'next/link';
import {
  resolveSolomonDiagnosticStatus,
  SolomonDiagnosticStatusBadge,
} from './solomonDiagnosticStatus';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-[#0D1525] px-3 py-2.5 text-base text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:outline-none';

const labelClass = 'block text-xs uppercase tracking-wide text-gray-400 mb-1';

/** Model and serial: uppercase letters and digits only. */
function sanitizeModelSerial(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function equipmentSummary(equipment) {
  return [
    equipment.equipment_make?.trim(),
    equipment.equipment_model?.trim(),
    equipment.equipment_serial?.trim(),
  ]
    .filter(Boolean)
    .join(' · ');
}

function collapsedSummary(templateLabel, equipment, fallback) {
  const equip = equipmentSummary(equipment);
  if (templateLabel && equip) return `${templateLabel} · ${equip}`;
  if (templateLabel) return templateLabel;
  return equip || fallback;
}

/**
 * Collapsible equipment + template strip for Solomon diagnose — bar when filled, expand to edit.
 */
export default function SolomonEquipmentBar({
  equipment,
  onEquipmentChange,
  templateId,
  templateOptions = [],
  onTemplateChange,
  templateLabel,
  isDiyer,
  copy,
  outcomeId,
  progressMessage,
  error,
  queuedMessage,
  diagnosticsLinkLabel,
  insightPeeks = null,
  lifecycleDiagnostic = null,
}) {
  const hasEquipment =
    Boolean(equipment.equipment_make?.trim())
    || Boolean(equipment.equipment_model?.trim())
    || Boolean(equipment.equipment_serial?.trim());

  const isFilledOut =
    Boolean(templateId) && Boolean(equipment.equipment_make?.trim()) && Boolean(equipment.equipment_model?.trim());

  const [expanded, setExpanded] = useState(() => !isFilledOut);

  const summary = collapsedSummary(templateLabel, equipment, copy('equipmentOptional'));
  const lifecycleStatus = lifecycleDiagnostic
    ? resolveSolomonDiagnosticStatus(lifecycleDiagnostic)
    : null;

  return (
    <div className="mb-3 -mx-3 px-3 border-b border-white/10 pb-3 space-y-2">
      <button
        type="button"
        onClick={() => setExpanded((cur) => !cur)}
        className="w-full rounded-xl border border-white/10 bg-[#0D1525] px-3 py-2.5 text-left hover:border-cyan-500/30 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className={`text-[10px] uppercase tracking-[0.2em] ${lifecycleStatus?.labelTextClass || 'text-cyan-400/90'}`}>
                {copy('equipmentOptional')}
              </p>
              {lifecycleStatus ? (
                <SolomonDiagnosticStatusBadge status={lifecycleStatus} />
              ) : null}
            </div>
            {!expanded ? (
              <p className="text-sm text-white mt-1 truncate">{summary}</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">Appliance type and equipment details</p>
            )}
          </div>
          <span className="text-xs text-gray-500 shrink-0 pt-0.5">
            {expanded ? 'Hide' : 'Edit'}
          </span>
        </div>
      </button>

      {expanded ? (
        <div className="space-y-2 pt-1">
          {templateOptions.length > 0 && onTemplateChange ? (
            <div>
              <label className={labelClass} htmlFor="solomon-template-select">
                {copy('applianceType')}
              </label>
              <select
                id="solomon-template-select"
                value={templateId || ''}
                onChange={(e) => onTemplateChange(e.target.value)}
                className={inputClass}
              >
                {templateOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#0D1525]">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className={labelClass}>{copy('make')}</label>
              <input
                type="text"
                value={equipment.equipment_make}
                onChange={(e) => onEquipmentChange({ ...equipment, equipment_make: e.target.value })}
                placeholder="Samsung"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{copy('model')}</label>
              <input
                type="text"
                value={equipment.equipment_model}
                onChange={(e) => onEquipmentChange({
                  ...equipment,
                  equipment_model: sanitizeModelSerial(e.target.value),
                })}
                placeholder="Model #"
                className={inputClass}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            <div>
              <label className={labelClass}>{copy('serial')}</label>
              <input
                type="text"
                value={equipment.equipment_serial}
                onChange={(e) => onEquipmentChange({
                  ...equipment,
                  equipment_serial: sanitizeModelSerial(e.target.value),
                })}
                placeholder="Optional"
                className={inputClass}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="w-full rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-500/15 transition-colors"
          >
            Save and Hide
          </button>
        </div>
      ) : null}

      {outcomeId ? (
        <p className="text-xs text-amber-300/90">
          {isDiyer ? 'Will link to your repair note after save.' : 'Will link to outcome after save.'}
        </p>
      ) : null}
      {progressMessage ? <p className="text-xs text-emerald-300/90">{progressMessage}</p> : null}
      {insightPeeks ? <div className="space-y-2">{insightPeeks}</div> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {queuedMessage ? (
        <div className="space-y-2">
          <p className="text-sm text-amber-300/90">{queuedMessage}</p>
          <Link
            href="/solomon/diagnostics"
            className="inline-block text-sm text-cyan-400 hover:text-cyan-300"
          >
            {diagnosticsLinkLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
