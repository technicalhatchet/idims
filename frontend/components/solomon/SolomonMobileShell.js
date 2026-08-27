import { useSolomonHeaderInset, solomonSafeBottom } from './solomonSafeArea';

/**
 * Full-screen Solomon wizard shell (diagnose / edit) with notch + sync banner offsets.
 */
export default function SolomonMobileShell({ header, children, headerClassName = '' }) {
  const headerInset = useSolomonHeaderInset();

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#0f172a] text-white solomon-mobile-shell" data-mobile-form>
      <header
        className={`shrink-0 border-b border-white/10 ${headerClassName}`}
        style={headerInset}
      >
        {header}
      </header>
      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4"
        style={solomonSafeBottom}
      >
        {children}
      </div>
    </div>
  );
}
