import { BRAND_WORDMARK_SRC } from '../../constants/brandAssets';

/**
 * Atomic Repair wordmark — /arneonpano800bluegold.webp (800px WebP).
 */
export default function AtomicLogo({
  height,
  className = 'h-12 w-auto object-contain lg:h-[72px]',
  priority = false,
}) {
  return (
    <img
      src={BRAND_WORDMARK_SRC}
      alt="Atomic Repair"
      className={className}
      style={height != null ? { height: `${height}px` } : undefined}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
    />
  );
}
