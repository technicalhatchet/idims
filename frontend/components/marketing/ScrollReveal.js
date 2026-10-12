import { motion, useInView, useReducedMotion } from 'framer-motion';
import { useLayoutEffect, useRef, useState } from 'react';

/** Scroll-in reveal: fast, early trigger; no hide when already in viewport on load. */
export default function ScrollReveal({ children, className, delay = 0, ...motionProps }) {
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();
  const inView = useInView(ref, {
    once: true,
    amount: 0.05,
    margin: '120px 0px 120px 0px',
  });
  const [visibleOnLoad, setVisibleOnLoad] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setVisibleOnLoad(true);
    }
  }, []);

  const visible = Boolean(reduceMotion || visibleOnLoad || inView);

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={false}
      animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
      transition={{
        duration: visibleOnLoad || reduceMotion ? 0 : 0.28,
        delay: visible && !visibleOnLoad && !reduceMotion ? delay : 0,
        ease: [0.33, 1, 0.68, 1],
      }}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}
