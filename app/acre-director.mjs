// @ts-check

/**
 * @typedef {"breach" | "cross" | "consolidate" | "graft"} MacroPhase
 * @typedef {"hull_failure" | "war_party_ruin"} LossCause
 * @typedef {{
 *   status: "running" | "lost";
 *   phase: MacroPhase;
 *   activeAcre: number;
 *   capturedAcres: number;
 *   resolvedOffers: number;
 *   pendingOfferAcre: number | null;
 *   nextSectorLive: boolean;
 *   lastProgressAt: number;
 *   lossCause: LossCause | null;
 * }} AcreDirector
 */

/** @returns {AcreDirector} */
export function createAcreDirector() {
  return {
    status: "running",
    phase: "breach",
    activeAcre: 1,
    capturedAcres: 0,
    resolvedOffers: 0,
    pendingOfferAcre: null,
    nextSectorLive: true,
    lastProgressAt: 0,
    lossCause: null,
  };
}

/**
 * @param {AcreDirector} director
 * @param {MacroPhase} phase
 * @param {number} now
 */
export function setDirectorPhase(director, phase, now) {
  if (director.status !== "running" || director.phase === phase) return false;
  if (director.phase === "graft") return false;
  director.phase = phase;
  director.lastProgressAt = now;
  return true;
}

/**
 * Capture exactly one new acre and resume the advance. Acre captures used to
 * mint a second, independent graft offer; that doubled progression cadence and
 * could stack an acre menu directly in front of a nutrient menu. Grafts now
 * belong exclusively to the spendable nutrient bar.
 * @param {AcreDirector} director
 * @param {number} acre
 * @param {number} now
 */
export function captureAcre(director, acre, now) {
  if (
    director.status !== "running" ||
    director.pendingOfferAcre !== null ||
    acre !== director.capturedAcres + 1
  ) {
    return false;
  }
  director.capturedAcres = acre;
  director.activeAcre = acre + 1;
  director.pendingOfferAcre = null;
  director.nextSectorLive = true;
  director.phase = "breach";
  director.lastProgressAt = now;
  return true;
}

/**
 * Resolve the offer owned by this acre exactly once.
 * @param {AcreDirector} director
 * @param {number} acre
 * @param {number} now
 */
export function resolveOffer(director, acre, now) {
  void director;
  void acre;
  void now;
  return false;
}

/**
 * @param {AcreDirector} director
 * @param {LossCause} cause
 * @param {number} now
 */
export function loseRun(director, cause, now) {
  if (director.status !== "running") return false;
  director.status = "lost";
  director.lossCause = cause;
  director.lastProgressAt = now;
  return true;
}

/**
 * @param {AcreDirector} director
 */
export function pendingOfferCount(director) {
  return director.pendingOfferAcre === null ? 0 : 1;
}

/**
 * @param {{
 *   phase: MacroPhase;
 *   connected: boolean;
 *   cohesion: number;
 *   formationX: number;
 *   formationZ: number;
 *   formationWidth: number;
 *   nodeX: number;
 *   nodeZ: number;
 *   wire: {gapCenter: number; gapWidth: number} | null;
 *   breachClearance: number;
 *   heavyThreats: number;
 *   localInfantry: number;
 * }} input
 */
export function getCaptureBlockers(input) {
  /** @type {string[]} */
  const blockers = [];
  if (!input.connected) blockers.push("CORRIDOR SEVERED");
  if (input.cohesion < 20) blockers.push("COHESION");
  if (input.wire) {
    const requiredWidth = input.formationWidth + input.breachClearance;
    const aligned =
      Math.abs(input.wire.gapCenter - input.formationX) <=
      Math.max(0, (input.wire.gapWidth - input.formationWidth) * 0.5);
    if (input.wire.gapWidth < requiredWidth || !aligned) {
      blockers.push(`BARBERED WIRE ${Math.ceil(requiredWidth)}m`);
    }
  }
  if (input.heavyThreats > 0) {
    blockers.push(
      `${input.heavyThreats} HARDPOINT${input.heavyThreats === 1 ? "" : "S"}`,
    );
  }
  if (input.localInfantry > 4) {
    blockers.push(`${input.localInfantry - 4} INFANTRY IN TRENCH`);
  }
  if (input.formationZ < input.nodeZ) {
    blockers.push(`${Math.ceil(input.nodeZ - input.formationZ)}m TO LINE`);
  }
  if (Math.abs(input.formationX - input.nodeX) >= input.formationWidth) {
    blockers.push("FORMATION OFF LINE");
  }
  return blockers;
}
