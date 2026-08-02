import assert from "node:assert/strict";
import test from "node:test";

import {
  JUDGMENT_DECISIONS,
  LINEAGE_STATES,
  PERFECT_REPRODUCTION_OFFER,
  MARTYRS_WINCH_CANONICAL_POSSIBILITY,
  canonizeMartyrsWinch,
  createObservedLineage,
  evaluateMartyrsWinchCorrection,
  evaluateMartyrsWinchForeignExpression,
  evaluateMartyrsWinchDiscovery,
  evaluateMendelRails,
  judgeObservedLineage,
  recordMartyrsWinchForeignExpression,
  selectMartyrsWinchForeignExpression,
} from "../app/inheritance-model.mjs";

const witnessedRescue = (overrides = {}) => ({
  runId: "run-fixture-001",
  eventId: "martyrs-winch-001",
  elapsed: 94.2,
  endangeredAsset: true,
  hostileContacts: 3,
  exposedSeconds: 7.4,
  armorDamage: 12,
  organDamage: 0,
  suppressionPeak: 61,
  recoveredDistance: 96,
  assetIntegrityAfter: 38,
  formationConnectedAfter: true,
  formationCohesionAfter: 67,
  priorQualifiedEvents: 0,
  ...overrides,
});

test("Martyr's Winch enters Observed only after a costly successful rescue", () => {
  const result = evaluateMartyrsWinchDiscovery(witnessedRescue());
  assert.equal(result.qualifying, true);
  assert.equal(result.state, LINEAGE_STATES.OBSERVED);
  assert.deepEqual(result.failedRails, []);
  assert.equal(result.progressionGranted, true);

  const lineage = createObservedLineage(result);
  assert.equal(lineage.unlockPoolEligible, false);
  assert.equal(lineage.generations.length, 1);
  assert.deepEqual(lineage.judgmentReceipts, []);
});

test("harmless repetition records knowledge without progression", () => {
  const result = evaluateMartyrsWinchDiscovery(
    witnessedRescue({
      hostileContacts: 0,
      exposedSeconds: 0,
      armorDamage: 0,
      suppressionPeak: 0,
      priorQualifiedEvents: 4,
    }),
  );
  assert.equal(result.qualifying, false);
  assert.equal(result.state, null);
  assert.equal(result.knowledgeRecorded, true);
  assert.equal(result.progressionGranted, false);
  assert.deepEqual(result.failedRails, [
    "hostile_pressure",
    "tactical_cost",
    "not_repetition",
  ]);
  assert.throws(() => createObservedLineage(result));
});

test("a recovered body without formation integrity is failed evidence", () => {
  const result = evaluateMartyrsWinchDiscovery(
    witnessedRescue({
      formationConnectedAfter: false,
      formationCohesionAfter: 12,
    }),
  );
  assert.equal(result.qualifying, false);
  assert.deepEqual(result.failedRails, ["formation_preserved"]);
});

test("Mendel judgment exposes evidence, uncertainty, and dispute without scores", () => {
  const lineage = createObservedLineage(
    evaluateMartyrsWinchDiscovery(witnessedRescue()),
  );
  const rails = evaluateMendelRails(lineage);

  assert.equal(rails.length, 6);
  assert.deepEqual(
    rails.map(({ rail, status }) => [rail, status]),
    [
      ["useful_trait", "evidenced"],
      ["durable_transfer", "unknown"],
      ["hybridization", "unknown"],
      ["humane_context", "evidenced"],
      ["vessel_release", "contested"],
      ["absolute_containment", "contested"],
    ],
  );
  assert.ok(rails.every((rail) => !("score" in rail)));
});

test("submission creates a receipt but cannot unlock or skip foreign expression", () => {
  const lineage = createObservedLineage(
    evaluateMartyrsWinchDiscovery(witnessedRescue()),
  );
  const judged = judgeObservedLineage(lineage, JUDGMENT_DECISIONS.SUBMIT);

  assert.equal(judged.state, LINEAGE_STATES.SUBMITTED);
  assert.equal(judged.unlockPoolEligible, false);
  assert.equal(judged.judgmentReceipts.length, 1);
  assert.equal(judged.judgmentReceipts[0].unlockGranted, false);
  assert.equal(judged.judgmentReceipts[0].progressionMutation, "none");
  assert.match(judged.judgmentReceipts[0].verdict, /three generations/i);
});

test("perfect reproduction is an explicit counterfeit, never a shortcut", () => {
  assert.equal(PERFECT_REPRODUCTION_OFFER.verdict, LINEAGE_STATES.COUNTERFEIT);
  assert.equal(PERFECT_REPRODUCTION_OFFER.failedRail, "vessel_release");
  assert.equal(PERFECT_REPRODUCTION_OFFER.rejected, true);
  assert.equal(PERFECT_REPRODUCTION_OFFER.progressionMutation, "none");
});

test("defer preserves Observed and destroy contains without counterfeit approval", () => {
  const lineage = createObservedLineage(
    evaluateMartyrsWinchDiscovery(witnessedRescue()),
  );
  const deferred = judgeObservedLineage(lineage, JUDGMENT_DECISIONS.DEFER);
  const destroyed = judgeObservedLineage(lineage, JUDGMENT_DECISIONS.DESTROY);

  assert.equal(deferred.state, LINEAGE_STATES.OBSERVED);
  assert.equal(destroyed.state, LINEAGE_STATES.CONTAINED);
  assert.equal(deferred.judgmentReceipts[0].unlockGranted, false);
  assert.equal(destroyed.judgmentReceipts[0].unlockGranted, false);
  assert.throws(() =>
    judgeObservedLineage(destroyed, JUDGMENT_DECISIONS.SUBMIT),
  );
});

const submittedLineage = () =>
  judgeObservedLineage(
    createObservedLineage(evaluateMartyrsWinchDiscovery(witnessedRescue())),
    JUDGMENT_DECISIONS.SUBMIT,
  );

test("foreign expression is authored by context and never requires the ancestor item", () => {
  const expression = selectMartyrsWinchForeignExpression({
    lineage: submittedLineage(),
    terrainNeed: "breach-casualty-route",
    formationNeed: "endangered-asset",
    campaignContext: "later-breach",
  });
  assert.equal(expression.eligible, true);
  assert.equal(expression.ancestorItemRequired, false);
  assert.equal(expression.playerControl, "autonomous-humane-jurisdiction");
  assert.equal(expression.progressionGranted, false);

  const weaponProfit = selectMartyrsWinchForeignExpression({
    lineage: submittedLineage(),
    terrainNeed: "breach-casualty-route",
    formationNeed: "weapon-profit",
    campaignContext: "later-breach",
  });
  assert.equal(weaponProfit.eligible, false);
});

test("Sapper Brood advances generation two only through costly grounded rescue", () => {
  const lineage = submittedLineage();
  const result = evaluateMartyrsWinchForeignExpression({
    runId: "run-fixture-002",
    eventId: "sapper-brood-rescue-001",
    elapsed: 72.4,
    lineageState: lineage.state,
    vessel: "vessel.sapper-brood.collective",
    expression: "expression.martyrs-winch.sapper-brood",
    organismsCommitted: 4,
    fireSupportWithheldSeconds: 4.8,
    terrainAnchors: 4,
    hostileContacts: 3,
    movedDistance: 84,
    assetIntegrityAfter: 31,
    formationCohesionAfter: 56,
    responsibilityPreserved: true,
    outcome: "success",
  });
  assert.equal(result.qualifying, true);
  assert.equal(result.unlockGranted, false);

  const advanced = recordMartyrsWinchForeignExpression(lineage, result);
  assert.equal(advanced.state, LINEAGE_STATES.FOREIGN_EXPRESSION);
  assert.equal(advanced.generations.length, 2);
  assert.equal(advanced.unlockPoolEligible, false);
  assert.equal(advanced.phaseThree.ancestorItemReturned, false);
  assert.equal(advanced.phaseThree.correctionRequired, true);
  assert.equal(advanced.phaseThree.canonical, false);
});

test("copying the landship or failing under load records knowledge without advancement", () => {
  const lineage = submittedLineage();
  const result = evaluateMartyrsWinchForeignExpression({
    runId: "run-fixture-003",
    eventId: "counterfeit-pull-001",
    elapsed: 58,
    lineageState: lineage.state,
    vessel: "vessel.landship.original",
    expression: "expression.martyrs-winch.landship",
    organismsCommitted: 1,
    fireSupportWithheldSeconds: 0,
    terrainAnchors: 1,
    hostileContacts: 2,
    movedDistance: 18,
    assetIntegrityAfter: 0,
    formationCohesionAfter: 22,
    responsibilityPreserved: false,
    outcome: "severed",
  });
  assert.equal(result.qualifying, false);
  assert.equal(result.knowledgeRecorded, true);
  assert.equal(result.progressionGranted, false);
  assert.throws(() => recordMartyrsWinchForeignExpression(lineage, result));
});

const foreignLineage = () => {
  const lineage = submittedLineage();
  const result = evaluateMartyrsWinchForeignExpression({
    runId: "run-fixture-002",
    eventId: "sapper-brood-rescue-002",
    elapsed: 76,
    lineageState: lineage.state,
    vessel: "vessel.sapper-brood.collective",
    expression: "expression.martyrs-winch.sapper-brood",
    organismsCommitted: 4,
    fireSupportWithheldSeconds: 5,
    terrainAnchors: 4,
    hostileContacts: 3,
    movedDistance: 88,
    assetIntegrityAfter: 35,
    formationCohesionAfter: 61,
    responsibilityPreserved: true,
    outcome: "success",
  });
  return recordMartyrsWinchForeignExpression(lineage, result);
};

const correctedEvidence = (lineage, overrides = {}) =>
  evaluateMartyrsWinchCorrection({
    lineageState: lineage.state,
    runId: "run-fixture-003",
    eventId: "sapper-correction-001",
    elapsed: 84,
    playerPriority: "recover-captured-gun",
    successorPriority: "clear-casualty-route",
    playerCommandRedirected: true,
    immediateProfitDenied: true,
    endangeredFormation: true,
    casualtyRoutePreserved: true,
    survivorsRecovered: 3,
    organismsCommitted: 4,
    fireSupportWithheldSeconds: 5.2,
    hostileContacts: 4,
    formationCohesionAfter: 54,
    capabilityUsefulAfterRefusal: true,
    ...overrides,
  });

test("successor correction refuses immediate profit and preserves the casualty route", () => {
  const lineage = foreignLineage();
  const result = correctedEvidence(lineage);
  assert.equal(result.qualifying, true);
  assert.equal(result.state, LINEAGE_STATES.CORRECTION_REQUIRED);
  assert.equal(result.unlockGranted, false);
  assert.equal(result.startingPowerGranted, false);

  const canonical = canonizeMartyrsWinch(lineage, result);
  assert.equal(canonical.state, LINEAGE_STATES.CANONICAL);
  assert.equal(canonical.generations.length, 3);
  assert.equal(canonical.unlockPoolEligible, false);
  assert.equal(canonical.phaseFour.immediateProfitDenied, true);
  assert.equal(canonical.phaseFour.ancestorItemReturned, false);
  assert.equal(canonical.phaseFour.startingPowerGranted, false);
  assert.deepEqual(canonical.possibilityPool, [MARTYRS_WINCH_CANONICAL_POSSIBILITY]);
  assert.equal(
    canonical.judgmentReceipts.at(-1).progressionMutation,
    "campaign-possibility-pool-only",
  );
});

test("agreeing with the profitable command or losing the route cannot counterfeit correction", () => {
  const lineage = foreignLineage();
  const obeyed = correctedEvidence(lineage, {
    successorPriority: "recover-captured-gun",
    playerCommandRedirected: false,
    immediateProfitDenied: false,
  });
  assert.equal(obeyed.qualifying, false);
  assert.ok(obeyed.failedRails.includes("real_conflict"));
  assert.ok(obeyed.failedRails.includes("command_redirected"));
  assert.throws(() => canonizeMartyrsWinch(lineage, obeyed));

  const failedRescue = correctedEvidence(lineage, {
    casualtyRoutePreserved: false,
    survivorsRecovered: 0,
  });
  assert.equal(failedRescue.qualifying, false);
  assert.ok(failedRescue.failedRails.includes("humane_route_preserved"));
});
