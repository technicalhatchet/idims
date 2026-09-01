'use client';

import Link from 'next/link';
import { resolveSolomonDiagnosticStatus } from './solomonDiagnosticStatus';
import { useSolomonDiagnosticLead } from './useSolomonDiagnosticLead';
import SolomonCategoryIcon from './categoryIcons';
import { getDiagnosticStepProgress } from './solomonDiagnosticStepProgress';
import SolomonApplianceLabel from './solomonApplianceLabel';
import useSolomonTheme from '../../hooks/useSolomonTheme';

const PROFESSIONAL_SESSION_SURFACE = {
  diagnostic_in_progress: 'border-l-4 border-l-[var(--solomon-status-diagnostic)] border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface-elevated)] shadow-[var(--solomon-shadow-card)]',
  repair_outcome_pending: 'border-l-4 border-l-[var(--solomon-status-repair)] border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface-elevated)] shadow-[var(--solomon-shadow-card)]',
  repair_successful: 'border-l-4 border-l-[var(--solomon-status-complete)] border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface-elevated)] shadow-[var(--solomon-shadow-card)]',
  repair_memory: 'border-l-4 border-l-[var(--solomon-status-memory)] border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface-elevated)] shadow-[var(--solomon-shadow-card)]',
  abandoned: 'border-l-4 border-l-[var(--solomon-status-abandoned)] border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface-elevated)] shadow-[var(--solomon-shadow-card)]',
  pending_sync: 'border-l-4 border-l-[var(--solomon-status-sync)] border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface-elevated)] shadow-[var(--solomon-shadow-card)]',
};

function equipmentMakeModel(target) {
  const parts = [
    target.equipment_make?.trim(),
    target.equipment_model?.trim(),
  ].filter(Boolean);
  return parts.join(' • ');
}

function SegmentedProgress({ stepNumber, totalSteps, compact = false, progressActiveClass, noGlow = false }) {
  if (!totalSteps) return null;
  const inactiveClass = compact
    ? 'bg-white/55 ring-1 ring-inset ring-white/20'
    : 'bg-white/40';
  const defaultActive = noGlow
    ? 'bg-[var(--solomon-status-diagnostic)]'
    : 'bg-cyan-400 shadow-[0_0_3px_rgba(34,211,238,0.45)]';
  const activeClass = progressActiveClass || defaultActive;
  return (
    <div className={`flex gap-[0.2em] ${compact ? '' : 'mt-2'}`}>
      {Array.from({ length: totalSteps }).map((_, index) => (
        <div
          key={index}
          className={`flex-1 rounded-full ${compact ? 'h-[0.5em]' : 'h-1'} ${
            index < stepNumber ? activeClass : inactiveClass
          }`}
        />
      ))}
    </div>
  );
}

export default function SolomonActiveSessionCard({ target, variant = 'default' }) {
  const { isProfessional } = useSolomonTheme();
  const stepProgress = getDiagnosticStepProgress(target);
  const totalSteps = stepProgress?.totalSteps || 0;
  const stepNumber = stepProgress?.stepNumber || 0;
  const lead = useSolomonDiagnosticLead(target);
  const templateId = target.template_id || target.payload?.templateId;
  const makeModelLine = equipmentMakeModel(target);

  if (!target) return null;

  const lifecycleStatus = resolveSolomonDiagnosticStatus(target);
  const isCompact = variant === 'heroOverlay';
  const isProSession = isProfessional && !isCompact;
  const surfaceClass = isCompact
    ? lifecycleStatus.surfaceHeroClass
    : isProSession
      ? (PROFESSIONAL_SESSION_SURFACE[lifecycleStatus.lifecycleKey]
        || PROFESSIONAL_SESSION_SURFACE.diagnostic_in_progress)
      : lifecycleStatus.surfaceDefaultClass;
  const padClass = isCompact
    ? 'px-[0.55em] py-[0.35em]'
    : isProSession
      ? 'px-3.5 py-3'
      : 'px-3 py-2.5';
  const proProgressActive = isProSession
    ? 'bg-[var(--solomon-status-diagnostic)]'
    : lifecycleStatus.progressActiveClass;

  if (isCompact) {
    return (
      <Link
        href={`/solomon/diagnostics/${target.id}?continue=1`}
        aria-label={totalSteps > 0
          ? `Last session, step ${stepNumber} of ${totalSteps}`
          : 'Last session'}
        className={`flex h-full min-h-0 flex-col justify-between overflow-hidden rounded-xl border transition-colors ${padClass} ${surfaceClass} ${lifecycleStatus.hoverBorderClass}`}
      >
        <div className="shrink-0">
          <p className={`shrink-0 overflow-hidden whitespace-nowrap text-[0.79em] uppercase tracking-[0.06em] font-medium leading-[1.1em] ${lifecycleStatus.labelTextClass}`}>
            Last Session
          </p>

          <div className="mt-[0.12em] flex items-start gap-[0.35em]">
            <SolomonApplianceLabel
              templateId={templateId}
              templateLabel={target.template_label}
              truncate
              className="min-w-0 flex-[0.85] text-[1.23em] font-semibold leading-[1.2em] text-white"
              suffixClassName="font-semibold text-white/55"
            />
            {lead ? (
              <div className="flex min-w-0 flex-1 flex-col items-end">
                <div className="flex max-w-full items-start justify-end gap-[0.2em]">
                  <span className="mt-[0.05em] flex h-[1.15em] w-[1.15em] shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
                    <SolomonCategoryIcon
                      categoryId={lead.categoryId}
                      categoryLabel={lead.categoryLabel}
                      size={12}
                    />
                  </span>
                  <span className="min-w-0 truncate text-right text-[0.96em] font-medium leading-[1.2em] text-white/90">
                    {lead.categoryLabel}
                  </span>
                </div>
                <p className="mt-[0.08em] w-full truncate text-right text-[0.88em] font-bold leading-[1.05em] text-emerald-400 tabular-nums">
                  {lead.percent}% {lead.strengthWord}
                </p>
                <div className="mt-[0.1em] flex w-full justify-end gap-[0.2em]">
                  <span className="w-[1.15em] shrink-0" aria-hidden />
                  <div className="h-[0.45em] min-w-0 flex-1 overflow-hidden rounded-full bg-white/55 ring-1 ring-inset ring-white/15">
                    <div
                      className="h-full bg-emerald-400 shadow-[0_0_3px_rgba(52,211,153,0.5)]"
                      style={{ width: `${Math.min(100, lead.percent)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {!lead ? <div className="h-[1.6em]" aria-hidden /> : null}
        </div>

        <div className="shrink-0 pb-px">
          {makeModelLine ? (
            <p className="mb-1 min-w-0 [overflow-x:clip] [text-overflow:ellipsis] whitespace-nowrap text-left text-[0.82em] leading-[1.2em] text-gray-400">
              {makeModelLine}
            </p>
          ) : null}
          <SegmentedProgress
            stepNumber={stepNumber}
            totalSteps={totalSteps}
            compact
            progressActiveClass={lifecycleStatus.progressActiveClass}
          />
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/solomon/diagnostics/${target.id}?continue=1`}
      className={`block rounded-[var(--solomon-radius-card)] transition-colors ${padClass} ${surfaceClass} ${
        isProSession
          ? 'hover:bg-[var(--solomon-surface)]'
          : lifecycleStatus.hoverBorderClass
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`uppercase tracking-[0.08em] font-medium ${lifecycleStatus.labelTextClass} ${
            isProSession ? 'text-[10px]' : 'text-[9px]'
          }`}>
            {isProSession ? 'Continue session' : 'Last Session'}
          </p>
          <SolomonApplianceLabel
            templateId={templateId}
            templateLabel={target.template_label}
            truncate
            className={`font-semibold text-white leading-tight ${isProSession ? 'text-[17px] mt-1' : isCompact ? 'text-sm mt-0' : 'text-base mt-0.5'}`}
            suffixClassName="font-semibold text-white/55"
          />
        </div>
        {lead ? (
          <div className="text-right shrink-0 min-w-0 max-w-[58%]">
            <div className="flex items-center justify-end gap-1">
              <span className={`flex items-center justify-center rounded-md ${
                isProSession
                  ? 'h-6 w-6 bg-[var(--solomon-status-complete)]/10 text-[var(--solomon-status-complete)]'
                  : `bg-emerald-500/10 text-emerald-400 ${isCompact ? 'h-5 w-5' : 'h-6 w-6'}`
              }`}>
                <SolomonCategoryIcon
                  categoryId={lead.categoryId}
                  categoryLabel={lead.categoryLabel}
                  size={12}
                />
              </span>
              <span className="text-[11px] font-medium text-white/90 leading-tight truncate">
                {lead.categoryLabel}
              </span>
            </div>
            <p className={`font-bold tabular-nums ${
              isProSession
                ? 'text-[var(--solomon-status-diagnostic)] text-xs mt-0.5'
                : `text-emerald-400 ${isCompact ? 'text-[10px] mt-0' : 'text-[11px] mt-0.5'}`
            }`}>
              {lead.percent}% {lead.strengthWord}
            </p>
            <div className={`h-1 rounded-full bg-white/55 ring-1 ring-inset ring-white/15 overflow-hidden w-full max-w-[120px] ml-auto ${isCompact ? 'mt-0.5' : 'mt-1'}`}>
              <div
                className={`h-full ${isProSession ? 'bg-[var(--solomon-status-diagnostic)]' : 'bg-emerald-400 shadow-[0_0_3px_rgba(52,211,153,0.5)]'}`}
                style={{ width: `${Math.min(100, lead.percent)}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {totalSteps > 0 ? (
        <div className={isCompact ? 'mt-1' : isProSession ? 'mt-2.5' : 'mt-2'}>
          {makeModelLine ? (
            <p className={`mb-1 truncate text-left ${
              isProSession
                ? 'text-[11px] text-[var(--solomon-text-muted)]'
                : `text-gray-400 ${isCompact ? 'text-[10px]' : 'text-[11px]'}`
            }`}>
              {makeModelLine}
            </p>
          ) : null}
          <SegmentedProgress
            stepNumber={stepNumber}
            totalSteps={totalSteps}
            compact={isCompact}
            progressActiveClass={proProgressActive}
            noGlow={isProSession}
          />
        </div>
      ) : makeModelLine ? (
        <p className={`mt-2 truncate text-left ${
          isProSession
            ? 'text-[11px] text-[var(--solomon-text-muted)]'
            : `text-gray-400 ${isCompact ? 'text-[10px]' : 'text-[11px]'}`
        }`}>
          {makeModelLine}
        </p>
      ) : null}
    </Link>
  );
}
