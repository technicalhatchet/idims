import type { WireColorConfidence } from '../types';
import { resolveWireColor } from '../wireColorRegistry';

interface WireColorSwatchProps {
  code?: string;
  confidence?: WireColorConfidence;
  compact?: boolean;
}

function stripeBackground(fill: string, stripe: string): string {
  return `repeating-linear-gradient(135deg, ${fill} 0 4px, ${stripe} 4px 8px)`;
}

export default function WireColorSwatch({ code, confidence, compact = false }: WireColorSwatchProps) {
  const definition = resolveWireColor(code);
  const showSwatch = confidence === 'verified' && definition;

  if (!code) return null;

  if (!showSwatch) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--solomon-text-secondary)]">
        <span className="font-mono font-medium text-[var(--solomon-text-primary)]">{code}</span>
        {confidence === 'inferred' ? (
          <span className="text-[10px] uppercase tracking-wide text-amber-400/90">inferred</span>
        ) : null}
      </span>
    );
  }

  const background = definition.stripe
    ? stripeBackground(definition.fill, definition.stripe)
    : definition.fill;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border px-2 py-1 ${
        compact ? 'text-[11px]' : 'text-xs'
      }`}
      style={{
        borderColor: definition.stroke || definition.fill,
        backgroundColor: definition.stripe ? undefined : `${definition.fill}22`,
      }}
      title={`${definition.code} — ${definition.label}`}
    >
      <span
        className="h-3.5 w-8 shrink-0 rounded-sm border"
        style={{
          background,
          borderColor: definition.stroke || definition.fill,
        }}
        aria-hidden
      />
      <span className="font-mono font-semibold text-[var(--solomon-text-primary)]">
        {definition.code}
      </span>
      {!compact ? (
        <span className="text-[var(--solomon-text-secondary)]">{definition.label}</span>
      ) : null}
    </span>
  );
}
