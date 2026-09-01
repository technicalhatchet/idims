import { getDiagnosticTemplate } from '../../constants/diagnosticTemplates';

const FUEL_APPLIANCE_DISPLAY = {
  electric_dryer: { base: 'Dryer', fuelSuffix: 'E', ariaLabel: 'Electric dryer' },
  gas_dryer: { base: 'Dryer', fuelSuffix: 'G', ariaLabel: 'Gas dryer' },
  electric_range: { base: 'Range', fuelSuffix: 'E', ariaLabel: 'Electric range' },
  gas_range: { base: 'Range', fuelSuffix: 'G', ariaLabel: 'Gas range' },
};

function parseFuelLabelFromText(templateLabel) {
  if (!templateLabel) return null;
  const match = String(templateLabel).match(/^(Electric|Gas)\s+(Dryer|Range)$/i);
  if (!match) return null;
  const fuelSuffix = match[1].toLowerCase() === 'electric' ? 'E' : 'G';
  const base = match[2];
  return {
    base,
    fuelSuffix,
    ariaLabel: templateLabel,
  };
}

function defaultApplianceDisplay(templateId, templateLabel) {
  if (templateLabel) {
    return {
      base: templateLabel,
      fuelSuffix: null,
      ariaLabel: templateLabel,
    };
  }
  if (templateId) {
    const fromTemplate = getDiagnosticTemplate(templateId)?.label;
    if (fromTemplate) {
      const parsed = parseFuelLabelFromText(fromTemplate);
      if (parsed) return parsed;
      return {
        base: fromTemplate,
        fuelSuffix: null,
        ariaLabel: fromTemplate,
      };
    }
    const fallback = templateId.replace(/_/g, ' ');
    return {
      base: fallback,
      fuelSuffix: null,
      ariaLabel: fallback,
    };
  }
  return {
    base: 'Diagnostic',
    fuelSuffix: null,
    ariaLabel: 'Diagnostic',
  };
}

/** Compact dryer/range labels: base name + optional E/G fuel suffix. */
export function resolveSolomonApplianceDisplay({ templateId, templateLabel } = {}) {
  const id = templateId?.trim();
  if (id && FUEL_APPLIANCE_DISPLAY[id]) {
    return FUEL_APPLIANCE_DISPLAY[id];
  }

  const parsed = parseFuelLabelFromText(templateLabel);
  if (parsed) return parsed;

  return defaultApplianceDisplay(id, templateLabel);
}

export function formatSolomonApplianceLabel({ templateId, templateLabel } = {}) {
  const display = resolveSolomonApplianceDisplay({ templateId, templateLabel });
  return display.fuelSuffix ? `${display.base} – ${display.fuelSuffix}` : display.base;
}

export default function SolomonApplianceLabel({
  templateId,
  templateLabel,
  className = '',
  baseClassName = '',
  suffixClassName = 'text-white/60',
  truncate = false,
}) {
  const display = resolveSolomonApplianceDisplay({ templateId, templateLabel });

  if (!display.fuelSuffix) {
    return (
      <span
        className={`${truncate ? 'truncate' : ''} ${className} ${baseClassName}`.trim()}
        title={display.ariaLabel}
      >
        {display.base}
      </span>
    );
  }

  return (
    <span
      className={`flex min-w-0 items-baseline ${className}`.trim()}
      title={display.ariaLabel}
    >
      <span className={`min-w-0 ${truncate ? 'truncate' : ''} ${baseClassName}`.trim()}>
        {display.base}
      </span>
      <span className={`shrink-0 ${suffixClassName}`.trim()} aria-hidden>
        {' – '}
        {display.fuelSuffix}
      </span>
    </span>
  );
}
