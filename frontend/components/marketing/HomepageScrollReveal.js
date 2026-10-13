import ScrollReveal from './ScrollReveal';

/**
 * Homepage below-fold only. When NEXT_PUBLIC_HOMEPAGE_PERF_VARIANT=hero_static at build time,
 * skip scroll-in opacity/y delays here without changing ScrollReveal for other routes.
 */
const HOMEPAGE_PERF_HERO_STATIC =
  process.env.NEXT_PUBLIC_HOMEPAGE_PERF_VARIANT === 'hero_static';

export default function HomepageScrollReveal({
  children,
  className,
  delay = 0,
  ...motionProps
}) {
  if (HOMEPAGE_PERF_HERO_STATIC) {
    return <div className={className}>{children}</div>;
  }

  return (
    <ScrollReveal className={className} delay={delay} {...motionProps}>
      {children}
    </ScrollReveal>
  );
}
