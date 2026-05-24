import TechnicianFieldPerformance from './TechnicianFieldPerformance';

export default function TechnicianPerformance({ performance, period, onPeriodChange, isLoading }) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!performance) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">No performance data available.</p>
      </div>
    );
  }

  return (
    <TechnicianFieldPerformance
      performance={performance}
      period={period}
      onPeriodChange={onPeriodChange}
      variant="desktop"
    />
  );
}
