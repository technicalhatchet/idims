'use client';

import { useEffect, useRef, useState } from 'react';
import SmartMeasurementField from '../smart-fields/SmartMeasurementField';
import { getFieldKnowledgeId } from './knowledge/fieldBindings';
import { getMeasurementKnowledge } from './knowledge/knowledgeRegistry';
import { evaluateFieldMeasurement } from './knowledge/measurementContext';
import { filterVisibleSectionFields } from './routing/fieldVisibilityEngine';
import {
  getFieldHelp,
  recommendationsForField,
  recommendationsForSection,
} from './routing/recommendationEngine';
import {
  FieldHelpText,
  FieldRecommendationNote,
  SectionRecommendations,
} from './FieldGuidance';

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

export function diagnosticFieldKey(sectionId, fieldId) {
  return `${sectionId}.${fieldId}`;
}

export function isDiagnosticFieldFilled(field, value) {
  if (field.type === 'check') return !!value;
  return value != null && String(value).trim() !== '';
}

export function countDiagnosticSectionFilled(section, fields = {}, fieldVisibilityRules = null) {
  const visibleFields = fieldVisibilityRules?.length
    ? filterVisibleSectionFields(section, fields, fieldVisibilityRules)
    : section.fields;
  return visibleFields.reduce((count, field) => {
    return count + (isDiagnosticFieldFilled(field, fields[diagnosticFieldKey(section.id, field.id)]) ? 1 : 0);
  }, 0);
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

export function DiagnosticFieldControl({
  field,
  sectionId,
  value,
  onChange,
  readOnly,
  variant,
  helpText = null,
  recommendations = [],
  templateId = null,
  lastReadings = {},
}) {
  const key = diagnosticFieldKey(sectionId, field.id);
  const disabled = readOnly;
  const labelBlock = (label) => (
    <>
      <p className="text-sm font-medium mb-0.5 text-gray-500">{label}</p>
      <FieldHelpText text={helpText} variant={variant} />
    </>
  );

  if (field.type === 'check') {
    return (
      <div>
        {helpText && <FieldHelpText text={helpText} variant={variant} />}
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
        {recommendations.map((rec) => (
          <FieldRecommendationNote
            key={rec.id}
            message={rec.message}
            tone={rec.tone}
            variant={variant}
          />
        ))}
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div>
        {labelBlock(field.label)}
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
        {recommendations.map((rec) => (
          <FieldRecommendationNote
            key={rec.id}
            message={rec.message}
            tone={rec.tone}
            variant={variant}
          />
        ))}
      </div>
    );
  }

  if (field.type === 'text') {
    const fieldKey = diagnosticFieldKey(sectionId, field.id);
    const knowledgeId = getFieldKnowledgeId(templateId, fieldKey);
    const definition = knowledgeId ? getMeasurementKnowledge(knowledgeId) : null;
    if (definition) {
      const evaluation = evaluateFieldMeasurement(templateId, fieldKey, value);
      return (
        <SmartMeasurementField
          label={field.label}
          value={value}
          onChange={(next) => onChange(fieldKey, next)}
          disabled={disabled}
          variant={variant}
          definition={definition}
          evaluation={evaluation}
          lastReading={lastReadings[fieldKey] || lastReadings[knowledgeId] || null}
          helpText={helpText}
          recommendations={recommendations}
        />
      );
    }

    return (
      <div>
        {labelBlock(field.label)}
        <input
          type="text"
          value={value || ''}
          disabled={disabled}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          className={`w-full rounded-lg border px-3 py-2 text-sm ${
            variant === 'mobile'
              ? 'border-white/10 bg-[#0A0F1E] text-white'
              : 'border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white'
          }`}
        />
        {recommendations.map((rec) => (
          <FieldRecommendationNote
            key={rec.id}
            message={rec.message}
            tone={rec.tone}
            variant={variant}
          />
        ))}
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
      {labelBlock(field.label)}
      <ChipGroup
        value={value || ''}
        options={options}
        onChange={(next) => onChange(key, next)}
        disabled={disabled}
        variant={variant}
      />
      {recommendations.map((rec) => (
        <FieldRecommendationNote
          key={rec.id}
          message={rec.message}
          tone={rec.tone}
          variant={variant}
        />
      ))}
    </div>
  );
}

export default function DiagnosticSectionFields({
  section,
  fields,
  onFieldChange,
  readOnly,
  variant,
  fieldVisibilityRules = null,
  fieldHelp = null,
  activeRecommendations = [],
  templateId = null,
  lastReadings = {},
}) {
  const isMobile = variant === 'mobile';
  const visibleFields = fieldVisibilityRules?.length
    ? filterVisibleSectionFields(section, fields, fieldVisibilityRules)
    : section.fields;
  const filledCount = countDiagnosticSectionFilled(section, fields, fieldVisibilityRules);
  const hasConditionalFields = fieldVisibilityRules?.length
    && visibleFields.length < section.fields.length;
  const sectionRecommendations = recommendationsForSection(section.id, activeRecommendations);

  const prevVisibleKeysRef = useRef(new Set());
  const [highlightedKeys, setHighlightedKeys] = useState(() => new Set());

  useEffect(() => {
    const currentKeys = new Set(
      visibleFields.map((field) => diagnosticFieldKey(section.id, field.id)),
    );
    const prev = prevVisibleKeysRef.current;
    const newlyShown = [...currentKeys].filter((key) => !prev.has(key));

    prevVisibleKeysRef.current = currentKeys;

    if (!newlyShown.length || prev.size === 0) return undefined;

    setHighlightedKeys(new Set(newlyShown));
    const timer = window.setTimeout(() => setHighlightedKeys(new Set()), 4500);
    return () => window.clearTimeout(timer);
  }, [section.id, visibleFields]);

  if (!visibleFields.length) {
    return (
      <div
        className={`rounded-xl border px-4 py-3 text-sm ${
          isMobile
            ? 'border-white/10 bg-white/[0.02] text-gray-400'
            : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
        }`}
      >
        No fields apply for this complaint yet. Update complaint chips or answers on earlier steps.
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 ${
        isMobile ? 'border-white/10 bg-white/[0.02]' : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
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
          {filledCount}/{visibleFields.length}
        </span>
      </div>
      {hasConditionalFields && (
        <p className={`text-[11px] ${isMobile ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
          Some follow-up fields appear below as you answer on this step.
        </p>
      )}
      <SectionRecommendations recommendations={sectionRecommendations} variant={variant} />
      <div className="space-y-3">
        {visibleFields.map((field) => {
          const fieldKey = diagnosticFieldKey(section.id, field.id);
          const isNew = highlightedKeys.has(fieldKey);
          const fieldRecs = recommendationsForField(fieldKey, activeRecommendations);
          return (
            <div
              key={field.id}
              className={`rounded-lg transition-all duration-500 ${
                isNew
                  ? isMobile
                    ? 'ring-2 ring-cyan-500/40 bg-cyan-500/[0.06] px-3 py-2 -mx-1'
                    : 'ring-2 ring-cyan-500/30 bg-cyan-50/80 dark:bg-cyan-950/30 px-3 py-2 -mx-1'
                  : ''
              }`}
            >
              {/* Conditional field reveal hint — restore when re-enabling visibility callouts
              {isNew && (
                <p
                  className={`text-[10px] font-medium mb-1.5 ${
                    isMobile ? 'text-cyan-300' : 'text-cyan-700 dark:text-cyan-300'
                  }`}
                >
                  ↳ Shown based on your answer
                </p>
              )}
              */}
              <DiagnosticFieldControl
                field={field}
                sectionId={section.id}
                value={fields[fieldKey]}
                onChange={onFieldChange}
                readOnly={readOnly}
                variant={variant}
                helpText={getFieldHelp(fieldKey, fieldHelp)}
                recommendations={fieldRecs}
                templateId={templateId}
                lastReadings={lastReadings}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
