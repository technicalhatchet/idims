/**
 * Full-viewport decorative cyan/orange blurs for marketing pages.
 * Must stay non-interactive so fixed layers never block header/nav clicks.
 */
export default function MarketingAmbientBlurBackground({
  backgroundColor = '#000208',
  showBlobs = true,
  showVignette = false,
  cyanBlob = 'rgba(0, 229, 255, 0.15)',
  orangeBlob = 'rgba(255, 122, 26, 0.18)',
  className = '',
  style,
}) {
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden ${className}`}
      aria-hidden
      style={{ backgroundColor, ...style }}
    >
      {showBlobs && (
        <>
          <div
            className="absolute blur-[120px] md:blur-[180px] w-[300px] h-[300px] md:w-[700px] md:h-[700px] -top-[50px] -left-[100px] md:-top-[100px] md:-left-[200px]"
            style={{ backgroundColor: cyanBlob }}
          />
          <div
            className="absolute blur-[100px] md:blur-[150px] w-[250px] h-[250px] md:w-[500px] md:h-[500px] bottom-[15%] -right-[50px] md:bottom-[20%] md:-right-[100px]"
            style={{ backgroundColor: orangeBlob }}
          />
        </>
      )}
      {showVignette && (
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at center, transparent 0%, #000208 70%)' }}
        />
      )}
    </div>
  );
}
