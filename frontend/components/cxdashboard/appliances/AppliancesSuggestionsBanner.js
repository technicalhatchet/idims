import { FaHistory } from 'react-icons/fa';

export default function AppliancesSuggestionsBanner({ count, onReview, onDismiss }) {
  if (!count) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-xl border border-cyan-500/25 bg-cyan-500/[0.07]">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <FaHistory className="text-cyan-400 w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <p className="text-white text-sm font-semibold m-0">
            {count === 1
              ? 'We found 1 appliance from your service history'
              : `We found ${count} appliances from your service history`}
          </p>
          <p className="text-gray-400 text-xs mt-1 m-0">
            Add them to My Appliances to track model info and schedule service faster.
          </p>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={onDismiss}
          className="px-3 py-2 rounded-lg text-xs font-semibold text-gray-400 bg-transparent border border-white/10 hover:text-gray-200"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={onReview}
          className="px-3 py-2 rounded-lg text-xs font-bold text-[#0A0F1E] bg-[#00D4FF] border-0"
        >
          Review
        </button>
      </div>
    </div>
  );
}
