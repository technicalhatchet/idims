export const WAVE3_REVIEW_CLASS = 'newCanonicalKnowledge';

export const WAVE3_GUIDANCE_TITLE = 'How to review Wave 3 — new canonical knowledge';

export const WAVE3_GUIDANCE = {
  waveMeaning:
    'Each candidate proposes evidence that a genuinely new canonical functional abstraction may be needed. You are judging whether the evidence is strong enough to enter the architecture / promotion consideration path — not whether to create the node now.',
  waveContrast:
    'Wave 2 asked: is this valid platform-specific implementation knowledge? Wave 3 asks: is evidence strong enough to justify a potential new canonical functional abstraction?',
  decisions: {
    accepted: {
      label: 'Accept',
      guidance:
        'Use when there is sufficient evidence that a new canonical functional abstraction may be required and the candidate is appropriate for architectural review and promotion consideration.',
      example:
        'A distinct system-level function appears repeatedly across platforms with clear diagnostic evidence, not explained by existing frozen canonical nodes.',
    },
    rejected: {
      label: 'Reject',
      guidance:
        'Use when the row is not actually new canonical knowledge and should not enter canonical discovery or promotion.',
      example:
        'Maps cleanly to an existing frozen function, or is platform-only knowledge that belongs in Wave 2 — not ontology expansion.',
    },
    deferred: {
      label: 'Defer',
      guidance:
        'Use when canonical expansion might be warranted but evidence is insufficient, ambiguous, too manufacturer-specific, or needs more witness/manual/fit evidence.',
      example:
        'Possible new abstraction with thin manual support or conflicting blockers — defer for architecture review.',
    },
  },
  promotionBoundary:
    'Accept confirms a legitimate new-canonical candidate for human architecture review. It does NOT mutate, freeze, or promote canonical ontology.',
  architecturePath:
    'Actual canonical creation remains behind architecture fit → discovery → freeze → human approval → promotion. Wave 3 is not a shortcut.',
  evidenceHierarchy:
    'Prioritize procedure context, proposed canonical target, candidate type, substantive functional evidence, platform identity, provenance/pages, and conflicts/reconciliation — not sourceTerm labels alone.',
  sourceTermWarning:
    'Do not treat sourceTerm as the canonical concept name; it may contain extraction artifacts, codes, or headings.',
};
