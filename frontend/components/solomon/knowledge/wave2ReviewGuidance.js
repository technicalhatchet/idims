export const WAVE2_REVIEW_CLASS = 'newPlatformKnowledge';

export const WAVE2_GUIDANCE_TITLE = 'How to review Wave 2 — new platform knowledge';

export const WAVE2_GUIDANCE = {
  waveMeaning:
    'Each candidate proposes manufacturer- or platform-specific implementation knowledge Solomon should retain. You are judging whether it is useful implementation context — not whether to add a new universal canonical function.',
  decisions: {
    accepted: {
      label: 'Accept',
      guidance:
        'Use when the candidate is legitimate platform/manufacturer knowledge worth keeping, supported by source context, and does not require changing frozen canonical ontology.',
      example:
        'A Samsung FlexWash integration note with clear procedure provenance that helps technicians without inventing a new canonical node.',
    },
    rejected: {
      label: 'Reject',
      guidance:
        'Use when the row is extraction noise, misclassified, unsupported by provenance, or not valid platform knowledge.',
      example:
        'A bare TEST # heading with no distinct implementation fact beyond an already-reviewed functional mapping.',
    },
    deferred: {
      label: 'Defer',
      guidance:
        'Use when evidence is thin, ambiguous, conflicts with architecture, or the item looks like a new canonical abstraction.',
      example:
        'Terminology suggests a novel system-level function that would need an architecture gate — defer, do not approve a canonical node here.',
    },
  },
  promotionBoundary:
    'Accept records human review only. It does not promote knowledge into the frozen canonical ontology.',
  newCanonicalRule:
    'If a candidate appears to require a new canonical node or function, defer it for architecture review. Do not invent or approve ontology during Wave 2.',
  evidenceHierarchy:
    'Use procedure context, provenance, platform/manual identity, and source location — not terminology alone. Wave 1 synthesis patterns (TEST # headings, § sections, connector ids like DP2, supply terminology) inform judgment but are not blanket rules.',
  patternAwareness:
    'OEM TEST # and § headings often duplicate functional siblings; connector labels may be schematic references; supply terminology is inconsistent across the corpus — judge each candidate on its evidence.',
};
