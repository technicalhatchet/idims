'use client';

import { useState } from 'react';
import { formatRangeLabel } from '../diagnostics/knowledge/measurementRulesEngine';

export default function MeasurementReferenceCard({ definition, evaluation, lastReading, variant = 'mobile' }) {
  const [open, setOpen] = useState(false);
  if (!definition) return null;

  const isMobile = variant === 'mobile';
  const expected = formatRangeLabel(definition.ranges?.normal, definition.unit);
  const typical = formatRangeLabel(definition.typical, definition.unit);

  return (
    <div className="mt-1.5">
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] ${isMobile ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
        {expected && (
          <span>
            Expected <span className={isMobile ? 'text-gray-300' : 'text-gray-700 dark:text-gray-300'}>{expected}</span>
          </span>
        )}
        {typical && (
          <span>
            Typical <span className={isMobile ? 'text-gray-300' : 'text-gray-700 dark:text-gray-300'}>{typical}</span>
          </span>
        )}
        {lastReading?.value && (
          <span>
            Last{' '}
            <span className={isMobile ? 'text-gray-300' : 'text-gray-700 dark:text-gray-300'}>
              {lastReading.value}
              {lastReading.unit ? ` ${lastReading.unit}` : ''}
            </span>
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`inline-flex items-center gap-1 ${isMobile ? 'text-cyan-400' : 'text-cyan-600 dark:text-cyan-300'}`}
          aria-expanded={open}
        >
          ℹ {open ? 'Hide' : 'Details'}
        </button>
      </div>

      {evaluation?.message && (
        <p className={`text-[11px] mt-1 ${isMobile ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
          {evaluation.message}
        </p>
      )}

      {open && (
        <div
          className={`mt-2 rounded-lg border px-3 py-2 text-[11px] space-y-2 ${
            isMobile
              ? 'border-white/10 bg-white/[0.03] text-gray-300'
              : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          {definition.purpose && (
            <div>
              <p className="font-medium opacity-80">Why this matters</p>
              <p>{definition.purpose}</p>
            </div>
          )}
          {definition.failureModes?.length > 0 && (
            <div>
              <p className="font-medium opacity-80">Typical failure</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {definition.failureModes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {definition.testingTips?.length > 0 && (
            <div>
              <p className="font-medium opacity-80">Testing tips</p>
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
  );
}
