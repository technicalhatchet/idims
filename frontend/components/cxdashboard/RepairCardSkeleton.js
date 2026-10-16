export default function RepairCardSkeleton() {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#0D1525] p-5 animate-pulse">
      <div className="flex gap-4">
        <div className="h-12 w-12 rounded-lg bg-white/10 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-white/10" />
          <div className="h-3 w-1/3 rounded bg-white/5" />
          <div className="h-4 w-24 rounded bg-white/10 mt-3" />
        </div>
      </div>
    </div>
  );
}
