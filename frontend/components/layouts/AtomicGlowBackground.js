/** Shared cyan/orange glow blobs for Atomic marketing pages (HomeLayout + homepage). */
export default function AtomicGlowBackground() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden>
      <div
        className="absolute blur-[120px] md:blur-[180px] w-[300px] h-[300px] md:w-[700px] md:h-[700px] -top-[50px] -left-[100px] md:-top-[100px] md:-left-[200px]"
        style={{ backgroundColor: 'rgba(0, 229, 255, 0.15)' }}
      />
      <div
        className="absolute blur-[100px] md:blur-[150px] w-[250px] h-[250px] md:w-[500px] md:h-[500px] bottom-[15%] -right-[50px] md:bottom-[20%] md:-right-[100px]"
        style={{ backgroundColor: 'rgba(255, 122, 26, 0.18)' }}
      />
    </div>
  );
}
