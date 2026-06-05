export default function WorkOrderReadOnlyBanner({ className = '' }) {
  return (
    <div
      className={`rounded-lg border border-gray-400/40 bg-gray-500/10 px-4 py-3 text-sm text-gray-600 dark:text-gray-300 ${className}`}
      role="status"
    >
      This work order is <strong className="font-semibold">closed</strong>. Billing, parts, equipment,
      and scheduling are read-only. Notes and photos can still be added.
    </div>
  );
}
