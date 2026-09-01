import { useSolomonHeaderInset, solomonWizardScrollPadding } from './solomonSafeArea';

/**
 * Full-screen Solomon wizard shell (diagnose / edit) with notch + sync banner offsets.
 */
export default function SolomonMobileShell({ header, children, headerClassName = '' }) {
  const headerInset = useSolomonHeaderInset();

  return (
    <div className="fixed inset-0 z-[200] flex min-w-0 flex-col overflow-x-hidden bg-[var(--solomon-bg-mobile-shell)] text-white solomon-mobile-shell" data-mobile-form>
      <header
        className={`shrink-0 bg-transparent ${headerClassName}`}
        style={headerInset}
      >
        {header}
      </header>
      <div
        className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-4"
        style={{ paddingBottom: solomonWizardScrollPadding() }}
      >
        {children}
      </div>
    </div>
  );
}
