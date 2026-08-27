'use client';

import { FaCheck, FaLock } from 'react-icons/fa';

function PathMarker({ status, isMobile }) {
  if (status === 'completed') {
    return (
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          isMobile ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
        }`}
      >
        <FaCheck size={11} />
      </span>
    );
  }

  if (status === 'current') {
    return (
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-2 ${
          isMobile
            ? 'bg-cyan-500/15 ring-cyan-400/80 text-cyan-300'
            : 'bg-cyan-100 ring-cyan-500 text-cyan-700'
        }`}
      >
        <span className="h-2 w-2 rounded-full bg-current" />
      </span>
    );
  }

  if (status === 'locked') {
    return (
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          isMobile ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-400'
        }`}
      >
        <FaLock size={10} />
      </span>
    );
  }

  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
        isMobile ? 'bg-white/5 text-gray-500' : 'bg-gray-100 text-gray-400'
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
    </span>
  );
}

export default function SolomonDiagnosticPath({ steps, variant = 'mobile' }) {
  if (!steps?.length) return null;

  const isMobile = variant === 'mobile';

  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-cyan-400/80 mb-3">Diagnostic path</p>
      <ol className="space-y-0">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const muted = step.status === 'locked' || step.status === 'upcoming';
          return (
            <li key={step.stepKey} className="flex gap-3">
              <div className="flex flex-col items-center">
                <PathMarker status={step.status} isMobile={isMobile} />
                {!isLast ? (
                  <span
                    className={`w-px flex-1 min-h-[1.25rem] my-0.5 ${
                      step.status === 'completed'
                        ? isMobile ? 'bg-emerald-500/30' : 'bg-emerald-300'
                        : isMobile ? 'bg-white/10' : 'bg-gray-200'
                    }`}
                  />
                ) : null}
              </div>
              <div className={`pb-3 min-w-0 flex-1 ${isLast ? 'pb-0' : ''}`}>
                <p
                  className={`text-[11px] tabular-nums ${
                    muted
                      ? isMobile ? 'text-gray-500' : 'text-gray-400'
                      : isMobile ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  Step {step.stepNumber}
                </p>
                <p
                  className={`text-sm leading-snug ${
                    step.status === 'current'
                      ? isMobile ? 'text-cyan-200 font-medium' : 'text-cyan-800 font-medium'
                      : muted
                        ? isMobile ? 'text-gray-500' : 'text-gray-400'
                        : isMobile ? 'text-gray-200' : 'text-gray-800'
                  }`}
                >
                  {step.title}
                </p>
                {step.summary && step.status === 'completed' && step.title !== step.stepTitle ? (
                  <p className="text-[11px] text-gray-500 mt-0.5">{step.stepTitle}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
