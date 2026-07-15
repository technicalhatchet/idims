'use client';

import { useState } from 'react';
import { formatRangeLabel } from '../diagnostics/knowledge/measurementRulesEngine';

export default function MeasurementReferenceCard({ definition, evaluation, lastReading, variant = 'mobile' }) {
  const [open, setOpen] = useState(false);
  if (!definition) return null;

  const isMobile = variant === 'mobile';
  const expected = formatRangeLabel(definition.ranges?.normal, definition.unit);
  const typical = formatRangeLabel(definition.typical, definition.unit);
  const hasDetails =
    Boolean(expected)
    || Boolean(typical)
    || Boolean(lastReading?.value)
    || Boolean(definition.purpose)
    || Boolean(definition.failureModes?.length)
    || Boolean(definition.testingTips?.length)
    || Boolean(definition.notes);

  return (
    <div className="mt-1.5">
      {evaluation?.diagnosisLabel && evaluation?.rawValue ? (
        <p className={`text-[11px] ${isMobile ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
          Reading: {evaluation.rawValue}
          {evaluation.displayUnit ? ` ${evaluation.displayUnit}` : ''}
          {evaluation.expectedRangeLabel ? ` · Expected ${evaluation.expectedRangeLabel}` : ''}
        </p>
      ) : evaluation?.message ? (
        <p className={`text-[11px] mt-1 ${isMobile ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {evaluation.message}
        </p>
      ) : null}

      {hasDetails ? (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={`inline-flex items-center gap-1 text-[11px] ${
              isMobile ? 'text-cyan-400' : 'text-cyan-600 dark:text-cyan-300'
            }`}
            aria-expanded={open}
          >
            {open ? '▲ Hide details' : '▼ Details'}
          </button>

          {open && (
            <div
              className={`mt-2 rounded-lg border px-3 py-2 text-[11px] space-y-2 ${
                isMobile
                  ? 'border-white/10 bg-white/[0.03] text-gray-300'
                  : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {(expected || typical || lastReading?.value) && (
                <div className="space-y-1">
                  {expected && (
                    <p>
                      <span className="font-medium opacity-80">Expected </span>
                      {expected}
                    </p>
                  )}
                  {typical && (
                    <p>
                      <span className="font-medium opacity-80">Typical </span>
                      {typical}
                    </p>
                  )}
                  {lastReading?.value && (
                    <p>
                      <span className="font-medium opacity-80">Last reading </span>
                      {lastReading.value}
                      {lastReading.unit ? ` ${lastReading.unit}` : ''}
                    </p>
                  )}
                </div>
              )}
              {definition.purpose && (
                <div>
                  <p className="font-medium opacity-80">Why this matters</p>
                  <p>{definition.purpose}</p>
                </div>
              )}
              {definition.failureModes?.length > 0 && (
                <div>
                  <p className="font-medium opacity-80">Common failures</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {definition.failureModes.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {definition.testingTips?.length > 0 && (
                <div>
                  <p className="font-medium opacity-80">Diagnostic tips</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {definition.testingTips.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {definition.notes && <p className="opacity-80">{definition.notes}</p>}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
