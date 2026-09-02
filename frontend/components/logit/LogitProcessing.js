export default function LogitProcessing({ message = 'Making sense of it…' }) {
  return (
    <div className="max-w-lg mx-auto w-full px-4 py-16 text-center" role="status" aria-live="polite">
      <div className="inline-block w-8 h-8 border-2 border-cyan-400/40 border-t-cyan-400 rounded-full animate-spin mb-4" />
      <p className="text-white/80">{message}</p>
      <p className="text-sm text-white/40 mt-2">Organizing observation…</p>
    </div>
  );
}
