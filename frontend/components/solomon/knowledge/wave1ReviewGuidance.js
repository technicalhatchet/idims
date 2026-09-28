export const WAVE1_REVIEW_CLASS = 'existingCanonicalMapping';

export const WAVE1_GUIDANCE_TITLE = 'How to review Wave 1 — existing canonical mapping';

export const WAVE1_GUIDANCE = {
  waveMeaning:
    'Each candidate proposes that a manual implementation term maps to an already-frozen canonical function in Solomon. You are validating that mapping against source evidence — not expanding the ontology.',
  decisions: {
    accepted: {
      label: 'Accept',
      guidance:
        'Use when the displayed source evidence supports mapping the manual term to the proposed frozen canonical function without distortion.',
      example:
        'Manual term "door lock" in procedure w8178558-door-lock, with page/procedure context, maps to frozen door_lock.',
    },
    rejected: {
      label: 'Reject',
      guidance:
        'Use when the proposed canonical mapping is contradicted by the source, clearly maps to a different frozen function, or would distort the implementation.',
      example:
        'Source describes a lid interlock but the candidate maps to door_lock.',
    },
    deferred: {
      label: 'Defer',
      guidance:
        'Use when evidence is insufficient, ambiguous, contradictory, or requires an architecture decision outside this wave.',
      example:
        'Terminology is vague, pages are missing, or the component may need a new abstraction — defer for separate architecture review.',
    },
  },
  promotionBoundary:
    'A review decision is not canonical promotion. Accepted mappings remain review records only. No canonical graph mutation occurs.',
  newCanonicalRule:
    'If evidence suggests a genuinely new canonical abstraction, do not invent or approve a new canonical node in Wave 1. Defer the candidate for separate architecture review.',
  evidenceHierarchy:
    'Prefer displayed procedure context, measurements, page/source location, and provenance over assumptions based only on terminology.',
};
