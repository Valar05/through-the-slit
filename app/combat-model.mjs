// @ts-check

/**
 * Compact AP is the main mouth's ordinary grammar. Its fifth-shot HE cycle
 * periodically mutates that same physical shot into a cluster-clearing event.
 * @param {"he" | "ap"} kind
 */
export function cannonProfile(kind) {
  if (kind === "he") {
    return {
      speed: 420,
      damage: 132,
      projectileRadius: 20,
      blastRadius: 148,
      cooldown: 0.9,
    };
  }
  return {
    speed: 560,
    damage: 96,
    projectileRadius: 6,
    blastRadius: 26,
    cooldown: 0.72,
  };
}

/** @param {number} heLevel */
export function heShotInterval(heLevel) {
  return heLevel > 0 ? 5 : Number.POSITIVE_INFINITY;
}

/**
 * @param {string} targetKind
 * @param {number} distance
 */
export function heBlastDamage(targetKind, distance) {
  const profile = cannonProfile("he");
  if (distance > profile.blastRadius) return 0;
  const falloff = Math.max(0.58, 1 - distance / profile.blastRadius);
  const resistance =
    targetKind === "anti-armor" || targetKind === "flanker"
      ? 0.16
      : targetKind === "carrier"
        ? 0.34
        : 1;
  return profile.damage * falloff * resistance;
}

/**
 * Swept projectile contact. A cannon shell is allowed to cross a target between
 * rendered frames without becoming a ghost round.
 * @param {{x:number,z:number}} previous
 * @param {{x:number,z:number}} current
 * @param {{x:number,z:number}} target
 * @param {number} radius
 */
export function projectileHitsTarget(previous, current, target, radius) {
  const dx = current.x - previous.x;
  const dz = current.z - previous.z;
  const lengthSq = dx * dx + dz * dz;
  const amount =
    lengthSq <= Number.EPSILON
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((target.x - previous.x) * dx + (target.z - previous.z) * dz) /
              lengthSq,
          ),
        );
  const nearestX = previous.x + dx * amount;
  const nearestZ = previous.z + dz * amount;
  const missX = target.x - nearestX;
  const missZ = target.z - nearestZ;
  return missX * missX + missZ * missZ <= radius * radius;
}

/** @param {string} kind */
export function isHeavyDefenseProjectile(kind) {
  return (
    kind === "anti-armor" ||
    kind === "flanker" ||
    kind === "artillery" ||
    kind === "satchel"
  );
}

/**
 * Small-arms chatter may throttle repeated cosmetic hull reactions, but it may
 * never cancel a heavy contact. A projectile which enters the hull always ends
 * there instead of lingering through the collider until an iframe expires.
 * @param {string} kind
 * @param {number} smallArmsImmunity
 * @returns {"resolve" | "consume"}
 */
export function defenseHullContactPolicy(kind, smallArmsImmunity) {
  if (isHeavyDefenseProjectile(kind)) return "resolve";
  return smallArmsImmunity > 0 ? "consume" : "resolve";
}

/**
 * Deterministic combat random stream. Visual shake deliberately does not use
 * this stream, so presentation cannot perturb the shot ledger.
 * @param {number} state
 */
export function nextCombatRandom(state) {
  const nextState = (Math.imul(state >>> 0, 1664525) + 1013904223) >>> 0;
  return { state: nextState, value: nextState / 0x100000000 };
}

/**
 * Compute the vertical component for a straight source-to-target projectile.
 * Horizontal heading and speed remain owned by the caller.
 * @param {{source:{x:number,z:number,elevation:number};target:{x:number,z:number,elevation:number};speed:number}} shot
 */
export function aimedVerticalVelocity(shot) {
  const distance = Math.hypot(
    shot.target.x - shot.source.x,
    shot.target.z - shot.source.z,
  );
  const travelTime = Math.max(0.05, distance / Math.max(1, shot.speed));
  return (shot.target.elevation - shot.source.elevation) / travelTime;
}

export const ARTILLERY_WARNING_SECONDS = 6.2;
export const ARTILLERY_BLAST_RADIUS = 176;
export const ARTILLERY_SALVO_SIZE = 8;
export const ARTILLERY_SALVO_CADENCE = 1.05;

/**
 * Pressure rises by battlefield time and ground taken, but stops at a readable
 * ceiling. The battery becomes more persistent, not secretly more accurate or
 * more damaging.
 * @param {number} elapsed
 * @param {number} capturedGround
 */
export function artilleryPressureAt(elapsed, capturedGround = 0) {
  return Math.min(
    8,
    Math.floor(Math.max(0, elapsed) / 70) +
      Math.floor(Math.max(0, capturedGround) / 2),
  );
}

/**
 * One battery owns one mission at a time: register, correct, fire for effect,
 * lift while the crews work, then begin again. Observed fire cycles faster;
 * registered map fire persists after the observer dies but carries more error.
 * @param {number} elapsed
 * @param {number} capturedGround
 * @param {boolean} observed
 */
export function artilleryMissionProfile(elapsed, capturedGround, observed) {
  const pressure = artilleryPressureAt(elapsed, capturedGround);
  return {
    pressure,
    warning: ARTILLERY_WARNING_SECONDS,
    salvoSize: Math.min(10, ARTILLERY_SALVO_SIZE + Math.floor(pressure / 4)),
    cadence: Math.max(0.86, ARTILLERY_SALVO_CADENCE - pressure * 0.024),
    batteryPause: Math.max(
      observed ? 11 : 15,
      (observed ? 20 : 27) - pressure * 1.05,
    ),
    dispersion: observed ? 1 : 1.55,
  };
}

/**
 * Ranging rounds deliberately bracket the registered point before fire for
 * effect. They are real shells, not warning particles, and use the same blast
 * contract as the rest of the mission.
 * @param {number} index
 * @param {number} angle
 * @param {boolean} observed
 */
export function artilleryRangingPoint(index, angle, observed) {
  const range = observed ? 92 : 128;
  const lateral = (index === 0 ? -0.48 : 0.32) * range;
  const forward = (index === 0 ? 1 : -0.52) * range;
  return {
    x: Math.cos(angle + Math.PI / 2) * lateral + Math.cos(angle) * forward,
    z: Math.sin(angle + Math.PI / 2) * lateral + Math.sin(angle) * forward,
  };
}

/**
 * Artillery leads only velocity the landship actually owns. The former fixed
 * 54m/150m offset guaranteed that a stationary target was marked outside the
 * damaging part of its own visible explosion.
 * @param {{x:number,z:number,angle:number,forwardVelocity:number}} tank
 */
export function artilleryMarkForTank(tank) {
  const lead = Math.max(
    -150,
    Math.min(150, tank.forwardVelocity * ARTILLERY_WARNING_SECONDS * 0.72),
  );
  return {
    x: tank.x + Math.cos(tank.angle) * lead,
    z: tank.z + Math.sin(tank.angle) * lead,
  };
}

/**
 * The rendered blast and the damaging blast are one promise. The outer ring
 * is a glancing armor event; the center is a full heavy impact.
 * @param {number} distance
 */
export function artilleryBlastDamage(distance) {
  if (distance >= ARTILLERY_BLAST_RADIUS) return 0;
  const normalized = Math.max(0, distance) / ARTILLERY_BLAST_RADIUS;
  return 72 * Math.max(0.24, 1 - normalized ** 1.45);
}

/**
 * A registered fire mission is a short walking salvo, not one decorative
 * particle. Offsets remain well inside the blast ring at a stationary mark,
 * while six seconds of warning gives a moving landship ample escape distance.
 * @param {number} index
 * @param {number} angle
 */
export function artillerySalvoPoint(index, angle, dispersion = 1) {
  const pattern = [
    [0, 0],
    [18, 12],
    [-24, 18],
    [34, -22],
    [-42, -18],
    [26, 38],
    [-16, -48],
    [8, 8],
  ];
  const [lateral, forward] = pattern[index % pattern.length];
  return {
    x:
      Math.cos(angle + Math.PI / 2) * lateral * dispersion +
      Math.cos(angle) * forward * dispersion,
    z:
      Math.sin(angle + Math.PI / 2) * lateral * dispersion +
      Math.sin(angle) * forward * dispersion,
  };
}

/**
 * Shared directional armor lookup for live shells and deterministic combat
 * contracts. A source at the exact tank center is treated as frontal rather
 * than becoming an accidental side hit through atan2(0, 0).
 * @param {{x:number,z:number,angle:number}} tank
 * @param {{x:number,z:number}} source
 * @returns {"front"|"left"|"right"|"rear"}
 */
export function armorFaceFromSource(tank, source) {
  const dx = source.x - tank.x;
  const dz = source.z - tank.z;
  if (Math.hypot(dx, dz) < 0.001) return "front";
  const sourceAngle = Math.atan2(dz, dx);
  let relative = ((sourceAngle - tank.angle + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (relative < -Math.PI) relative += Math.PI * 2;
  const forwardness = Math.cos(relative);
  if (forwardness > 0.55) return "front";
  if (forwardness < -0.55) return "rear";
  return Math.sin(relative) > 0 ? "left" : "right";
}

/**
 * Exact world-lattice line test used to accept an anti-armor firing lane before
 * the emplacement exists. Sampling at half the terrain grid step preserves the
 * same two-triangle surface while remaining cheap at sector generation time.
 * @param {{x:number,z:number}} source
 * @param {{x:number,z:number}} target
 * @param {(x:number,z:number)=>number} heightAt
 * @param {{muzzleHeight?:number,targetHeight?:number,muzzleDistance?:number,step?:number}} [options]
 */
export function aimedDefenseLaneClear(source, target, heightAt, options = {}) {
  const angle = Math.atan2(target.z - source.z, target.x - source.x);
  const muzzleDistance = options.muzzleDistance ?? 18;
  const start = {
    x: source.x + Math.cos(angle) * muzzleDistance,
    z: source.z + Math.sin(angle) * muzzleDistance,
  };
  const startElevation = heightAt(start.x, start.z) + (options.muzzleHeight ?? 13);
  const targetElevation = heightAt(target.x, target.z) + (options.targetHeight ?? 11);
  const distance = Math.hypot(target.x - start.x, target.z - start.z);
  const steps = Math.max(2, Math.ceil(distance / (options.step ?? 7.5)));
  for (let index = 1; index < steps; index += 1) {
    const amount = index / steps;
    const x = start.x + (target.x - start.x) * amount;
    const z = start.z + (target.z - start.z) * amount;
    const rayHeight =
      startElevation + (targetElevation - startElevation) * amount;
    if (heightAt(x, z) >= rayHeight - 0.35) return false;
  }
  return true;
}

/**
 * Keep a gun in the authored trench family while choosing the nearby firing
 * bay with the most real approach lanes. Pure noise placement was burying the
 * weapon behind its own parapet.
 * @param {{desiredX:number;sector:number;approachZ:number;trenchZAt:(x:number)=>number;heightAt:(x:number,z:number)=>number;fieldHalfWidth?:number}} request
 */
export function chooseAntiArmorEmplacement(request) {
  const offsetsX = [0, -36, 36, -72, 72, -108, 108, -144, 144];
  const offsetsZ = [-16, -8, -24, 0, 8, 16];
  const corridorX = [-180, 0, 180];
  const corridorZ = [
    request.approachZ,
    request.approachZ + 120,
    request.approachZ + 240,
  ];
  const halfWidth = request.fieldHalfWidth ?? 430;
  let best = null;
  for (const offsetX of offsetsX) {
    const x = Math.max(
      -halfWidth + 58,
      Math.min(halfWidth - 58, request.desiredX + offsetX),
    );
    for (const offsetZ of offsetsZ) {
      const z = request.trenchZAt(x) + offsetZ;
      let clearLanes = 0;
      for (const targetZ of corridorZ) {
        for (const targetX of corridorX) {
          if (
            aimedDefenseLaneClear(
              { x, z },
              { x: targetX, z: targetZ },
              request.heightAt,
            )
          ) {
            clearLanes += 1;
          }
        }
      }
      if (!best || clearLanes > best.clearLanes) {
        best = { x, z, clearLanes };
      }
    }
  }
  return best;
}

/**
 * Shared heavy-impact kernel used by live play and headless raycast runs.
 * @param {{face:"front"|"left"|"right"|"rear";armor:number;scar:number;core:number;leftTread:number;rightTread:number;damage:number}} state
 */
export function resolveHeavyArmorImpact(state) {
  const effective = state.damage * (1 + state.scar * 0.018);
  const penetration =
    state.face === "rear" ||
    state.face === "left" ||
    state.face === "right" ||
    state.scar >= 4.2 ||
    state.armor < effective * 1.25;
  const next = {
    armor: Math.max(
      0,
      state.armor - effective * (penetration ? 0.48 : 0.16),
    ),
    scar: Math.min(18, state.scar + 2.2),
    core: state.core,
    leftTread: state.leftTread,
    rightTread: state.rightTread,
  };
  if (!penetration) {
    return { outcome: "bounce", organ: null, effective, ...next };
  }
  const organDamage = effective * (state.face === "rear" ? 0.85 : 0.58);
  let organ = "core";
  if (state.face === "left") {
    next.leftTread = Math.max(0, state.leftTread - organDamage);
    organ = "leftTread";
  } else if (state.face === "right") {
    next.rightTread = Math.max(0, state.rightTread - organDamage);
    organ = "rightTread";
  } else if (state.face === "rear") {
    next.core = Math.max(0, state.core - organDamage);
  } else {
    next.core = Math.max(0, state.core - organDamage * 0.38);
  }
  return { outcome: "penetration", organ, effective, ...next };
}

/**
 * This is the one artillery-to-landship damage contract used by live play and
 * release simulations. A visible blast inside the radius always owns a heavy
 * armor result; an impact outside it owns terrain and cannot impersonate harm.
 * @param {{x:number,z:number,angle:number,armor:Record<string,number>,scars:Record<string,number>,core:number,leftTread:number,rightTread:number}} tank
 * @param {{x:number,z:number}} source
 */
export function resolveArtilleryImpact(tank, source) {
  const distance = Math.hypot(tank.x - source.x, tank.z - source.z);
  const damage = artilleryBlastDamage(distance);
  if (damage <= 0) {
    return { outcome: "terrain", face: null, organ: null, distance, damage };
  }
  const face = armorFaceFromSource(tank, source);
  return {
    face,
    distance,
    damage,
    ...resolveHeavyArmorImpact({
      face,
      armor: tank.armor[face],
      scar: tank.scars[face],
      core: tank.core,
      leftTread: tank.leftTread,
      rightTread: tank.rightTread,
      damage,
    }),
  };
}

/**
 * Resolve a body against the two unseen tread footprints. Forward and lateral
 * are measured in the landship's local space so steering determines contact.
 * @param {{x:number,z:number,angle:number,forwardVelocity:number}} tank
 * @param {{x:number,z:number}} target
 * @returns {"left" | "right" | null}
 */
export function treadContactSide(tank, target) {
  if (Math.abs(tank.forwardVelocity) < 12) return null;
  const dx = target.x - tank.x;
  const dz = target.z - tank.z;
  const forward = dx * Math.cos(tank.angle) + dz * Math.sin(tank.angle);
  const lateral = -dx * Math.sin(tank.angle) + dz * Math.cos(tank.angle);
  if (Math.abs(forward) > 58 || Math.abs(lateral) > 61) return null;
  return lateral > 0 ? "left" : "right";
}

/**
 * The battering sternum is a committed forward contact surface, not a larger
 * invisible tank collider. It exists only while both treads are carrying the
 * hull forward and grows laterally and longitudinally as new ribs are grafted.
 * @param {{x:number,z:number,angle:number,forwardVelocity:number}} tank
 * @param {{x:number,z:number}} target
 * @param {number} level
 */
export function sternumContact(tank, target, level) {
  if (level <= 0 || tank.forwardVelocity < 18) return false;
  const dx = target.x - tank.x;
  const dz = target.z - tank.z;
  const forward = dx * Math.cos(tank.angle) + dz * Math.sin(tank.angle);
  const lateral = -dx * Math.sin(tank.angle) + dz * Math.cos(tank.angle);
  return (
    forward >= 34 &&
    forward <= 68 + level * 12 &&
    Math.abs(lateral) <= 38 + level * 10
  );
}

/** @param {number} distance @param {number} level */
export function trenchquakeDamage(distance, level) {
  if (level <= 0) return 0;
  const radius = 82 + level * 18;
  if (distance >= radius) return 0;
  return Math.max(8, (34 + level * 12) * (1 - distance / radius));
}

/** @param {string} kind */
export function isCrushable(kind) {
  return (
    kind === "infantry" ||
    kind === "observer" ||
    kind === "satchel" ||
    kind === "machine-gun" ||
    kind === "flanker" ||
    kind === "anti-armor" ||
    kind === "carrier"
  );
}
