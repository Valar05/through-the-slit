// @ts-check

export const FORMATION_CONNECTION_DISTANCE = 340;
export const FORMATION_STRETCH_DISTANCE = 500;

/**
 * Distance weakens support, but it does not kill anyone. The war party only
 * becomes overrun when an enemy-controlled route combines with heavy
 * suppression. A recent ram wake turns separation into an active pursuit.
 * @param {{gap:number; cohesion:number; suppression:number; routeContested:boolean; breachWake:boolean}} state
 * @returns {"connected" | "stretched" | "separated" | "reconnecting" | "overrun"}
 */
export function formationStateFor(state) {
  if (state.routeContested && state.suppression >= 88) return "overrun";
  if (
    state.gap < FORMATION_CONNECTION_DISTANCE &&
    state.cohesion > 22
  ) {
    return "connected";
  }
  if (state.breachWake) return "reconnecting";
  if (state.gap < FORMATION_STRETCH_DISTANCE) return "stretched";
  return "separated";
}

/**
 * Enemy bodies do not multiply just to manufacture difficulty. Their shots
 * become somewhat more lethal as the landship penetrates deeper into prepared
 * lines, but terrain, echelon, and specialist mix carry most of the pressure.
 * The opening acre remains the readable lesson; depth six is 24% deadlier.
 * @param {number} baseDamage
 * @param {number} sector
 */
export function defenseDamageForSector(baseDamage, sector) {
  const depth = Math.max(0, Math.floor(sector));
  return baseDamage * (1 + Math.min(0.4, depth * 0.04));
}

/**
 * Prepared ground is read as successive echelons instead of one undifferentiated
 * damage cloud. The reserve stays part of the capture contract, so breaking the
 * front trench is a breach rather than ownership.
 * @param {number} z
 * @param {{centerZ:number;supportZ:number;reserveZ:number}} profile
 * @returns {"screen" | "main-line" | "support-line" | "reserve-line" | "consolidation"}
 */
export function defenseEchelonAt(z, profile) {
  if (z < profile.centerZ - 92) return "screen";
  if (z < profile.supportZ - 34) return "main-line";
  if (z < profile.reserveZ - 34) return "support-line";
  if (z < profile.reserveZ + 86) return "reserve-line";
  return "consolidation";
}

/**
 * Casualties require actual enemy control: machine-gun fire, a flanker, or
 * projectiles resolved by the battle simulation. Distance is never a damage
 * source. A fresh ram wake suppresses the blockers and gives the formation a
 * short recovery window without making it invulnerable.
 * @param {{connected?: boolean; activeMachineGun: boolean; activeFlanker: boolean; routeContested?: boolean; inBreachWake?: boolean; suppression: number}} state
 */
export function formationPressure(state) {
  const weaponsThreat = state.activeMachineGun || state.activeFlanker;
  const threatened = weaponsThreat || !!state.routeContested;
  let suppressionPerSecond = threatened
    ? 6.4 +
      (state.activeMachineGun ? 4 : 0) +
      (state.activeFlanker ? 4.2 : 0) +
      (state.routeContested ? 2.1 : 0)
    : -13;
  if (state.inBreachWake) suppressionPerSecond -= 9;
  const casualtyPerSecond =
    weaponsThreat && state.suppression > 42
      ? (state.suppression / 100) *
        (state.activeFlanker ? 2.15 : 1.1)
      : 0;
  return { suppressionPerSecond, casualtyPerSecond };
}
