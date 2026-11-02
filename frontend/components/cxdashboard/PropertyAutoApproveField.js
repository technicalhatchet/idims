import { formatAutoApproveLimit, parseAutoApproveLimitInput } from '../../utils/estimateAutoApproveLimit';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-[#0a101c] px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50';

export default function PropertyAutoApproveField({
  value,
  onChange,
  disabled,
  accountDefaultLimit,
}) {
  const display =
    value === null || value === undefined
      ? ''
      : formatAutoApproveLimit(value);

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#0D1525] p-4 space-y-2">
      <label className="block text-sm text-white font-medium m-0">
        Auto-approve repairs up to $
        <input
          type="text"
          inputMode="decimal"
          className={`${inputClass} inline-block w-24 mx-1 align-middle`}
          placeholder="—"
          value={display}
          disabled={disabled}
          onChange={(e) => {
            const parsed = parseAutoApproveLimitInput(e.target.value);
            if (parsed === undefined) return;
            onChange(parsed);
          }}
        />
        · leave blank to {accountDefaultLimit != null ? `use account default ($${formatAutoApproveLimit(accountDefaultLimit)})` : 'always ask'}
      </label>
      <p className="text-white/40 text-xs m-0">
        Property override wins over your account default. Estimates above the limit still require approval.
      </p>
    </div>
  );
}
