import { useEffect, useState } from 'react';

/** Avoid SSR/client markup mismatches for auth, router, and browser APIs. */
export function useClientMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
