import {
  LOGIT_GLASS_CARD,
  LOGIT_OBSERVATION_TYPES,
} from './logitUi';
import LogitHeader from './LogitHeader';

export default function LogitTypeSelect({
  project,
  unreviewedCount,
  onSelectType,
  onOpenLog,
  onSwitchProject,
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <LogitHeader
        title="LoGiT"
        subtitle={`${project.icon || '📝'} ${project.name}`}
        onLeft={onSwitchProject}
        rightLabel="Log"
        onRight={onOpenLog}
        rightBadge={unreviewedCount}
      />

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-6 flex flex-col">
        <h1 className="text-xl font-medium text-center mb-6">What did you notice?</h1>

        <div className="grid grid-cols-2 gap-3 flex-1 content-start">
          {LOGIT_OBSERVATION_TYPES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${LOGIT_GLASS_CARD} p-4 min-h-[148px] flex flex-col items-center justify-center text-center gap-2 hover:bg-white/[0.07] active:scale-[0.98] transition`}
              onClick={() => onSelectType(item.id)}
              aria-label={`${item.label}: ${item.subtitle}`}
            >
              <span className="text-3xl" aria-hidden="true">{item.emoji}</span>
              <span className="text-sm font-semibold tracking-wide">{item.label.toUpperCase()}</span>
              <span className="text-xs text-white/50 leading-snug px-1">{item.subtitle}</span>
            </button>
          ))}
        </div>

        <div className="pt-6 text-center">
          <button
            type="button"
            className="text-sm text-white/50 hover:text-white/80 min-h-[44px] px-4"
            onClick={onOpenLog}
          >
            {unreviewedCount > 0 ? `View log · ${unreviewedCount} unreviewed` : 'View log'}
          </button>
        </div>
      </div>
    </div>
  );
}
