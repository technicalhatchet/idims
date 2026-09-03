import {
  LOGIT_PRIORITY_OPTIONS,
  LOGIT_SEVERITY_LABELS,
} from './logitUi';

export default function LogitPriorityPicker({
  value,
  onChange,
  observationType,
  disabled = false,
}) {
  const hideNotApplicable = observationType === 'idea' || observationType === 'positive';
  const options = LOGIT_PRIORITY_OPTIONS;

  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-white/50 mb-3">Priority</p>
      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Priority">
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(option.id)}
              className={`flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl border px-1 py-2 transition ${
                selected
                  ? 'border-white/30 bg-white/[0.08]'
                  : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
              }`}
            >
              <span
                className="w-5 h-5 shrink-0 rounded-full border border-white/20"
                style={{ backgroundColor: option.color }}
                aria-hidden="true"
              />
              <span className="text-[10px] text-white/70 leading-tight text-center">
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
      {hideNotApplicable && value === 'not_applicable' && (
        <p className="text-xs text-white/40 mt-2">Priority optional for this observation type.</p>
      )}
      {!hideNotApplicable && value === 'not_applicable' && (
        <button
          type="button"
          className="mt-2 text-xs text-cyan-400/90 min-h-[44px]"
          onClick={() => onChange('minor')}
        >
          Set priority
        </button>
      )}
      {value && value !== 'not_applicable' && (
        <p className="text-xs text-white/40 mt-2">
          {LOGIT_SEVERITY_LABELS[value]}
        </p>
      )}
    </div>
  );
}
