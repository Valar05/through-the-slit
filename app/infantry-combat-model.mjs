// @ts-check

export const FRIENDLY_FORMATION_BODIES = 18;
export const FRIENDLY_FIRETEAM_SIZE = 3;

/**
 * The rendered war party and its rifles share one casualty ledger. A full
 * formation owns six fireteams; dead bodies cannot keep shooting off-screen.
 * Cohesion and heavy suppression can temporarily silence a team without
 * pretending that the missing rifles died.
 * @param {{casualties:number;cohesion:number;suppression:number}} formation
 */
export function activeFriendlyFireteams(formation) {
  const survivors = Math.max(
    0,
    Math.round(
      FRIENDLY_FORMATION_BODIES *
        (1 - Math.max(0, Math.min(100, formation.casualties)) / 100),
    ),
  );
  let teams = Math.min(
    FRIENDLY_FORMATION_BODIES / FRIENDLY_FIRETEAM_SIZE,
    Math.ceil(survivors / FRIENDLY_FIRETEAM_SIZE),
  );
  if (formation.cohesion < 42) teams -= 1;
  if (formation.suppression >= 68) teams -= 1;
  return Math.max(0, teams);
}

/** @param {{suppression:number;casualties:number}} formation */
export function friendlyVolleyCadence(formation) {
  return Math.min(
    1.15,
    0.56 +
      Math.max(0, formation.suppression) * 0.0042 +
      Math.max(0, formation.casualties) * 0.0018,
  );
}

/**
 * Exact terrain-aware rifle lane. Sampling is deliberately tighter than the
 * projectile frame step so a target is rejected before the formation commits
 * a volley to a parapet.
 * @param {{x:number,z:number}} source
 * @param {{x:number,z:number}} target
 * @param {(x:number,z:number)=>number} heightAt
 */
export function friendlyRifleLaneClear(source, target, heightAt) {
  return friendlyRifleObstruction(source, target, heightAt) === null;
}

/** @param {any} defender @param {{x:number,z:number}} formation @param {(x:number,z:number)=>number} heightAt */
export function machineGunControlsFormation(defender, formation, heightAt) {
  const relativeZ = defender.z - formation.z;
  return defender.kind === "machine-gun" && relativeZ < 330 && relativeZ > -60 &&
    !softTargetPinned(defender.kind, defender.suppression) &&
    friendlyRifleLaneClear(defender, formation, heightAt);
}

/**
 * @param {{x:number,z:number}} source
 * @param {{x:number,z:number}} target
 * @param {(x:number,z:number)=>number} heightAt
 */
export function friendlyRifleObstruction(source, target, heightAt) {
  const angle = Math.atan2(target.z - source.z, target.x - source.x);
  const start = {
    x: source.x + Math.cos(angle) * 9,
    z: source.z + Math.sin(angle) * 9,
  };
  const startElevation = heightAt(start.x, start.z) + 9;
  const targetElevation = heightAt(target.x, target.z) + 11;
  const distance = Math.hypot(target.x - start.x, target.z - start.z);
  const steps = Math.max(3, Math.ceil(distance / 5));
  for (let index = 1; index < steps; index += 1) {
    const amount = index / steps;
    const x = start.x + (target.x - start.x) * amount;
    const z = start.z + (target.z - start.z) * amount;
    const bulletHeight =
      startElevation + (targetElevation - startElevation) * amount;
    if (heightAt(x, z) >= bulletHeight - 0.25) return { x, z };
  }
  return null;
}

/** @type {Record<string, number>} */
const BASE_TARGET_PRIORITY = {
  satchel: 0,
  "reserve-assault": 8,
  engineer: 18,
  "machine-gun": 12,
  observer: 31,
  infantry: 24,
  flanker: 44,
  "anti-armor": 72,
  carrier: 84,
};

/**
 * Choose something a fireteam can actually shoot. Priority is tactical rather
 * than HP-shaped: committed satchels, MG crews, exposed infantry, and observers
 * come before armored hardware. Witness Cilia promotes observers without
 * granting magical sight through earth.
 * @param {{source:{x:number,z:number};defenders:Array<{id:number;kind:string;x:number;z:number;alive:boolean;intent?:number}>;heightAt:(x:number,z:number)=>number;range?:number;witnessCilia?:boolean;routeX?:number}} request
 */
export function chooseFriendlyRifleTarget(request) {
  const range = request.range ?? 900;
  let best = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const defender of request.defenders) {
    if (!defender.alive) continue;
    const relativeZ = defender.z - request.source.z;
    if (relativeZ < -34) continue;
    const distance = Math.hypot(
      defender.x - request.source.x,
      defender.z - request.source.z,
    );
    if (distance > range) continue;
    if (!friendlyRifleLaneClear(request.source, defender, request.heightAt)) {
      continue;
    }
    let priority = BASE_TARGET_PRIORITY[defender.kind] ?? 90;
    if (defender.kind === "observer" && request.witnessCilia) priority = 7;
    if (defender.kind === "satchel" && (defender.intent ?? 0) <= 0) priority += 14;
    const routeDistance = Math.abs(
      defender.x - (request.routeX ?? request.source.x),
    );
    const score = priority + distance / 90 + routeDistance / 180;
    if (score >= bestScore) continue;
    best = defender;
    bestScore = score;
  }
  return best;
}

/**
 * Search a bounded fireteam fan for the nearest position that can actually
 * express rifle fire. This is maneuver, not magical sight: callers still have
 * to move the formation to the returned point before its individual teams
 * resolve shots.
 * @param {{source:{x:number,z:number};defenders:Array<any>;heightAt:(x:number,z:number)=>number;range?:number;witnessCilia?:boolean;routeX?:number}} request
 */
export function chooseFriendlyFiringPosition(request) {
  let best = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const forward of [0, 80, 160, 240]) {
    for (const lateral of [0, -96, 96, -192, 192]) {
      const source = { x: request.source.x + lateral, z: request.source.z + forward };
      const target = chooseFriendlyRifleTarget({ ...request, source });
      if (!target) continue;
      const score = Math.abs(lateral) * 0.6 + forward * 0.22 +
        Math.hypot(target.x - source.x, target.z - source.z) * 0.04;
      if (score >= bestScore) continue;
      best = { ...source, target };
      bestScore = score;
    }
  }
  return best;
}

/**
 * One fireteam may suppress a known soft hardpoint while the others pursue
 * clear shots. This is deliberate beaten-zone fire, not target acquisition
 * pretending the parapet is transparent.
 * @param {{source:{x:number,z:number};defenders:Array<{id:number;kind:string;x:number;z:number;alive:boolean;suppression?:number}>;heightAt:(x:number,z:number)=>number;range?:number}} request
 */
export function chooseFriendlySuppressionTarget(request) {
  const range = request.range ?? 900;
  return (
    request.defenders
      .filter((defender) => {
        if (!defender.alive) return false;
        if (defender.kind !== "machine-gun" && defender.kind !== "observer") {
          return false;
        }
        if ((defender.suppression ?? 0) >= 72) return false;
        const relativeZ = defender.z - request.source.z;
        if (!(
          relativeZ >= -34 &&
          Math.hypot(
            defender.x - request.source.x,
            defender.z - request.source.z,
          ) <= range
        )) return false;
        const obstruction = friendlyRifleObstruction(
          request.source,
          defender,
          request.heightAt,
        );
        return (
          obstruction !== null &&
          Math.hypot(
            defender.x - obstruction.x,
            defender.z - obstruction.z,
          ) <= 118
        );
      })
      .sort((a, b) => {
        const aPriority = a.kind === "machine-gun" ? 0 : 1;
        const bPriority = b.kind === "machine-gun" ? 0 : 1;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return (
          Math.hypot(a.x - request.source.x, a.z - request.source.z) -
          Math.hypot(b.x - request.source.x, b.z - request.source.z)
        );
      })[0] ?? null
  );
}

/** @param {string} kind */
export function friendlyRifleDamage(kind) {
  if (kind === "infantry" || kind === "satchel" || kind === "reserve-assault") return 8;
  if (kind === "engineer") return 7.2;
  if (kind === "machine-gun" || kind === "observer") return 7.2;
  if (kind === "flanker") return 3.6;
  if (kind === "anti-armor") return 1.4;
  if (kind === "carrier") return 0.9;
  return 4;
}

/** @param {string} kind @param {boolean} confirmedHit */
export function friendlySuppressionFor(kind, confirmedHit) {
  if (kind === "anti-armor" || kind === "carrier" || kind === "flanker") {
    return 0;
  }
  if (kind === "observer") return confirmedHit ? 24 : 8;
  if (kind === "machine-gun") return confirmedHit ? 20 : 16;
  return confirmedHit ? 16 : 6;
}

/** @param {string} kind @param {number} suppression */
export function softTargetPinned(kind, suppression) {
  return (
    (kind === "infantry" ||
      kind === "reserve-assault" ||
      kind === "engineer" ||
      kind === "machine-gun" ||
      kind === "observer" ||
      kind === "satchel") &&
    suppression >= 72
  );
}

/** @param {number} suppression */
export function suppressedFireCadenceMultiplier(suppression) {
  return 1 + Math.max(0, Math.min(72, suppression)) / 72;
}
