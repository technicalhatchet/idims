import { applianceSourceInlineText, applianceSourceInlineTone } from '../../../constants/applianceSourceLabel';

/** Subtitle line: model · provenance · optional extra segments (serial, address, …). */
export default function ApplianceSourceSubtitle({
  appliance,
  extraParts = [],
  className = 'text-xs text-gray-500 truncate mt-0.5',
}) {
  const label = applianceSourceInlineText(appliance);
  const tone = applianceSourceInlineTone(appliance);
  const model = appliance?.model?.trim();

  const segments = [];
  if (model) segments.push({ kind: 'text', text: model });
  if (label) segments.push({ kind: 'label', text: label, tone });
  extraParts.filter(Boolean).forEach((text) => segments.push({ kind: 'text', text }));

  if (segments.length === 0) return null;

  return (
    <p className={className}>
      {segments.map((seg, index) => (
        <span key={`${seg.kind}-${index}`}>
          {index > 0 ? ' · ' : ''}
          {seg.kind === 'label' ? (
            <span className={seg.tone === 'verified' ? 'text-cyan-400/90' : 'text-gray-500'}>
              {seg.text}
            </span>
          ) : (
            seg.text
          )}
        </span>
      ))}
    </p>
  );
}
