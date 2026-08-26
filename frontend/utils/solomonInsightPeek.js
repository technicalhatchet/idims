/**
 * Detect meaningful elimination / intelligence updates for insight peek banners.
 */

function ids(list) {
  return (list || []).map((item) => item.id).filter(Boolean);
}

export function hasNewEliminationInsight(previous, current) {
  if (!current) return false;

  const prevConfirmed = new Set(ids(previous?.confirmed));
  const prevSuspected = new Set(ids(previous?.suspected));
  const prevEliminated = new Set(ids(previous?.eliminated));

  const newConfirmed = (current.confirmed || []).some((item) => !prevConfirmed.has(item.id));
  const newSuspected = (current.suspected || []).some((item) => !prevSuspected.has(item.id));
  const newEliminated = (current.eliminated || []).some((item) => !prevEliminated.has(item.id));

  return newConfirmed || newSuspected || newEliminated;
}

export function hasSignificantIntelligenceChange(previous, current) {
  if (!current?.topCategories?.length) return false;
  if (!previous?.topCategories?.length) {
    return current.matchedRuleCount > 0;
  }

  const prevTop = previous.topCategories[0];
  const currTop = current.topCategories[0];
  if (prevTop.id !== currTop.id) return true;
  if (currTop.evidence - prevTop.evidence >= 10) return true;

  const prevRuleIds = new Set((previous.ledger || []).map((entry) => entry.ruleId));
  return (current.ledger || []).some(
    (entry) => !prevRuleIds.has(entry.ruleId) && entry.delta >= 8,
  );
}

export function eliminationInsightLabel(result) {
  if (result?.confirmed?.length) return 'View confirmed cause insight';
  if (result?.suspected?.length) return 'View likely cause insight';
  if (result?.eliminated?.length) return 'View ruled-out insight';
  return 'View evidence insight';
}
