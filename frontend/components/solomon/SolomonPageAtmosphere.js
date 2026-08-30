/** Shared cinematic background for Solomon list/search pages. */
export default function SolomonPageAtmosphere() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute -top-20 -left-16 h-52 w-52 rounded-full bg-cyan-500/[0.07] blur-3xl" />
      <div className="absolute top-1/4 -right-20 h-44 w-44 rounded-full bg-purple-500/[0.06] blur-3xl" />
      <div className="absolute bottom-32 left-8 h-36 w-36 rounded-full bg-orange-500/[0.05] blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#070b14]/20 via-transparent to-[#070b14]/60" />
    </div>
  );
}
