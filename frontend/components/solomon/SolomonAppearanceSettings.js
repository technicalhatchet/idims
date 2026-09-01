'use client';

import useSolomonTheme from '../../hooks/useSolomonTheme';
import { SOLOMON_GLASS_PANEL_CLASS } from './solomonListPageUi';
import { SOLOMON_INTERFACE_OPTIONS } from './solomonThemeTokens';

function StyleOption({ option, isSelected, onSelect, disabled }) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color:var(--solomon-focus-ring)] ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${
        isSelected
          ? 'border-[color:var(--solomon-primary-border)] bg-[var(--solomon-primary-from)]/8'
          : 'border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface-glass)] hover:border-[color:var(--solomon-border-subtle)]'
      }`}
    >
      <input
        type="radio"
        name="solomon-interface-style"
        value={option.id}
        checked={isSelected}
        disabled={disabled}
        onChange={() => onSelect(option.id)}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--solomon-primary-from)]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--solomon-text-primary)]">
          {option.label}
          {option.adminOnly ? (
            <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--solomon-text-muted)]">
              Admin preview
            </span>
          ) : null}
        </span>
        <span className="block text-xs text-[var(--solomon-text-secondary)] mt-1 leading-relaxed">
          {option.description}
        </span>
      </span>
    </label>
  );
}

/** Appearance toggle — Signature vs Professional (admin-only for Professional). */
export default function SolomonAppearanceSettings() {
  const {
    interfaceStyle,
    setInterfaceStyle,
    canUseProfessionalInterface,
    isReady,
  } = useSolomonTheme();

  const visibleOptions = SOLOMON_INTERFACE_OPTIONS.filter(
    (opt) => !opt.adminOnly || canUseProfessionalInterface,
  );

  return (
    <section className={`${SOLOMON_GLASS_PANEL_CLASS} space-y-3`} aria-labelledby="solomon-appearance-heading">
      <div>
        <h2 id="solomon-appearance-heading" className="text-sm font-semibold text-[var(--solomon-text-primary)]">
          Appearance
        </h2>
        <p className="text-xs text-[var(--solomon-text-secondary)] mt-1">
          Interface style for Solomon on this device and account.
        </p>
      </div>

      <fieldset className="space-y-2.5 border-0 p-0 m-0" disabled={!isReady}>
        <legend className="sr-only">Interface style</legend>
        {visibleOptions.map((option) => (
          <StyleOption
            key={option.id}
            option={option}
            isSelected={interfaceStyle === option.id}
            onSelect={setInterfaceStyle}
            disabled={!isReady}
          />
        ))}
      </fieldset>

      {!canUseProfessionalInterface ? (
        <p className="text-[11px] text-[var(--solomon-text-muted)] leading-relaxed">
          Professional is available to administrators for preview. Everyone else uses Signature.
        </p>
      ) : null}
    </section>
  );
}
