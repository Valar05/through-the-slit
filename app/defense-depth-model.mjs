// @ts-check

export {
  DEFENSE_SECTOR_FAMILIES,
  defenseSectorFamily,
  defenseSectorPlan,
} from "./terrain-sector-plan.mjs";

/** @param {{consolidationStartedAt:number|null;counterattackSpawned:boolean;counterattackBroken:boolean;counterattackBrokenAt?:number|null;captured:boolean}} node */
export function beginConsolidation(node, now) {
  if (node.captured || node.consolidationStartedAt !== null) return false;
  node.consolidationStartedAt = now;
  return true;
}

/**
 * @param {{consolidationStartedAt:number|null;counterattackSpawned:boolean;counterattackBroken:boolean;counterattackBrokenAt?:number|null;captured:boolean;holdSeconds:number}} node
 * @param {number} now
 */
export function consolidationState(node, now) {
  if (node.captured) return { stage: "captured", elapsed: node.holdSeconds, remaining: 0 };
  if (node.consolidationStartedAt === null) {
    return { stage: "unstarted", elapsed: 0, remaining: node.holdSeconds };
  }
  const elapsed = Math.max(0, now - node.consolidationStartedAt);
  if (!node.counterattackSpawned && elapsed >= 1.4) {
    return { stage: "summon-counterattack", elapsed, remaining: node.holdSeconds };
  }
  if (node.counterattackSpawned && !node.counterattackBroken) {
    return { stage: "counterattack", elapsed, remaining: node.holdSeconds };
  }
  const securedElapsed = Math.max(0, now - (node.counterattackBrokenAt ?? now));
  return {
    stage: securedElapsed >= node.holdSeconds ? "secured" : "holding",
    elapsed,
    remaining: Math.max(0, node.holdSeconds - securedElapsed),
  };
}

/** @param {string} family */
export function counterattackComposition(family) {
  if (family === "trench-junction-redoubt") return { assault: 5, engineers: 1, carrier: 1 };
  if (family === "reverse-slope-battery") return { assault: 3, engineers: 1, carrier: 1 };
  return { assault: 4, engineers: 1, carrier: 0 };
}

/** @param {any} plan */
export function counterattackUnits(plan) {
  const composition = counterattackComposition(plan.family);
  const units = [];
  for (let index = 0; index < composition.assault; index += 1) units.push({
    kind: "reserve-assault", x: plan.reserveEntry.x + (index - (composition.assault - 1) * 0.5) * 22,
    z: plan.reserveEntry.z + (index % 2) * 14, delay: 0.8 + index * 0.17,
  });
  if (composition.engineers) units.push({
    kind: "engineer", x: plan.reserveEntry.x + 38, z: plan.reserveEntry.z + 22, delay: 1.5,
  });
  if (composition.carrier) units.push({
    kind: "carrier", x: plan.reserveEntry.x - 46, z: plan.reserveEntry.z + 34, delay: 1.2,
  });
  return units;
}

/**
 * @param {any} defender
 * @param {{dt:number;distance:number;tank:{x:number;z:number};formation:{x:number;z:number};profile:any;plan:any}} state
 */
export function stepDefenderDoctrine(defender, state) {
  const { dt, distance, tank, formation, profile, plan } = state;
  if (defender.kind === "engineer") {
    const angle = Math.atan2(plan.occupation.z - defender.z, plan.occupation.x - defender.x);
    if (Math.hypot(plan.occupation.x - defender.x, plan.occupation.z - defender.z) > 46) {
      defender.x += Math.cos(angle) * 24 * dt;
      defender.z += Math.sin(angle) * 24 * dt;
    }
    return "engineer";
  }
  if (defender.kind === "reserve-assault") {
    const angle = Math.atan2(formation.z - defender.z, formation.x - defender.x);
    if (Math.hypot(formation.x - defender.x, formation.z - defender.z) > 190) {
      defender.x += Math.cos(angle) * 30 * dt;
      defender.z += Math.sin(angle) * 30 * dt;
    }
  }
  if (defender.kind === "observer" && (distance < 270 || defender.suppression > 38)) {
    const escapeX = Math.max(-386, Math.min(386, plan.observer.x + (defender.id % 2 === 0 ? -96 : 96)));
    defender.x += Math.sign(escapeX - defender.x) * 18 * dt;
    defender.z += Math.sign(profile.reserveZ - defender.z) * 8 * dt;
  }
  if (
    defender.kind === "machine-gun" && tank.z > profile.centerZ - 18 &&
    defender.z < profile.supportZ - 16 && distance < 300
  ) {
    const withdrawalX = Math.max(-360, Math.min(360, defender.x * 0.6));
    const angle = Math.atan2(profile.supportZ - defender.z, withdrawalX - defender.x);
    defender.x += Math.cos(angle) * 17 * dt;
    defender.z += Math.sin(angle) * 17 * dt;
    defender.fireClock = Math.max(defender.fireClock, 0.34);
    return "withdraw";
  }
  return "fight";
}

/** @param {any} node @param {number} now @param {boolean} blockersClear @param {boolean} counterattackAlive */
export function updateSectorControl(node, now, blockersClear, counterattackAlive) {
  if (blockersClear) beginConsolidation(node, now);
  let state = consolidationState(node, now);
  const spawn = state.stage === "summon-counterattack";
  if (spawn) node.counterattackSpawned = true;
  if (counterattackAlive) node.counterattackSpawned = true;
  if (!spawn && node.counterattackSpawned && !counterattackAlive && !node.counterattackBroken) {
    node.counterattackBroken = true;
    node.counterattackBrokenAt = now;
  }
  state = consolidationState(node, now);
  return { spawn, state, secured: blockersClear && state.stage === "secured" };
}

/** @param {string} kind */
export function defenderLabel(kind) {
  return ({
    infantry: "ENEMY INFANTRY", "machine-gun": "MG NEST", observer: "ARTILLERY OBSERVER",
    flanker: "FLANKING GUN", "anti-armor": "AP GUN", carrier: "ASSAULT CARRIER",
    satchel: "SATCHEL PAIR", "reserve-assault": "RESERVE ASSAULT", engineer: "TRENCH TENDER",
  })[kind] ?? "DEFENDER";
}

/** @param {string} kind @param {number} sector */
export function defenderStats(kind, sector) {
  const growth = 1 + Math.min(0.7, sector * 0.035);
  const table = {
    infantry: [18, 1.05], "machine-gun": [52, Math.max(0.22, 0.42 - sector * 0.004)],
    observer: [40, Math.max(1.9, 2.9 - sector * 0.025)],
    flanker: [82, Math.max(1.18, 1.85 - sector * 0.018)],
    "anti-armor": [116, Math.max(1.72, 2.5 - sector * 0.02)],
    carrier: [148, Math.max(1.1, 2.1 - sector * 0.018)],
    "reserve-assault": [28, Math.max(0.72, 1.18 - sector * 0.012)], engineer: [46, 2.8],
    satchel: [34, Math.max(3.8, 6.2 - sector * 0.04)],
  };
  const stats = table[kind] ?? table.infantry;
  return { hp: stats[0] * growth, cooldown: stats[1] };
}

/** @param {any} engineer @param {any[]} defenders */
export function tendDefensiveLine(engineer, defenders) {
  for (const ally of defenders) {
    if (!ally.alive || ally.sector !== engineer.sector || Math.hypot(ally.x - engineer.x, ally.z - engineer.z) > 150) continue;
    ally.suppression = Math.max(0, ally.suppression - 22);
    ally.fireClock = Math.min(ally.fireClock, ally.cooldown * 0.55);
  }
}

/** @param {string|undefined} kind */
export function isHumanScaleDefender(kind) {
  return kind === "observer" || kind === "infantry" || kind === "satchel" ||
    kind === "reserve-assault" || kind === "engineer";
}

/** @param {string} kind */
export function terrainDecorationVisual(kind) {
  if (kind === "dugout-mouth") return { cell: 8, height: 48 };
  if (kind === "battery-emplacement") return { cell: 0, height: 52 };
  if (kind === "junction-revetment") return { cell: 1, height: 52 };
  if (kind === "road-cut-marker") return { cell: 7, height: 42 };
  return { cell: 9, height: 42 };
}
/**
 * A full-screen organ choice cannot steal the perceptual beat of its earning
 * kill or an incoming artillery warning.
 * The first three choices are the opening barrage. Once earned, they cut
 * through caption and explosion congestion so a violent start cannot defer
 * the player's entire build until after death. Incoming artillery still owns
 * the screen because pausing during its warning would be actively dishonest.
 * @param {{captionClock:number, nutrientLevel?:number, artillery:{stage:string}|null, explosions:Array<{kind:string,intensity:number,age:number,life:number}>}} runtime
 */
export function canPresentGraftOffer(runtime) {
  if (runtime.artillery?.stage === "incoming") return false;
  if ((runtime.nutrientLevel ?? Number.POSITIVE_INFINITY) < 3) return true;
  return runtime.captionClock <= 0 &&
    !runtime.explosions.some((blast) =>
      blast.kind !== "toxic" &&
      blast.intensity >= 2.4 &&
      blast.age < blast.life * 0.72
    );
}

export function tacticalExplosionRadiusCap(width, height, kind) {
  return Math.max(28, Math.min(width * 0.26, height * (kind === "artillery" ? 0.27 : 0.22)));
}
