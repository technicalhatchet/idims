/**
 * Optimized Atomic Repair wordmark (source master: /arpano.png 5000×1024).
 * Served as 800px / 400px WebP (+ PNG fallback) for header/footer display sizes.
 */
const LOGO_WIDTH = 800;
const LOGO_HEIGHT = 164;

export default function AtomicLogo({
  height,
  className = 'h-12 w-auto object-contain lg:h-[72px]',
  priority = false,
}) {
  const displayHeight = height ?? 72;
  return (
    <picture>
      <source
        type="image/webp"
        srcSet="/arpano-400.webp 400w, /arpano-800.webp 800w"
        sizes={`(max-width: 1024px) ${Math.min(400, Math.round(displayHeight * 5.5))}px, ${Math.round(displayHeight * 5.5)}px`}
      />
      <img
        src="/arpano-800.png"
        alt="Atomic Repair"
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        className={className}
        style={height != null ? { height: `${height}px` } : undefined}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
      />
    </picture>
  );
}
