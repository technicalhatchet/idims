import {
  formatAutoApproveLimit,
  parseAutoApproveLimitInput,
} from '../../utils/estimateAutoApproveLimit';

export default function AutoApproveLimitField({
  label,
  hint,
  value,
  onChange,
  className = '',
  inputClassName = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md dark:bg-gray-800 dark:text-white text-sm',
}) {
  const display =
    value === null || value === undefined || value === ''
      ? ''
      : formatAutoApproveLimit(value);

  return (
    <div className={className}>
      {label ? (
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      ) : null}
      <input
        type="text"
        inputMode="decimal"
        placeholder="Blank = always ask"
        value={display}
        onChange={(e) => {
          const parsed = parseAutoApproveLimitInput(e.target.value);
          if (parsed !== undefined) onChange(parsed);
        }}
        className={inputClassName}
        autoComplete="off"
      />
      {hint ? <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-0">{hint}</p> : null}
    </div>
  );
}
