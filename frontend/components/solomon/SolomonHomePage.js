'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { FaChevronRight, FaPlus } from 'react-icons/fa';
import { getWizardDefinition, resolveWizardSteps } from '../diagnostics';
import { evaluateDiagnosticIntelligence } from '../diagnostics/intelligence/diagnosticIntelligenceEngine';
import { formatDiyLeadCard } from '../diagnostics/intelligence/evidenceDisplay';
import { buildFieldLabelsForTemplate } from '../diagnostics/intelligence/fieldLabels';
import { extractDefaultStepOrder } from '../diagnostics/intelligence/reorderWizardSteps';
import { buildStepKeyLabels } from '../diagnostics/intelligence/stepKeyLabels';
import { buildMeasurementStatusMap } from '../diagnostics/knowledge/measurementContext';
import { getDiagnosticTemplate } from '../../constants/diagnosticTemplates';
import SolomonInstallHint from './SolomonInstallHint';
import SolomonHomeHeader from './SolomonHomeHeader';
import SolomonActiveSessionCard from './SolomonActiveSessionCard';
import SolomonHomeMenuGrid from './SolomonHomeMenuGrid';
import SolomonSmarterCard from './SolomonSmarterCard';
import SolomonOfflineFooter from './SolomonOfflineFooter';
import { useSolomonAuth } from '../../hooks/useSolomonAuth';
import { useSolomonContinue } from '../../hooks/useSolomonContinue';
import { useSolomonTopInset, solomonSafeBottom } from './solomonSafeArea';
import { solomonLoginUrl } from '../../utils/solomonAuthUrls';

const COSMIC_BG = '/images/solomonwiz/blueoragnecosmicbg.png';
const WIZARD_HERO = '/images/solomonwiz/wizbookwrench.png';

function useSessionAccuracy(continueTarget) {
  const templateId = continueTarget?.payload?.templateId;
  const wizardDefinition = getWizardDefinition(templateId);
  const template = getDiagnosticTemplate(templateId);

  const wizardSteps = useMemo(
    () => resolveWizardSteps(wizardDefinition, template),
    [wizardDefinition, template],
  );

  const stepKeyLabels = useMemo(
    () => buildStepKeyLabels(wizardDefinition),
    [wizardDefinition],
  );

  const fieldLabels = useMemo(
    () => buildFieldLabelsForTemplate(templateId),
    [templateId],
  );

  const visitedStepKeys = continueTarget?.payload?.visitedStepKeys || [];
  const defaultStepOrder = useMemo(
    () => extractDefaultStepOrder(wizardSteps),
    [wizardSteps],
  );

  const measurementStatuses = useMemo(
    () => buildMeasurementStatusMap(templateId, continueTarget?.payload?.fields || {}),
    [templateId, continueTarget?.payload?.fields],
  );

  return useMemo(() => {
    if (!templateId || !continueTarget) return null;
    const intelligence = evaluateDiagnosticIntelligence(
      templateId,
      continueTarget.payload?.fields || {},
      measurementStatuses,
      {
        visitedStepKeys,
        defaultStepOrder,
        complaintChips: wizardDefinition?.complaintChips || [],
        dmaNudges: null,
        fieldLabels,
        stepKeyLabels,
      },
    );
    const lead = formatDiyLeadCard(intelligence);
    return lead?.percent ?? null;
  }, [
    templateId,
    continueTarget,
    measurementStatuses,
    visitedStepKeys,
    defaultStepOrder,
    wizardDefinition?.complaintChips,
    fieldLabels,
    stepKeyLabels,
  ]);
}

export default function SolomonHomePage() {
  const { isDiyer, isStaff, canUseSolomon } = useSolomonAuth();
  const { continueTarget, isLoading: continueLoading } = useSolomonContinue();
  const topInset = useSolomonTopInset();
  const accuracyPercent = useSessionAccuracy(continueTarget);

  const newHref = isDiyer ? '/solomon/start' : '/solomon/diagnose';
  const newTitle = isDiyer ? 'Start troubleshooting' : 'New diagnostic';
  const newSubtitle = isDiyer
    ? 'Walk through symptoms step by step'
    : 'Start a new guided diagnostic';

  return (
    <div className="relative min-h-screen text-white bg-[#070b14]">
      <main
        className="relative mx-auto max-w-lg"
        style={{
          ...topInset,
          ...solomonSafeBottom,
          paddingBottom: 'max(4rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="px-4">
          <SolomonInstallHint />

          {/* Hero viewport — wizard cropped/scaled, header overlaid */}
          <div className="relative -mx-4 h-[min(38vh,200px)] max-h-[200px] overflow-hidden">
            <img
              src={COSMIC_BG}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center scale-110"
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#070b14]/20 via-transparent to-[#070b14]" />
            <div className="absolute inset-0 bg-[#070b14]/30" />

            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <img
                src={WIZARD_HERO}
                alt=""
                className="absolute left-1/2 top-[2%] w-[130%] max-w-none select-none pointer-events-none"
                style={{
                  transform: 'translateX(-50%) scale(1.55)',
                  transformOrigin: 'center top',
                }}
                decoding="async"
              />
            </div>

            <div className="relative z-10 px-4 pt-0.5">
              <SolomonHomeHeader isStaff={isStaff} />
            </div>
          </div>

          {canUseSolomon ? (
            <div className="relative z-20 -mt-6 space-y-2">
              {!continueLoading && continueTarget ? (
                <SolomonActiveSessionCard target={continueTarget} />
              ) : null}

              <Link
                href={newHref}
                className="flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#0089B9] to-[#006a94] px-3 py-2.5 shadow-[0_4px_16px_rgba(0,137,185,0.35)] hover:from-[#0099cc] hover:to-[#007aa8] transition-colors"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10">
                  <FaPlus size={12} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-white block leading-tight">
                    {newTitle}
                  </span>
                  <span className="text-[11px] text-cyan-100/75 block leading-snug">
                    {newSubtitle}
                  </span>
                </span>
                <FaChevronRight size={11} className="text-white/60 shrink-0" />
              </Link>

              <SolomonHomeMenuGrid isDiyer={isDiyer} isStaff={isStaff} />

              <SolomonSmarterCard isDiyer={isDiyer} accuracyPercent={accuracyPercent} />

              <SolomonOfflineFooter syncReferenceTime={continueTarget?.updated_at} />
            </div>
          ) : (
            <div className="relative z-20 -mt-4">
              <Link
                href="/solomon/signup"
                className="block rounded-xl bg-gradient-to-r from-[#0089B9] to-[#006a94] px-3 py-2.5 text-center text-sm font-semibold"
              >
                Create homeowner account to start
              </Link>
            </div>
          )}

          <div className="mt-5 space-y-2 border-t border-white/10 pt-4">
            {!isStaff && !isDiyer ? (
              <Link
                href="/solomon/signup"
                className="block text-center text-xs text-cyan-400 hover:text-cyan-300"
              >
                Homeowner? Create a free account →
              </Link>
            ) : null}
            <a
              href={solomonLoginUrl()}
              className="block text-center text-[11px] text-white/45 hover:text-white/65"
            >
              Sign in with another account
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
