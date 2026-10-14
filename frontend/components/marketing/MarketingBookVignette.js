/** Book flow edge darkening — gradient only, no blur. */
export default function MarketingBookVignette() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden
      style={{
        background: 'radial-gradient(ellipse at center, transparent 0%, #000208 72%)',
      }}
    />
  );
}
