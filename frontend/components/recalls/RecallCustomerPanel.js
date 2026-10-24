import RecallBadge from './RecallBadge';

export default function RecallCustomerPanel({ recalls }) {
  const items = recalls?.confirmed_recalls || [];
  if (!items.length) return null;

  return (
    <div
      className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 space-y-3"
      role="alert"
    >
      <div className="flex items-center gap-2">
        <RecallBadge recalls={recalls} />
        <span className="text-sm font-semibold text-red-200">Safety recall on file</span>
      </div>
      {items.map((r) => (
        <div key={r.match_id || r.cpsc_recall_id} className="text-sm text-gray-200 space-y-1">
          <p className="font-medium text-white">{r.title}</p>
          {r.hazard && <p><span className="text-red-300">Hazard:</span> {r.hazard}</p>}
          {r.remedy && <p><span className="text-gray-400">Remedy:</span> {r.remedy}</p>}
          {r.url && (
            <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
              View official CPSC listing
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
