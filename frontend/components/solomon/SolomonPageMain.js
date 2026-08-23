import { useSolomonTopInset, solomonSafeBottom } from './solomonSafeArea';

/** Standard Solomon scroll page with notch + sync banner top inset. */
export default function SolomonPageMain({ children, className = '' }) {
  const topInset = useSolomonTopInset();

  return (
    <main
      className={`min-h-screen bg-[#0A0F1E] text-white px-5 max-w-lg mx-auto ${className}`}
      style={{ ...topInset, ...solomonSafeBottom, paddingBottom: 'max(6rem, env(safe-area-inset-bottom, 0px))' }}
    >
      {children}
    </main>
  );
}
