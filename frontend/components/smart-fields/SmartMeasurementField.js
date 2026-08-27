'use client';

import MeasurementReferenceCard from './MeasurementReferenceCard';
import MeasurementStatusBadge from './MeasurementStatusBadge';
import { FieldHelpText } from '../diagnostics/FieldGuidance';
import { FieldRecommendationNote } from '../diagnostics/FieldGuidance';

export default function SmartMeasurementField({
  label,
  value,
  onChange,
  disabled,
  variant = 'mobile',
  definition,
  evaluation,
  lastReading = null,
  helpText = null,
  recommendations = [],
  inputMode = 'text',
}) {
  const isMobile = variant === 'mobile';
  const unit = definition?.unit || '';
  const status = evaluation?.status || 'unknown';
  const placeholder = unit ? `e.g. 12.5 or OL (${unit})` : 'e.g. 12.5 or OL';
  const borderTone =
    status === 'critical'
      ? 'border-red-500/40'
      : status === 'warning'
        ? 'border-amber-500/35'
        : status === 'normal'
          ? 'border-emerald-500/30'
          : isMobile
            ? 'border-white/10'
            : 'border-gray-300 dark:border-gray-600';

  return (
    <div>
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className={`text-sm font-medium ${isMobile ? 'text-gray-300' : 'text-gray-700 dark:text-gray-300'}`}>
          {label}
        </p>
        {value && <MeasurementStatusBadge status={status} evaluation={evaluation} variant={variant} />}
      </div>
      <FieldHelpText text={helpText} variant={variant} />
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode={inputMode}
          value={value || ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`flex-1 rounded-lg border px-3 py-2 ${
            isMobile ? 'text-base' : 'text-sm'
          } ${
            isMobile
              ? `bg-[#0A0F1E] text-white ${borderTone}`
              : `dark:bg-gray-800 dark:text-white ${borderTone}`
          }`}
        />
        {unit ? (
          <span className={`text-xs font-medium shrink-0 ${isMobile ? 'text-gray-500' : 'text-gray-500'}`}>
            {unit}
          </span>
        ) : null}
      </div>
      <MeasurementReferenceCard
        definition={definition}
        evaluation={evaluation}
        lastReading={lastReading}
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
