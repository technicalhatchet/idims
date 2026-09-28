export const MATCHER_IMPROVEMENT_GATE_ID = 'matcher-improvement-wave1';

export const MATCHER_IMPROVEMENT_GUIDANCE_TITLE = 'Matcher improvement review (17 safe backlog items)';

export const MATCHER_IMPROVEMENT_GUIDANCE = {
  gateMeaning:
    'Human gate for the smallest safe matcher-improvement backlog only. Each decision applies to one backlogId — not a category-wide rule.',
  promotionBoundary:
    'APPROVE does not implement matcher changes, add aliases, or modify canonical ontology. Implementation is a separate governed commit after all reviews.',
  sourceTermWarning:
    'SOURCE TERM ALONE IS NEVER SUFFICIENT. Evaluate functional equivalence using sibling evidence, procedure families, and decomposition — not substring patterns.',
  decisions: {
    approve: {
      label: 'Approve',
      guidance:
        'Evidence supports implementing this specific matcher/alias/decomposition/context improvement for this backlog item only.',
    },
    defer: {
      label: 'Defer',
      guidance: 'Plausible pattern but needs narrower bounds or more validation.',
    },
    reject: {
      label: 'Reject',
      guidance: 'Do not generalize this pattern into matcher behavior.',
    },
    no_change: {
      label: 'No change',
      guidance: 'Sibling evidence is valid, but no matcher change should be made.',
    },
  },
};
