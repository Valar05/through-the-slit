import * as THREE from "three";
import {
  aimedVerticalVelocity,
  chooseAntiArmorEmplacement,
  nextCombatRandom,
  projectileHitsTarget,
  resolveHeavyArmorImpact,
} from "../app/combat-model.mjs";
import {
  setTerrainSeed,
  terrainHeightAt,
  trenchFrontZAt,
  TERRAIN_GRID_STEP,
} from "../app/terrain-model.mjs";

const CHUNK_SIZE = 240;
const CHUNK_DIVISIONS = CHUNK_SIZE / TERRAIN_GRID_STEP;
const AP_SPEED = 330;
const AP_RADIUS = 8;
const HULL_RADIUS = 29;
const AP_DAMAGE = 58;
const AP_SPREAD = 0.28;
const FIRST_SECTOR_Z = 250;

function terrainMesh(minX, maxX, minZ, maxZ) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const firstChunkX = Math.floor(minX / CHUNK_SIZE);
  const lastChunkX = Math.floor(maxX / CHUNK_SIZE);
  const firstChunkZ = Math.floor(minZ / CHUNK_SIZE);
  const lastChunkZ = Math.floor(maxZ / CHUNK_SIZE);
  for (let chunkZ = firstChunkZ; chunkZ <= lastChunkZ; chunkZ += 1) {
    for (let chunkX = firstChunkX; chunkX <= lastChunkX; chunkX += 1) {
      const originX = chunkX * CHUNK_SIZE;
      const originZ = chunkZ * CHUNK_SIZE;
      const vertexCount = (CHUNK_DIVISIONS + 1) ** 2;
      const positions = new Float32Array(vertexCount * 3);
      const indices = [];
      for (let row = 0; row <= CHUNK_DIVISIONS; row += 1) {
        for (let column = 0; column <= CHUNK_DIVISIONS; column += 1) {
          const index = row * (CHUNK_DIVISIONS + 1) + column;
          const x = originX + column * TERRAIN_GRID_STEP;
          const z = originZ + row * TERRAIN_GRID_STEP;
          positions[index * 3] = column * TERRAIN_GRID_STEP;
          positions[index * 3 + 1] = terrainHeightAt(x, z);
          positions[index * 3 + 2] = row * TERRAIN_GRID_STEP;
        }
      }
      for (let row = 0; row < CHUNK_DIVISIONS; row += 1) {
        for (let column = 0; column < CHUNK_DIVISIONS; column += 1) {
          const a = row * (CHUNK_DIVISIONS + 1) + column;
          const b = a + 1;
          const d = (row + 1) * (CHUNK_DIVISIONS + 1) + column;
          const c = d + 1;
          indices.push(a, d, b, b, d, c);
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3),
      );
      geometry.setIndex(indices);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(originX, 0, originZ);
      mesh.updateMatrixWorld(true);
      group.add(mesh);
    }
  }
  group.updateMatrixWorld(true);
  return group;
}

function armorFace(tank, source) {
  const sourceAngle = Math.atan2(source.z - tank.z, source.x - tank.x);
  let relative =
    ((sourceAngle - tank.angle + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (relative < -Math.PI) relative += Math.PI * 2;
  const forwardness = Math.cos(relative);
  if (forwardness > 0.55) return "front";
  if (forwardness < -0.55) return "rear";
  return Math.sin(relative) > 0 ? "left" : "right";
}

function exactShot(mesh, source, tank, randomValue) {
  const centerAngle = Math.atan2(tank.z - source.z, tank.x - source.x);
  const angle = centerAngle + (randomValue - 0.5) * AP_SPREAD;
  const muzzle = {
    x: source.x + Math.cos(angle) * 18,
    z: source.z + Math.sin(angle) * 18,
  };
  const sourceElevation = terrainHeightAt(muzzle.x, muzzle.z) + 13;
  const targetElevation = terrainHeightAt(tank.x, tank.z) + 11;
  const directDistance = Math.hypot(tank.x - muzzle.x, tank.z - muzzle.z);
  const verticalVelocity = aimedVerticalVelocity({
    source: { ...muzzle, elevation: sourceElevation },
    target: { ...tank, elevation: targetElevation },
    speed: AP_SPEED,
  });
  const travelTime = directDistance / AP_SPEED;
  const endpoint = {
    x: muzzle.x + Math.cos(angle) * directDistance,
    z: muzzle.z + Math.sin(angle) * directDistance,
    elevation: sourceElevation + verticalVelocity * travelTime,
  };
  const extended = {
    x: muzzle.x + Math.cos(angle) * (directDistance + 70),
    z: muzzle.z + Math.sin(angle) * (directDistance + 70),
    elevation:
      sourceElevation + verticalVelocity * ((directDistance + 70) / AP_SPEED),
  };
  const rayOrigin = new THREE.Vector3(muzzle.x, sourceElevation, muzzle.z);
  const rayDirection = new THREE.Vector3(
    extended.x - muzzle.x,
    extended.elevation - sourceElevation,
    extended.z - muzzle.z,
  ).normalize();
  const raycaster = new THREE.Raycaster(
    rayOrigin,
    rayDirection,
    0.001,
    directDistance + 70,
  );
  const terrainHit = raycaster.intersectObject(mesh, true)[0] ?? null;
  const hitsHull = projectileHitsTarget(
    muzzle,
    endpoint,
    tank,
    AP_RADIUS + HULL_RADIUS,
  );
  if (
    terrainHit &&
    terrainHit.distance < Math.max(0, directDistance - AP_RADIUS - HULL_RADIUS)
  ) {
    return "terrain";
  }
  return hitsHull ? "armor" : "miss";
}

function runBarrage(seed, tankPosition) {
  setTerrainSeed(seed);
  const mesh = terrainMesh(-600, 600, -240, 960);
  const emplacement = chooseAntiArmorEmplacement({
    desiredX: -184,
    sector: 0,
    approachZ: FIRST_SECTOR_Z - 160,
    trenchZAt: (x) => trenchFrontZAt(0, x),
    heightAt: terrainHeightAt,
  });
  const tank = {
    ...tankPosition,
    angle: Math.PI / 2,
    armor: { front: 100, left: 72, right: 72, rear: 44 },
    scars: { front: 0, left: 0, right: 0, rear: 0 },
    core: 100,
    leftTread: 100,
    rightTread: 100,
  };
  const ledger = {
    seed,
    tank: tankPosition,
    emplacement,
    fired: 0,
    terrain: 0,
    miss: 0,
    armor: 0,
    bounce: 0,
    penetration: 0,
  };
  let randomState = (seed * 2654435761) >>> 0;
  // v64's live opening cadence: 8.5 seconds acquisition, 2.15 seconds
  // visible traverse, then 4.6 seconds recovery plus another traverse.
  for (let fireTime = 10.65; fireTime <= 60; fireTime += 6.75) {
    const random = nextCombatRandom(randomState);
    randomState = random.state;
    ledger.fired += 1;
    const outcome = exactShot(mesh, emplacement, tank, random.value);
    ledger[outcome] += 1;
    if (outcome !== "armor") continue;
    const face = armorFace(tank, emplacement);
    const impact = resolveHeavyArmorImpact({
      face,
      armor: tank.armor[face],
      scar: tank.scars[face],
      core: tank.core,
      leftTread: tank.leftTread,
      rightTread: tank.rightTread,
      damage: AP_DAMAGE,
    });
    tank.armor[face] = impact.armor;
    tank.scars[face] = impact.scar;
    tank.core = impact.core;
    tank.leftTread = impact.leftTread;
    tank.rightTread = impact.rightTread;
    ledger[impact.outcome] += 1;
  }
  return {
    ...ledger,
    terminalOutcomes: ledger.terrain + ledger.miss + ledger.armor,
    final: {
      armor: tank.armor,
      core: +tank.core.toFixed(2),
      leftTread: +tank.leftTread.toFixed(2),
      rightTread: +tank.rightTread.toFixed(2),
    },
  };
}

function simulate() {
  const runs = [];
  for (const seed of [1917, 1918, 1919, 1920]) {
    for (const tank of [
      { x: 0, z: 90 },
      { x: 0, z: 330 },
      { x: 0, z: 450 },
    ]) {
      runs.push(runBarrage(seed, tank));
    }
  }
  const totals = runs.reduce(
    (sum, run) => {
      for (const key of [
        "fired",
        "terrain",
        "miss",
        "armor",
        "bounce",
        "penetration",
        "terminalOutcomes",
      ]) {
        sum[key] += run[key];
      }
      if (run.final.core <= 0) sum.destroyed += 1;
      if (
        run.final.core <= 0 ||
        run.final.leftTread <= 0 ||
        run.final.rightTread <= 0
      ) {
        sum.missionKilled += 1;
      }
      if (run.penetration > 0) sum.woundedRuns += 1;
      return sum;
    },
    {
      fired: 0,
      terrain: 0,
      miss: 0,
      armor: 0,
      bounce: 0,
      penetration: 0,
      terminalOutcomes: 0,
      woundedRuns: 0,
      destroyed: 0,
      missionKilled: 0,
    },
  );
  return {
    model:
      "v64 exact Three.js triangle raycasts; shared live aim, placement, RNG, and armor kernel; 12 stationary 60-second opening-battery runs",
    totals,
    rates: {
      terrainPct: +(100 * totals.terrain / totals.fired).toFixed(1),
      missPct: +(100 * totals.miss / totals.fired).toFixed(1),
      armorContactPct: +(100 * totals.armor / totals.fired).toFixed(1),
      penetrationPerContactPct: +(
        100 * totals.penetration / Math.max(1, totals.armor)
      ).toFixed(1),
    },
    guardrails: {
      everyShotTerminal: totals.fired === totals.terminalOutcomes,
      everyRunOwnsFiringLane: runs.every((run) => run.emplacement.clearLanes >= 3),
      stationaryTargetUsuallyWounded: totals.woundedRuns >= 8,
      // Cambrai's first-day combat knock-out share was roughly one in six.
      // This deliberately stationary, non-returning target is allowed a
      // somewhat worse one-minute mission-kill rate, but catastrophic hull
      // deletion is not an acceptable default.
      stationaryTargetNotAutomaticallyDestroyed:
        totals.destroyed === 0 && totals.missionKilled <= 4,
    },
    runs,
  };
}

const first = simulate();
const second = simulate();
console.log(JSON.stringify(first, null, 2));
if (JSON.stringify(first) !== JSON.stringify(second)) {
  throw new Error("same seed and inputs produced a different combat ledger");
}
if (Object.values(first.guardrails).some((value) => value !== true)) {
  throw new Error(`combat guardrail failed: ${JSON.stringify(first.guardrails)}`);
}
