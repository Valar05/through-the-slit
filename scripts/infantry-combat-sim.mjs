import {
  aimedDefenseLaneClear,
  aimedVerticalVelocity,
  cannonProfile,
  nextCombatRandom,
  projectileHitsTarget,
} from "../app/combat-model.mjs";
import { formationPressure } from "../app/difficulty-model.mjs";
import {
  activeFriendlyFireteams,
  chooseFriendlyFiringPosition,
  chooseFriendlyRifleTarget,
  chooseFriendlySuppressionTarget,
  friendlyRifleDamage,
  friendlyRifleLaneClear,
  friendlySuppressionFor,
  friendlyVolleyCadence,
  softTargetPinned,
} from "../app/infantry-combat-model.mjs";
import {
  setTerrainSeed,
  terrainHeightAt,
  trenchFrontZAt,
} from "../app/terrain-model.mjs";

const SHOT_STEP = 4;
const DURATION = 60;

function openingDefenders() {
  const defenders = [
    unit(1, "machine-gun", -96, trenchFrontZAt(0, -96) - 8, 52),
    unit(2, "observer", 148, trenchFrontZAt(0, 148) + 9, 40),
    unit(3, "anti-armor", -184, trenchFrontZAt(0, -184) + 4, 116),
  ];
  const columns = 9;
  for (let index = 0; index < 12; index += 1) {
    const row = Math.floor(index / columns);
    const file = index % columns;
    const x = -325 + file * (650 / (columns - 1)) + (row % 2 === 0 ? -8 : 14);
    const z = trenchFrontZAt(0, x) + (row - 0.5) * 11;
    defenders.push(unit(4 + index, "infantry", x, z, 18));
  }
  return defenders;
}

function unit(id, kind, x, z, hp) {
  return {
    id,
    kind,
    x,
    z,
    hp,
    maxHp: hp,
    alive: true,
    intent: kind === "satchel" ? 1 : 0,
    suppression: 0,
  };
}

function exactShot({
  source,
  target,
  speed,
  spread,
  radius,
  randomValue,
  muzzleHeight,
  muzzleDistance = 9,
}) {
  const centerAngle = Math.atan2(target.z - source.z, target.x - source.x);
  const angle = centerAngle + (randomValue - 0.5) * spread;
  const muzzle = {
    x: source.x + Math.cos(angle) * muzzleDistance,
    z: source.z + Math.sin(angle) * muzzleDistance,
  };
  const sourceElevation = terrainHeightAt(muzzle.x, muzzle.z) + muzzleHeight;
  const targetElevation = terrainHeightAt(target.x, target.z) + 11;
  const targetDistance = Math.hypot(target.x - muzzle.x, target.z - muzzle.z);
  const verticalVelocity = aimedVerticalVelocity({
    source: { ...muzzle, elevation: sourceElevation },
    target: { ...target, elevation: targetElevation },
    speed,
  });
  let previous = { ...muzzle, elevation: sourceElevation };
  const travelDistance = targetDistance + radius + 32;
  for (let distance = SHOT_STEP; distance <= travelDistance; distance += SHOT_STEP) {
    const current = {
      x: muzzle.x + Math.cos(angle) * distance,
      z: muzzle.z + Math.sin(angle) * distance,
      elevation: sourceElevation + verticalVelocity * (distance / speed),
    };
    if (terrainHeightAt(current.x, current.z) >= current.elevation) {
      return {
        outcome:
          Math.hypot(current.x - target.x, current.z - target.z) <= 122
            ? "near-miss"
            : "terrain",
      };
    }
    if (projectileHitsTarget(previous, current, target, radius + 24)) {
      return { outcome: "hit" };
    }
    previous = current;
  }
  return { outcome: "miss" };
}

function fireteamSource(formation, team, teams) {
  const lateral = (team - (teams - 1) / 2) * 30;
  const forward = 14 + (team % 2) * 8;
  return { x: formation.x - lateral, z: formation.z + forward };
}

function terminalLedger() {
  return { fired: 0, terrain: 0, nearMiss: 0, hit: 0, miss: 0, kills: 0 };
}

function resolveDamage(target, damage, ledger) {
  target.hp -= damage;
  if (target.hp > 0 || !target.alive) return;
  target.alive = false;
  ledger.kills += 1;
}

function runScenario(seed, mode) {
  setTerrainSeed(seed);
  const defenders = openingDefenders();
  const formation = {
    x: 0,
    z: 0,
    casualties: 0,
    cohesion: 100,
    suppression: 0,
  };
  const infantry = terminalLedger();
  const tank = terminalLedger();
  let randomState = (seed * 2654435761) >>> 0;
  let infantryClock = 0;
  let tankClock = 0;
  let heCycle = 0;
  let peakSuppression = 0;
  let minimumFireteams = 6;

  const random = () => {
    const result = nextCombatRandom(randomState);
    randomState = result.state;
    return result.value;
  };

  for (let elapsed = 0; elapsed < DURATION; elapsed += 0.1) {
    for (const defender of defenders) {
      defender.suppression = Math.max(0, defender.suppression - 1.05);
    }

    if (mode.infantry) {
      const firingSolution = chooseFriendlyFiringPosition({
        source: { x: formation.x, z: formation.z + 14 },
        defenders,
        heightAt: terrainHeightAt,
        range: 980,
        routeX: 0,
      });
      const movementTarget = firingSolution?.target;
      const objectiveZ = movementTarget
        ? Math.min(330, Math.max(firingSolution.z, movementTarget.z - 92))
        : 330;
      if (firingSolution) {
        formation.x += Math.max(-3.4, Math.min(3.4, firingSolution.x - formation.x));
      }
      if (objectiveZ > formation.z && formation.suppression < 86) {
        formation.z += Math.min(
          objectiveZ - formation.z,
          3.8 * Math.max(0.24, 1 - formation.suppression / 125),
        );
      }
      infantryClock -= 0.1;
      const teams = activeFriendlyFireteams(formation);
      minimumFireteams = Math.min(minimumFireteams, teams);
      if (infantryClock <= 0 && formation.suppression < 92 && formation.cohesion > 12) {
        for (let team = 0; team < teams; team += 1) {
          const source = fireteamSource(formation, team, teams);
          const target =
            (team === 0
              ? chooseFriendlySuppressionTarget({
                  source,
                  defenders,
                  heightAt: terrainHeightAt,
                  range: 900,
                })
              : null) ??
            chooseFriendlyRifleTarget({
              source,
              defenders,
              heightAt: terrainHeightAt,
              range: 900,
              routeX: 0,
            });
          if (!target) continue;
          infantry.fired += 1;
          const result = exactShot({
            source,
            target,
            speed: 610,
            spread: 0.018,
            radius: 2.4,
            randomValue: random(),
            muzzleHeight: 9,
          });
          infantry[result.outcome === "near-miss" ? "nearMiss" : result.outcome] += 1;
          if (result.outcome === "hit") {
            target.suppression = Math.min(
              100,
              target.suppression + friendlySuppressionFor(target.kind, true),
            );
            resolveDamage(target, friendlyRifleDamage(target.kind), infantry);
          } else if (result.outcome === "near-miss") {
            target.suppression = Math.min(
              100,
              target.suppression + friendlySuppressionFor(target.kind, false),
            );
          }
        }
        infantryClock = friendlyVolleyCadence(formation);
      }
    }

    if (mode.tank) {
      tankClock -= 0.1;
      if (tankClock <= 0) {
        let firingSolution = null;
        for (const z of [330, 400, 470]) {
          for (const x of [0, -120, 120]) {
            const source = { x, z };
            const target = defenders
              .filter((defender) => defender.alive && defender.z > z + 20 &&
                aimedDefenseLaneClear(source, defender, terrainHeightAt, {
                  muzzleHeight: 14, targetHeight: 11, muzzleDistance: 32, step: 5,
                }))
              .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
            if (target) { firingSolution = { source, target }; break; }
          }
          if (firingSolution) break;
        }
        const target = firingSolution?.target;
        if (target) {
          const ammo = heCycle >= 4 ? "he" : "ap";
          const profile = cannonProfile(ammo);
          tank.fired += 1;
          const result = exactShot({
            source: firingSolution.source,
            target,
            speed: profile.speed,
            spread: 0.006,
            radius: profile.projectileRadius,
            randomValue: random(),
            muzzleHeight: ammo === "he" ? 18 : 12,
            muzzleDistance: 32,
          });
          tank[result.outcome === "near-miss" ? "nearMiss" : result.outcome] += 1;
          if (result.outcome === "hit") {
            resolveDamage(target, profile.damage, tank);
          }
          heCycle = ammo === "he" ? 0 : heCycle + 1;
          tankClock = profile.cooldown * (mode.infantry ? 5 : 1);
        }
      }
    }

    if (mode.enemyFire) {
      const machineGunLive = defenders.some(
        (defender) =>
          defender.alive &&
          defender.kind === "machine-gun" &&
          friendlyRifleLaneClear(defender, formation, terrainHeightAt) &&
          !softTargetPinned(defender.kind, defender.suppression),
      );
      const pressure = formationPressure({
        connected: true,
        activeMachineGun: machineGunLive,
        activeFlanker: false,
        routeContested: machineGunLive,
        suppression: formation.suppression,
      });
      formation.suppression = Math.max(
        0,
        Math.min(100, formation.suppression + pressure.suppressionPerSecond * 0.1),
      );
      const loss = Math.max(0, pressure.casualtyPerSecond * 0.1);
      formation.casualties = Math.min(100, formation.casualties + loss);
      formation.cohesion = Math.max(0, formation.cohesion - loss);
      peakSuppression = Math.max(peakSuppression, formation.suppression);
    }
  }

  const finalize = (ledger) => ({
    ...ledger,
    terminal: ledger.terrain + ledger.nearMiss + ledger.hit + ledger.miss,
    terrainPct: +(100 * ledger.terrain / Math.max(1, ledger.fired)).toFixed(1),
    effectivePct: +(
      100 * (ledger.hit + ledger.nearMiss) / Math.max(1, ledger.fired)
    ).toFixed(1),
  });
  return {
    seed,
    mode: mode.name,
    infantry: finalize(infantry),
    tank: finalize(tank),
    formation: {
      casualties: +formation.casualties.toFixed(2),
      cohesion: +formation.cohesion.toFixed(2),
      peakSuppression: +peakSuppression.toFixed(2),
      minimumFireteams,
    },
    defendersRemaining: defenders.filter((defender) => defender.alive).length,
  };
}

export function simulateInfantryCombat() {
  const modes = [
    { name: "infantry-only", infantry: true, tank: false, enemyFire: false },
    { name: "tank-only", infantry: false, tank: true, enemyFire: false },
    { name: "mixed-force", infantry: true, tank: true, enemyFire: true },
    { name: "passive-player", infantry: true, tank: false, enemyFire: true },
  ];
  const runs = [];
  for (const seed of [1917, 1918, 1919, 1920]) {
    for (const mode of modes) runs.push(runScenario(seed, mode));
  }
  const byMode = Object.fromEntries(
    modes.map((mode) => {
      const selected = runs.filter((run) => run.mode === mode.name);
      const aggregate = selected.reduce(
        (sum, run) => {
          for (const side of ["infantry", "tank"]) {
            for (const key of [
              "fired",
              "terrain",
              "nearMiss",
              "hit",
              "miss",
              "kills",
              "terminal",
            ]) {
              sum[side][key] += run[side][key];
            }
          }
          sum.casualties += run.formation.casualties;
          sum.peakSuppression = Math.max(
            sum.peakSuppression,
            run.formation.peakSuppression,
          );
          return sum;
        },
        {
          infantry: terminalLedger(),
          tank: terminalLedger(),
          casualties: 0,
          peakSuppression: 0,
        },
      );
      aggregate.infantry.terminal =
        aggregate.infantry.terrain +
        aggregate.infantry.nearMiss +
        aggregate.infantry.hit +
        aggregate.infantry.miss;
      aggregate.tank.terminal =
        aggregate.tank.terrain +
        aggregate.tank.nearMiss +
        aggregate.tank.hit +
        aggregate.tank.miss;
      aggregate.casualties = +(aggregate.casualties / selected.length).toFixed(2);
      return [mode.name, aggregate];
    }),
  );
  const infantryOnly = byMode["infantry-only"];
  const tankOnly = byMode["tank-only"];
  const mixed = byMode["mixed-force"];
  const passive = byMode["passive-player"];
  const guardrails = {
    everyFriendlyShotTerminal: runs.every(
      (run) => run.infantry.fired === run.infantry.terminal,
    ),
    terrainLossAtMostFortyPercent:
      infantryOnly.infantry.terrain / Math.max(1, infantryOnly.infantry.fired) <= 0.4,
    infantryClearsSoftThreats: infantryOnly.infantry.kills >= 8,
    tankRemainsBreachWeapon: tankOnly.tank.kills > infantryOnly.infantry.kills,
    mixedInfantryContributes:
      mixed.infantry.kills >= 3 &&
      mixed.infantry.kills /
        Math.max(1, mixed.infantry.kills + mixed.tank.kills) >=
        0.15,
    passiveFormationUsuallyHolds:
      passive.casualties < 25 &&
      runs.filter(
        (run) =>
          run.mode === "passive-player" && run.formation.casualties < 45,
      ).length >= 3,
  };
  return {
    model:
      "v84 shared authored terrain, firing-position search, target priority, rifle lane, RNG, projectile contact, suppression, casualty, and cannon kernels; four 60-second scenarios across four seeds",
    byMode,
    guardrails,
    runs,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const first = simulateInfantryCombat();
  const second = simulateInfantryCombat();
  console.log(JSON.stringify(first, null, 2));
  if (JSON.stringify(first) !== JSON.stringify(second)) {
    throw new Error("same seed and inputs produced a different infantry ledger");
  }
  if (Object.values(first.guardrails).some((value) => value !== true)) {
    throw new Error(`infantry combat guardrail failed: ${JSON.stringify(first.guardrails)}`);
  }
}
