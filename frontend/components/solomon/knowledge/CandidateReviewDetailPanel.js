/**
 * Presentation-only: same candidate fields as the original workbench detail panel,
 * one accordion per logical information group (summary always visible; expand for full text).
 */
import { useEffect, useState } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { SOLOMON_REFERENCE_EYEBROW_CLASS } from '../solomonListPageUi';
import {
  blockersSectionPreview,
  EXISTING_CANONICAL_MAPPING_NOTICE,
  formatSourceTermLabel,
  NEW_CANONICAL_KNOWLEDGE_NOTICE,
  reconciliationSectionPreview,
  REVIEW_SECTION_NUMBERED_LABELS,
  formatWhereProvenance,
} from './candidateReviewWorkflow';
import ReviewDecisionBar from './ReviewDecisionBar';
import {
  isNewPlatformKnowledgeCandidate,
  reviewSectionPreviewsForCandidate,
  wave2DiagnosticKnowledgeLines,
} from './wave2ReviewPresentation';

export const REVIEW_DETAIL_SECTIONS = {
  what: 'what',
  mapsTo: 'mapsTo',
  where: 'where',
  why: 'why',
  blockers: 'blockers',
  context: 'context',
  reconciliation: 'reconciliation',
};

const REVIEW_KEY_VALUE_CLASS =
  'font-semibold text-[var(--solomon-text-primary)]';

export function SectionPreviewBlock({ preview }) {
  if (
    !preview
    || (preview.primary === '—' && (!preview.secondaryLines || preview.secondaryLines.length === 0))
  ) {
    return (
      <p className="mt-1 text-[11px] text-[var(--solomon-text-muted)] leading-snug">—</p>
    );
  }

  return (
    <div className="mt-1 space-y-0.5">
      {preview.primary && preview.primary !== '—' ? (
        <p className={`text-sm leading-snug ${REVIEW_KEY_VALUE_CLASS}`}>{preview.primary}</p>
      ) : null}
      {preview.secondaryLines?.map((line) => (
        <p key={`${line.label}-${line.value}`} className="text-[11px] leading-snug">
          <span className="text-[var(--solomon-text-muted)]">{line.label} </span>
          <span
            className={
              line.deemphasize
                ? 'text-[10px] text-[var(--solomon-text-muted)]'
                : line.emphasize
                  ? REVIEW_KEY_VALUE_CLASS
                  : 'text-[var(--solomon-text-secondary)]'
            }
          >
            {line.value}
          </span>
        </p>
      ))}
    </div>
  );
}

function CollapsibleSection({
  sectionId,
  title,
  preview,
  isOpen,
  onToggle,
  children,
}) {
  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(sectionId)}
        aria-expanded={isOpen}
        className="solomon-focus-ring flex w-full items-start justify-between gap-2 py-2.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <h3 className={SOLOMON_REFERENCE_EYEBROW_CLASS}>{title}</h3>
          <SectionPreviewBlock preview={preview} />
        </div>
        {isOpen ? (
          <FaChevronUp className="mt-0.5 h-3 w-3 shrink-0 text-[var(--solomon-text-muted)]" aria-hidden />
        ) : (
          <FaChevronDown className="mt-0.5 h-3 w-3 shrink-0 text-[var(--solomon-text-muted)]" aria-hidden />
        )}
      </button>
      {isOpen ? (
        <div className="border-t border-[color:var(--solomon-border-muted)] pb-3 pt-2 text-xs text-[var(--solomon-text-secondary)] whitespace-pre-wrap break-words space-y-2">
          <SectionPreviewBlock preview={preview} />
          {children ? (
            <div className="border-t border-[color:var(--solomon-border-muted)] pt-2">
              {children}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function CandidateReviewDetailPanel({
  selected,
  selectedStatus,
  selectedReconciliation,
  saving,
  decisionsLoading,
  error,
  onDecision,
}) {
  const [openSections, setOpenSections] = useState({});

  useEffect(() => {
    setOpenSections({});
  }, [selected?.candidateId]);

  if (!selected) {
    return (
      <p className="text-sm text-[var(--solomon-text-muted)]">
        Select a candidate to inspect provenance and decide.
      </p>
    );
  }

  const toggleSection = (sectionId) => {
    setOpenSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  };

  const isOpen = (sectionId) => Boolean(openSections[sectionId]);

  const wave2 = isNewPlatformKnowledgeCandidate(selected);
  const sectionPreviews = reviewSectionPreviewsForCandidate(selected);
  const diagnosticLines = wave2 ? wave2DiagnosticKnowledgeLines(selected) : [];

  return (
    <div className="space-y-4" key={selected.candidateId}>
      <div data-testid={wave2 ? 'wave2-review-highlight' : undefined}>
        {wave2 ? (
          <>
            <p className={SOLOMON_REFERENCE_EYEBROW_CLASS}>Procedure</p>
            <h2 className="mt-1 text-sm font-semibold text-[var(--solomon-text-primary)]">
              {selected.what?.procedureId || '—'}
            </h2>
            <p className="mt-1 text-sm font-semibold text-[var(--solomon-text-primary)]">
              {selected.mapsTo?.proposedCanonicalId || '—'}
            </p>
            {selected.mapsTo?.candidateType ? (
              <p className="mt-0.5 text-[11px] font-semibold text-[var(--solomon-text-primary)]">
                {selected.mapsTo.candidateType}
              </p>
            ) : null}
            {diagnosticLines.length > 0 ? (
              <div className="mt-1 space-y-0.5">
                {diagnosticLines.map((line) => (
                  <p key={`${line.label}-${line.value}`} className="text-[11px] leading-snug">
                    <span className="text-[var(--solomon-text-muted)]">{line.label} </span>
                    <span className={REVIEW_KEY_VALUE_CLASS}>{line.value}</span>
                  </p>
                ))}
              </div>
            ) : null}
            <p className="mt-1 text-[11px] text-[var(--solomon-text-muted)]">
              sourceTerm: {selected.what?.sourceTerm || '—'}
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--solomon-text-muted)]">{selected.candidateId}</p>
          </>
        ) : (
          <>
            <p className={SOLOMON_REFERENCE_EYEBROW_CLASS}>Candidate</p>
            <h2 className="mt-1 text-sm font-semibold text-[var(--solomon-text-primary)]">
              {formatSourceTermLabel(selected)}
            </h2>
            <p className="mt-1 text-[11px] text-[var(--solomon-text-muted)]">{selected.candidateId}</p>
          </>
        )}
      </div>

      <ReviewDecisionBar
        selectedStatus={selectedStatus}
        saving={saving}
        decisionsLoading={decisionsLoading}
        error={error}
        onDecision={onDecision}
      />

      <div className="divide-y divide-[color:var(--solomon-border-muted)] border-t border-[color:var(--solomon-border-muted)]">
        <CollapsibleSection
          sectionId={REVIEW_DETAIL_SECTIONS.what}
          title={REVIEW_SECTION_NUMBERED_LABELS.what}
          preview={sectionPreviews.what}
          isOpen={isOpen(REVIEW_DETAIL_SECTIONS.what)}
          onToggle={toggleSection}
        >
          {JSON.stringify(selected.what || {}, null, 2)}
        </CollapsibleSection>

        <CollapsibleSection
          sectionId={REVIEW_DETAIL_SECTIONS.mapsTo}
          title={REVIEW_SECTION_NUMBERED_LABELS.mapsTo}
          preview={sectionPreviews.mapsTo}
          isOpen={isOpen(REVIEW_DETAIL_SECTIONS.mapsTo)}
          onToggle={toggleSection}
        >
          {JSON.stringify(selected.mapsTo || {}, null, 2)}
          {selected.reviewClass === 'existingCanonicalMapping' ? (
            <p className="rounded-md border border-cyan-500/25 bg-cyan-500/5 p-2 text-[11px] text-cyan-100/90">
              {EXISTING_CANONICAL_MAPPING_NOTICE}
            </p>
          ) : null}
          {selected.reviewClass === 'newCanonicalKnowledge' ? (
            <p className="rounded-md border border-amber-500/25 bg-amber-500/5 p-2 text-[11px] text-amber-100/90">
              {NEW_CANONICAL_KNOWLEDGE_NOTICE}
            </p>
          ) : null}
        </CollapsibleSection>

        <CollapsibleSection
          sectionId={REVIEW_DETAIL_SECTIONS.where}
          title={REVIEW_SECTION_NUMBERED_LABELS.where}
          preview={sectionPreviews.where}
          isOpen={isOpen(REVIEW_DETAIL_SECTIONS.where)}
          onToggle={toggleSection}
        >
          {formatWhereProvenance(selected)}
        </CollapsibleSection>

        <CollapsibleSection
          sectionId={REVIEW_DETAIL_SECTIONS.why}
          title={REVIEW_SECTION_NUMBERED_LABELS.why}
          preview={sectionPreviews.why}
          isOpen={isOpen(REVIEW_DETAIL_SECTIONS.why)}
          onToggle={toggleSection}
        >
          {JSON.stringify(selected.why || {}, null, 2)}
        </CollapsibleSection>

        <CollapsibleSection
          sectionId={REVIEW_DETAIL_SECTIONS.blockers}
          title={REVIEW_SECTION_NUMBERED_LABELS.blockers}
          preview={blockersSectionPreview(selected)}
          isOpen={isOpen(REVIEW_DETAIL_SECTIONS.blockers)}
          onToggle={toggleSection}
        >
          {JSON.stringify(selected.blockers || {}, null, 2)}
        </CollapsibleSection>

        <CollapsibleSection
          sectionId={REVIEW_DETAIL_SECTIONS.context}
          title={REVIEW_SECTION_NUMBERED_LABELS.context}
          preview={sectionPreviews.context}
          isOpen={isOpen(REVIEW_DETAIL_SECTIONS.context)}
          onToggle={toggleSection}
        >
          {JSON.stringify(selected.context || {}, null, 2)}
        </CollapsibleSection>

        {selectedReconciliation ? (
          <CollapsibleSection
            sectionId={REVIEW_DETAIL_SECTIONS.reconciliation}
            title={REVIEW_SECTION_NUMBERED_LABELS.reconciliation}
            preview={reconciliationSectionPreview(selectedReconciliation)}
            isOpen={isOpen(REVIEW_DETAIL_SECTIONS.reconciliation)}
            onToggle={toggleSection}
          >
            {JSON.stringify(selectedReconciliation, null, 2)}
          </CollapsibleSection>
        ) : null}
      </div>
    </div>
  );
}
