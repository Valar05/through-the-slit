// @ts-check

export const LINEAGE_SCHEMA_VERSION = 1;

export const LINEAGE_STATES = Object.freeze({
  OBSERVED: "Observed",
  SUBMITTED: "Submitted",
  FOREIGN_EXPRESSION: "Foreign Expression",
  CORRECTION_REQUIRED: "Correction Required",
  CANONICAL: "Canonical",
  REJECTED: "Rejected",
  COUNTERFEIT: "Counterfeit",
  CONTAINED: "Contained",
  DORMANT: "Dormant",
});

export const MARTYRS_WINCH = Object.freeze({
  lineageId: "martyrs-winch",
  traitId: "trait.martyrs-winch.rescue-jurisdiction",
  ancestorExpressionId: "expression.martyrs-winch.landship",
  foreignExpressionId: "expression.martyrs-winch.sapper-brood",
  correctionExpressionId: "expression.martyrs-winch.sapper-brood-correction",
  doctrineId: "doctrine.martyrs-winch.preserve-formation",
  vesselId: "vessel.landship.original",
  foreignVesselId: "vessel.sapper-brood.collective",
});

export const MARTYRS_WINCH_CANONICAL_POSSIBILITY = Object.freeze({
  possibilityId: "possibility.martyrs-winch.coalition-rescue-jurisdiction",
  lineageId: MARTYRS_WINCH.lineageId,
  responsibility: MARTYRS_WINCH.traitId,
  distribution: "future-authored-campaign-contexts",
  guaranteedStartingItem: false,
  guaranteedStartingPower: false,
  eligibleVessels: [
    "vessel.sapper-brood.collective",
    "vessel.formation.casualty-route",
    "vessel.logistics.recovery-organism",
  ],
});

export const FOREIGN_EXPRESSION_STAGES = Object.freeze({
  DORMANT: "dormant",
  ROTATE: "rotate",
  BRACE: "brace",
  CONTACT: "contact",
  STRAIN: "strain",
  SUCCESS: "success",
  OVERLOAD: "overload",
  SEVERED: "severed",
  CASUALTY: "casualty",
});

export const JUDGMENT_RAILS = Object.freeze([
  "useful_trait",
  "durable_transfer",
  "hybridization",
  "humane_context",
  "vessel_release",
  "absolute_containment",
]);

export const JUDGMENT_DECISIONS = Object.freeze({
  SUBMIT: "submit",
  DEFER: "defer",
  DESTROY: "destroy",
});

export const PERFECT_REPRODUCTION_OFFER = Object.freeze({
  offerId: "offer.martyrs-winch.perfect-reproduction.v1",
  verdict: LINEAGE_STATES.COUNTERFEIT,
  failedRail: "vessel_release",
  rejected: true,
  progressionMutation: "none",
  reason:
    "It preserves the landship's implementation and refuses to release the responsibility to another vessel.",
});

/**
 * Phase 1 evidence is intentionally about a battlefield event rather than an
 * equipped item. Repetition alone never qualifies: the rescue must include an
 * endangered ally, hostile pressure, real tactical cost, successful movement,
 * and a connected surviving formation.
 *
 * @param {{
 *   runId:string,
 *   eventId:string,
 *   elapsed:number,
 *   endangeredAsset:boolean,
 *   hostileContacts:number,
 *   exposedSeconds:number,
 *   armorDamage:number,
 *   organDamage:number,
 *   suppressionPeak:number,
 *   recoveredDistance:number,
 *   assetIntegrityAfter:number,
 *   formationConnectedAfter:boolean,
 *   formationCohesionAfter:number,
 *   priorQualifiedEvents?:number,
 * }} event
 */
export function evaluateMartyrsWinchDiscovery(event) {
  const requirements = {
    endangered_asset: Boolean(event.endangeredAsset),
    hostile_pressure:
      event.hostileContacts >= 1 && event.exposedSeconds >= 3,
    tactical_cost:
      event.armorDamage + event.organDamage > 0 || event.suppressionPeak >= 55,
    successful_recovery:
      event.recoveredDistance >= 70 && event.assetIntegrityAfter > 0,
    formation_preserved:
      event.formationConnectedAfter && event.formationCohesionAfter >= 20,
    not_repetition: (event.priorQualifiedEvents ?? 0) === 0,
  };
  const failedRails = Object.entries(requirements)
    .filter(([, passed]) => !passed)
    .map(([rail]) => rail);
  const qualifying = failedRails.length === 0;

  return {
    schemaVersion: LINEAGE_SCHEMA_VERSION,
    lineageId: MARTYRS_WINCH.lineageId,
    generation: 1,
    state: qualifying ? LINEAGE_STATES.OBSERVED : null,
    qualifying,
    failedRails,
    knowledgeRecorded: true,
    progressionGranted: qualifying,
    evidence: {
      runId: event.runId,
      eventId: event.eventId,
      elapsed: event.elapsed,
      capability: MARTYRS_WINCH.traitId,
      vessel: MARTYRS_WINCH.vesselId,
      expression: MARTYRS_WINCH.ancestorExpressionId,
      doctrine: MARTYRS_WINCH.doctrineId,
      cost: {
        armorDamage: event.armorDamage,
        organDamage: event.organDamage,
        suppressionPeak: event.suppressionPeak,
        exposedSeconds: event.exposedSeconds,
      },
      outcome: {
        recoveredDistance: event.recoveredDistance,
        assetIntegrityAfter: event.assetIntegrityAfter,
        formationConnectedAfter: event.formationConnectedAfter,
        formationCohesionAfter: event.formationCohesionAfter,
      },
    },
  };
}

/** @param {ReturnType<typeof evaluateMartyrsWinchDiscovery>} result */
export function createObservedLineage(result) {
  if (!result.qualifying || result.state !== LINEAGE_STATES.OBSERVED) {
    throw new Error("Only qualifying battlefield evidence can enter Observed state");
  }
  return {
    schemaVersion: LINEAGE_SCHEMA_VERSION,
    lineageId: result.lineageId,
    state: LINEAGE_STATES.OBSERVED,
    generations: [result.evidence],
    judgmentReceipts: [],
    unlockPoolEligible: false,
  };
}

/**
 * Phase 2 does not score Saint Mendel's rails. It names what the witnessed run
 * can establish, what remains unknown, and where the evidence is contested.
 * Transfer and hybridization cannot be inferred from a first-generation rescue.
 *
 * @param {ReturnType<typeof createObservedLineage>} lineage
 */
export function evaluateMendelRails(lineage) {
  if (lineage.state !== LINEAGE_STATES.OBSERVED || !lineage.generations[0]) {
    throw new Error("Mendel judgment requires one Observed generation");
  }
  const evidence = lineage.generations[0];
  const cost = evidence.cost;
  const outcome = evidence.outcome;

  return [
    {
      rail: "useful_trait",
      status: "evidenced",
      finding: "A vulnerable allied body was recovered alive under hostile pressure.",
      evidence: `${Math.round(outcome.recoveredDistance)}m recovered · ${Math.round(outcome.assetIntegrityAfter)}% integrity remained`,
    },
    {
      rail: "durable_transfer",
      status: "unknown",
      finding: "No unlike vessel has carried this responsibility.",
      evidence: "One generation exists. Transfer remains untested.",
    },
    {
      rail: "hybridization",
      status: "unknown",
      finding: "No crossing has been attempted.",
      evidence: "The observed graft may reveal a trait; the graft itself is not hereditary.",
    },
    {
      rail: "humane_context",
      status: "evidenced",
      finding: "The rescue preserved a living formation rather than optimizing the weapon alone.",
      evidence: `${Math.round(outcome.formationCohesionAfter)}% cohesion · formation remained connected`,
    },
    {
      rail: "vessel_release",
      status: "contested",
      finding: "The lesson has only been witnessed in the landship that produced it.",
      evidence: "Perfect reproduction would fail this rail. Submission releases the claim for foreign expression.",
    },
    {
      rail: "absolute_containment",
      status: "contested",
      finding: "The rescue jurisdiction is humane; the mechanism can still be counterfeited.",
      evidence: `${Math.round(cost.exposedSeconds)}s exposed · ${Math.round(cost.armorDamage + cost.organDamage)} damage borne · misuse remains unresolved`,
    },
  ];
}

/**
 * @param {ReturnType<typeof createObservedLineage>} lineage
 * @param {"submit"|"defer"|"destroy"} decision
 */
export function judgeObservedLineage(lineage, decision) {
  if (lineage.state !== LINEAGE_STATES.OBSERVED) {
    throw new Error("Only an Observed lineage may receive first judgment");
  }
  if (!Object.values(JUDGMENT_DECISIONS).includes(decision)) {
    throw new Error("Unknown Mendel judgment decision");
  }

  const evidence = lineage.generations[0];
  const rails = evaluateMendelRails(lineage);
  const nextState =
    decision === JUDGMENT_DECISIONS.SUBMIT
      ? LINEAGE_STATES.SUBMITTED
      : decision === JUDGMENT_DECISIONS.DESTROY
        ? LINEAGE_STATES.CONTAINED
        : LINEAGE_STATES.OBSERVED;
  const verdict =
    decision === JUDGMENT_DECISIONS.SUBMIT
      ? "Perhaps. Return after three generations."
      : decision === JUDGMENT_DECISIONS.DESTROY
        ? "Contained by the hand that witnessed it. No inheritance authorized."
        : "Evidence retained. Custody withheld. Judgment deferred.";

  return {
    ...lineage,
    state: nextState,
    unlockPoolEligible: false,
    judgmentReceipts: [
      ...lineage.judgmentReceipts,
      {
        schemaVersion: LINEAGE_SCHEMA_VERSION,
        receiptId: `receipt.${lineage.lineageId}.${evidence.eventId}.${decision}.v1`,
        lineageId: lineage.lineageId,
        generation: 1,
        decision,
        previousState: lineage.state,
        state: nextState,
        verdict,
        rails,
        unknownRails: rails
          .filter((rail) => rail.status === "unknown")
          .map((rail) => rail.rail),
        contestedRails: rails
          .filter((rail) => rail.status === "contested")
          .map((rail) => rail.rail),
        progressionMutation: "none",
        unlockGranted: false,
      },
    ],
  };
}

/**
 * Phase 3 uses authored eligibility. Submission releases a responsibility for
 * examination; it does not equip the landship or guarantee an appearance.
 * The Sapper Brood may answer only where terrain and formation need make a
 * collective recovery tactically meaningful.
 *
 * @param {{
 *   lineage: ReturnType<typeof judgeObservedLineage>,
 *   terrainNeed: "breach-casualty-route"|"open-ground"|"sheltered",
 *   formationNeed: "endangered-asset"|"routine-advance"|"weapon-profit",
 *   campaignContext: "later-breach"|"same-run"|"sanctuary",
 * }} context
 */
export function selectMartyrsWinchForeignExpression(context) {
  const eligible =
    context.lineage?.lineageId === MARTYRS_WINCH.lineageId &&
    context.lineage?.state === LINEAGE_STATES.SUBMITTED &&
    context.lineage?.generations?.length === 1 &&
    context.terrainNeed === "breach-casualty-route" &&
    context.formationNeed === "endangered-asset" &&
    context.campaignContext === "later-breach";

  return {
    eligible,
    lineageId: MARTYRS_WINCH.lineageId,
    generation: 2,
    vessel: MARTYRS_WINCH.foreignVesselId,
    expression: MARTYRS_WINCH.foreignExpressionId,
    ancestorItemRequired: false,
    playerControl: "autonomous-humane-jurisdiction",
    tacticalCost: "four-bodies-withhold-fire-and-brace-under-pressure",
    failureModes: ["overload", "severed", "casualty"],
    progressionGranted: false,
  };
}

/**
 * @param {{
 *   runId:string,
 *   eventId:string,
 *   elapsed:number,
 *   lineageState:string,
 *   vessel:string,
 *   expression:string,
 *   organismsCommitted:number,
 *   fireSupportWithheldSeconds:number,
 *   terrainAnchors:number,
 *   hostileContacts:number,
 *   movedDistance:number,
 *   assetIntegrityAfter:number,
 *   formationCohesionAfter:number,
 *   responsibilityPreserved:boolean,
 *   outcome:"success"|"overload"|"severed"|"casualty",
 * }} event
 */
export function evaluateMartyrsWinchForeignExpression(event) {
  const requirements = {
    submitted_ancestor: event.lineageState === LINEAGE_STATES.SUBMITTED,
    foreign_vessel:
      event.vessel === MARTYRS_WINCH.foreignVesselId &&
      event.vessel !== MARTYRS_WINCH.vesselId,
    authored_expression: event.expression === MARTYRS_WINCH.foreignExpressionId,
    collective_cost:
      event.organismsCommitted >= 3 &&
      event.fireSupportWithheldSeconds >= 2 &&
      event.hostileContacts >= 1,
    grounded_contact: event.terrainAnchors >= 3,
    useful_transfer:
      event.outcome === "success" &&
      event.movedDistance >= 60 &&
      event.assetIntegrityAfter > 0,
    responsibility_preserved:
      event.responsibilityPreserved && event.formationCohesionAfter > 0,
  };
  const failedRails = Object.entries(requirements)
    .filter(([, passed]) => !passed)
    .map(([rail]) => rail);
  const qualifying = failedRails.length === 0;

  return {
    schemaVersion: LINEAGE_SCHEMA_VERSION,
    lineageId: MARTYRS_WINCH.lineageId,
    generation: 2,
    state: qualifying ? LINEAGE_STATES.FOREIGN_EXPRESSION : null,
    qualifying,
    failedRails,
    knowledgeRecorded: true,
    progressionGranted: qualifying,
    unlockGranted: false,
    evidence: {
      runId: event.runId,
      eventId: event.eventId,
      elapsed: event.elapsed,
      vessel: event.vessel,
      expression: event.expression,
      doctrine: MARTYRS_WINCH.doctrineId,
      responsibility: MARTYRS_WINCH.traitId,
      cost: {
        organismsCommitted: event.organismsCommitted,
        fireSupportWithheldSeconds: event.fireSupportWithheldSeconds,
        terrainAnchors: event.terrainAnchors,
        hostileContacts: event.hostileContacts,
      },
      outcome: {
        kind: event.outcome,
        movedDistance: event.movedDistance,
        assetIntegrityAfter: event.assetIntegrityAfter,
        formationCohesionAfter: event.formationCohesionAfter,
        responsibilityPreserved: event.responsibilityPreserved,
      },
    },
  };
}

/**
 * @param {ReturnType<typeof judgeObservedLineage>} lineage
 * @param {ReturnType<typeof evaluateMartyrsWinchForeignExpression>} result
 */
export function recordMartyrsWinchForeignExpression(lineage, result) {
  if (
    lineage.state !== LINEAGE_STATES.SUBMITTED ||
    !result.qualifying ||
    result.state !== LINEAGE_STATES.FOREIGN_EXPRESSION
  ) {
    throw new Error("Only qualifying foreign-vessel evidence may advance generation two");
  }
  return {
    ...lineage,
    state: LINEAGE_STATES.FOREIGN_EXPRESSION,
    generations: [...lineage.generations, result.evidence],
    unlockPoolEligible: false,
    phaseThree: {
      responsibilitySurvivedTransfer: true,
      ancestorItemReturned: false,
      correctionRequired: true,
      canonical: false,
    },
  };
}

/**
 * Phase 4 is a conflict, not a third successful pull. The landship requests a
 * captured gun because it is immediately profitable. The brood must visibly
 * redirect that command toward the endangered casualty route, preserve the
 * rescue responsibility, remain tactically useful after refusing, and pay a
 * real battlefield cost.
 *
 * @param {{
 *   lineageState:string,
 *   runId:string,
 *   eventId:string,
 *   elapsed:number,
 *   playerPriority:"recover-captured-gun"|"clear-casualty-route",
 *   successorPriority:"clear-casualty-route"|"recover-captured-gun",
 *   playerCommandRedirected:boolean,
 *   immediateProfitDenied:boolean,
 *   endangeredFormation:boolean,
 *   casualtyRoutePreserved:boolean,
 *   survivorsRecovered:number,
 *   organismsCommitted:number,
 *   fireSupportWithheldSeconds:number,
 *   hostileContacts:number,
 *   formationCohesionAfter:number,
 *   capabilityUsefulAfterRefusal:boolean,
 * }} event
 */
export function evaluateMartyrsWinchCorrection(event) {
  const requirements = {
    foreign_generation_complete:
      event.lineageState === LINEAGE_STATES.FOREIGN_EXPRESSION,
    real_conflict:
      event.playerPriority === "recover-captured-gun" &&
      event.successorPriority === "clear-casualty-route" &&
      event.endangeredFormation,
    command_redirected:
      event.playerCommandRedirected && event.immediateProfitDenied,
    humane_route_preserved:
      event.casualtyRoutePreserved && event.survivorsRecovered >= 2,
    tactical_cost:
      event.organismsCommitted >= 3 &&
      event.fireSupportWithheldSeconds >= 2 &&
      event.hostileContacts >= 1,
    useful_after_refusal:
      event.capabilityUsefulAfterRefusal && event.formationCohesionAfter > 0,
  };
  const failedRails = Object.entries(requirements)
    .filter(([, passed]) => !passed)
    .map(([rail]) => rail);
  const qualifying = failedRails.length === 0;

  return {
    schemaVersion: LINEAGE_SCHEMA_VERSION,
    lineageId: MARTYRS_WINCH.lineageId,
    generation: 3,
    state: qualifying ? LINEAGE_STATES.CORRECTION_REQUIRED : null,
    qualifying,
    failedRails,
    knowledgeRecorded: true,
    unlockGranted: false,
    startingPowerGranted: false,
    evidence: {
      runId: event.runId,
      eventId: event.eventId,
      elapsed: event.elapsed,
      vessel: MARTYRS_WINCH.foreignVesselId,
      expression: MARTYRS_WINCH.correctionExpressionId,
      doctrine: MARTYRS_WINCH.doctrineId,
      conflict: {
        playerPriority: event.playerPriority,
        successorPriority: event.successorPriority,
        playerCommandRedirected: event.playerCommandRedirected,
        immediateProfitDenied: event.immediateProfitDenied,
      },
      cost: {
        organismsCommitted: event.organismsCommitted,
        fireSupportWithheldSeconds: event.fireSupportWithheldSeconds,
        hostileContacts: event.hostileContacts,
      },
      outcome: {
        casualtyRoutePreserved: event.casualtyRoutePreserved,
        survivorsRecovered: event.survivorsRecovered,
        formationCohesionAfter: event.formationCohesionAfter,
        capabilityUsefulAfterRefusal: event.capabilityUsefulAfterRefusal,
      },
    },
  };
}

/**
 * Canonization changes only future campaign possibility. It never reinstalls
 * the ancestor winch, adds a starting stat, or guarantees an appearance.
 *
 * @param {ReturnType<typeof recordMartyrsWinchForeignExpression>} lineage
 * @param {ReturnType<typeof evaluateMartyrsWinchCorrection>} result
 */
export function canonizeMartyrsWinch(lineage, result) {
  if (
    lineage.state !== LINEAGE_STATES.FOREIGN_EXPRESSION ||
    lineage.generations?.length !== 2 ||
    !result.qualifying ||
    result.state !== LINEAGE_STATES.CORRECTION_REQUIRED
  ) {
    throw new Error("Canonization requires a real third-generation correction");
  }

  const receipt = {
    schemaVersion: LINEAGE_SCHEMA_VERSION,
    receiptId: `receipt.${lineage.lineageId}.${result.evidence.eventId}.canonical.v1`,
    lineageId: lineage.lineageId,
    generation: 3,
    decision: "canonical",
    previousState: lineage.state,
    state: LINEAGE_STATES.CANONICAL,
    verdict:
      "Canonical. The mechanism is released. The responsibility may return wherever the war party can bear it.",
    rails: JUDGMENT_RAILS.map((rail) => ({
      rail,
      status: "evidenced",
    })),
    progressionMutation: "campaign-possibility-pool-only",
    unlockGranted: false,
    startingPowerGranted: false,
    possibilityId: MARTYRS_WINCH_CANONICAL_POSSIBILITY.possibilityId,
  };

  return {
    ...lineage,
    state: LINEAGE_STATES.CANONICAL,
    generations: [...lineage.generations, result.evidence],
    judgmentReceipts: [...lineage.judgmentReceipts, receipt],
    unlockPoolEligible: false,
    possibilityPool: [MARTYRS_WINCH_CANONICAL_POSSIBILITY],
    phaseThree: {
      ...lineage.phaseThree,
      correctionRequired: false,
      canonical: true,
    },
    phaseFour: {
      playerCommandRedirected: true,
      immediateProfitDenied: true,
      casualtyRoutePreserved: true,
      ancestorItemReturned: false,
      startingPowerGranted: false,
    },
  };
}
