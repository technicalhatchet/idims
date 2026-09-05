import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Secret Service Mode - Hidden technician login access
 * 
 * Usage: Wrap any element (like a logo) with this component.
 * Tap the element 5 times within 3 seconds to reveal the service mode button.
 * 
 * Example:
 * <SecretServiceMode>
 *   <Image src="/logo.png" alt="Logo" />
 * </SecretServiceMode>
 */
export default function SecretServiceMode({ children, tapCount = 5, timeWindow = 3000 }) {
  const [showServiceMode, setShowServiceMode] = useState(false);
  const [taps, setTaps] = useState(0);
  const timeoutRef = useRef(null);
  const tapsRef = useRef([]);

  const handleTap = useCallback(() => {
    const now = Date.now();
    
    // Add current tap timestamp
    tapsRef.current.push(now);
    
    // Filter out old taps (outside time window)
    tapsRef.current = tapsRef.current.filter(t => now - t < timeWindow);
    
    setTaps(tapsRef.current.length);
    
    // Check if we've reached the required tap count
    if (tapsRef.current.length >= tapCount) {
      setShowServiceMode(true);
      tapsRef.current = [];
      setTaps(0);
      
      // Auto-hide after 10 seconds if not used
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        setShowServiceMode(false);
      }, 10000);
    }
  }, [tapCount, timeWindow]);

  const handleServiceModeClick = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    // Full navigation — router.push fetches /_next/data/.../login.json and breaks Auth0 redirect (SW/CORS).
    window.location.href = '/api/auth/login?returnTo=/techboard';
  };

  const handleDismiss = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShowServiceMode(false);
  };

  return (
    <div className="relative">
      {/* Tappable area - wraps children */}
      <div 
        onClick={handleTap}
        className="cursor-pointer select-none"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleTap()}
      >
        {children}
      </div>

      {/* Service Mode Button - appears after secret tap */}
      <AnimatePresence>
        {showServiceMode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50"
          >
            <div 
              className="relative rounded-lg p-1"
              style={{
                background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.5), rgba(255, 122, 0, 0.5))',
              }}
            >
              <div 
                className="rounded-md px-4 py-2 flex items-center gap-3"
                style={{ background: '#0A0F1E' }}
              >
                <button
                  onClick={handleServiceModeClick}
                  className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                  Service Mode
                </button>
                <button
                  onClick={handleDismiss}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                  aria-label="Dismiss"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Arrow pointing up */}
            <div 
              className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45"
              style={{ background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.5), rgba(255, 122, 0, 0.5))' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
