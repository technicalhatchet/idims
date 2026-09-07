import type { TestPoint } from '../types';
import WireColorSwatch from './WireColorSwatch';

interface ProcedureTestPointPanelProps {
  testPoint: TestPoint;
}

export default function ProcedureTestPointPanel({ testPoint }: ProcedureTestPointPanelProps) {
  const { connector, pins, label, pinDetails } = testPoint;

  return (
    <div className="rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]/60 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--solomon-text-primary)]">
          {connector} · {pins}
        </p>
        <p className="text-xs text-[var(--solomon-text-secondary)]">{label}</p>
      </div>

      {pinDetails?.length ? (
        <div className="mt-3 overflow-hidden rounded-md border border-[color:var(--solomon-border-subtle)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--solomon-surface-glass)] text-[var(--solomon-text-secondary)]">
              <tr>
                <th className="px-3 py-2 font-medium">Pin</th>
                <th className="px-3 py-2 font-medium">Signal</th>
                <th className="px-3 py-2 font-medium">Wire</th>
              </tr>
            </thead>
            <tbody>
              {pinDetails.map((pin) => (
                <tr
                  key={`${pin.pin}-${pin.signal}`}
                  className="border-t border-[color:var(--solomon-border-subtle)]"
                >
                  <td className="px-3 py-2 font-mono text-[var(--solomon-text-primary)]">{pin.pin}</td>
                  <td className="px-3 py-2 text-[var(--solomon-text-primary)]">{pin.signal}</td>
                  <td className="px-3 py-2">
                    {pin.wireColor ? (
                      <WireColorSwatch
                        code={pin.wireColor}
                        confidence={pin.wireColorConfidence}
                        compact
                      />
                    ) : (
                      <span className="text-[var(--solomon-text-muted)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {pinDetails && pinDetails.length >= 2 ? (
        <p className="mt-2 text-[11px] text-[var(--solomon-text-secondary)]">
          Meter between pins {pinDetails[0].pin} and {pinDetails[1].pin}
          {pinDetails[0].wireColor && pinDetails[1].wireColor
            ? ` (${pinDetails[0].wireColor} ↔ ${pinDetails[1].wireColor})`
            : ''}
        </p>
      ) : null}
    </div>
  );
}
