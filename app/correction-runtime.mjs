import {
  canonizeMartyrsWinch,
  evaluateMartyrsWinchCorrection,
} from "./inheritance-model.mjs";

export function correctAndCanonizeMartyrsWinch(lineage, event) {
  const evaluation = evaluateMartyrsWinchCorrection({
    lineageState: lineage.state,
    ...event,
  });
  if (!evaluation.qualifying) return { evaluation, canonical: null };
  return {
    evaluation,
    canonical: canonizeMartyrsWinch(lineage, evaluation),
  };
}
