// @ts-check

import { defenseSectorPlan } from "./terrain-sector-plan.mjs";

export const TREAD_SAMPLE_BUDGET = 7;
export const TREAD_HALF_GAUGE = 43;
export const TREAD_HALF_LENGTH = 49;
export const MAX_MOUNT_STEP = 18;
// Rendering, sprite grounding, and collision all sample this exact global
// triangle lattice. Keep it in sync with the terrain chunk geometry.
export const TERRAIN_GRID_STEP = 15;
export const TERRAIN_SECTOR_LENGTH = 620;
export const TERRAIN_FIRST_LINE_Z = 550;
export const DEFAULT_TERRAIN_SEED = 1917;

let activeTerrainSeed = DEFAULT_TERRAIN_SEED;
const sectorProfileCache = new Map();
const terrainFeatureCache = new Map();
const terrainDecorationCache = new Map();
const staticLatticeHeightCache = new Map();
const STATIC_LATTICE_CACHE_LIMIT = 80000;
const STATIC_LATTICE_CACHE_TRIM = 20000;

export function setTerrainSeed(seed) {
  const numeric = Number.isFinite(Number(seed)) ? Math.abs(Math.trunc(Number(seed))) : DEFAULT_TERRAIN_SEED;
  activeTerrainSeed = numeric || DEFAULT_TERRAIN_SEED;
  sectorProfileCache.clear();
  terrainFeatureCache.clear();
  terrainDecorationCache.clear();
  staticLatticeHeightCache.clear();
}

export function getTerrainSeed() {
  return activeTerrainSeed;
}

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const smoothstep = (edge0, edge1, value) => {
  const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const hash01 = (value) => {
  const wave = Math.sin(value * 91.733 + 17.11 + activeTerrainSeed * 0.017) * 43758.5453;
  return wave - Math.floor(wave);
};

const fade = (value) => value * value * value * (value * (value * 6 - 15) + 10);
const lerp = (start, end, amount) => start + (end - start) * amount;

const gradientDot = (gridX, gridZ, offsetX, offsetZ) => {
  const angle = hash01(gridX * 127.1 + gridZ * 311.7) * Math.PI * 2;
  return Math.cos(angle) * offsetX + Math.sin(angle) * offsetZ;
};

/** Stable world-coordinate gradient noise in the range approximately -1..1. */
export function perlinNoise2D(x, z) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const localX = x - x0;
  const localZ = z - z0;
  const u = fade(localX);
  const v = fade(localZ);
  const near = lerp(
    gradientDot(x0, z0, localX, localZ),
    gradientDot(x0 + 1, z0, localX - 1, localZ),
    u,
  );
  const far = lerp(
    gradientDot(x0, z0 + 1, localX, localZ - 1),
    gradientDot(x0 + 1, z0 + 1, localX - 1, localZ - 1),
    u,
  );
  return lerp(near, far, v) * 1.42;
}

const REGIONS = ["picardy", "flanders", "aisne", "argonne"];
const LANDFORMS = ["cross-slope", "shallow-bowl", "low-ridge", "shallow-valley", "saddle", "ravine-mouth"];

const pointSegmentDistance = (x, z, a, b) => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz || 1;
  const amount = clamp(((x - a.x) * dx + (z - a.z) * dz) / lengthSq, 0, 1);
  return Math.hypot(x - (a.x + dx * amount), z - (a.z + dz * amount));
};

const polylineEdges = (points, kind, depth, width) =>
  points.slice(0, -1).map((start, index) => {
    const end = points[index + 1];
    const influence = width * 2.35;
    return {
      kind,
      depth,
      width,
      start,
      end,
      minX: Math.min(start.x, end.x) - influence,
      maxX: Math.max(start.x, end.x) + influence,
      minZ: Math.min(start.z, end.z) - influence,
      maxZ: Math.max(start.z, end.z) + influence,
    };
  });

const zigzagLine = (sector, centerZ, phase, bend = 0) => {
  const points = [];
  for (let index = 0; index <= 8; index += 1) {
    const x = -520 + index * 130;
    const traverse = (index % 2 === 0 ? -1 : 1) * (10 + hash01(sector * 97 + phase * 13 + index) * 8);
    points.push({ x, z: centerZ + traverse + (x / 430) * bend });
  }
  return points;
};

const communicationLine = (sector, frontZ, supportZ, reserveZ, side) => {
  const startX = side * (126 + hash01(sector * 43 + side * 19) * 126);
  const drift = side * (86 + hash01(sector * 61 + side * 7) * 58);
  return [
    { x: startX, z: frontZ + 4 },
    { x: startX - side * 42, z: frontZ + 62 },
    { x: startX + side * 28, z: frontZ + 112 },
    { x: startX + drift * 0.55, z: supportZ + 8 },
    { x: startX + drift * 0.25, z: supportZ + 72 },
    { x: startX + drift, z: reserveZ },
  ];
};

export function terrainSectorProfile(sector) {
  const safeSector = Math.max(0, Math.trunc(sector));
  const cacheKey = `${activeTerrainSeed}:${safeSector}`;
  const cached = sectorProfileCache.get(cacheKey);
  if (cached) return cached;
  const centerZ = TERRAIN_FIRST_LINE_Z + safeSector * TERRAIN_SECTOR_LENGTH;
  const identity = activeTerrainSeed * 131 + safeSector * 977;
  const region = REGIONS[Math.floor(hash01(identity + 1) * REGIONS.length) % REGIONS.length];
  const landform = LANDFORMS[Math.floor(hash01(identity + 2) * LANDFORMS.length) % LANDFORMS.length];
  const tacticalPlan = defenseSectorPlan(safeSector, centerZ);
  const encounter = tacticalPlan.family;
  const bend = (hash01(identity + 4) - 0.5) * 34;
  const supportZ = centerZ + 145 + (hash01(identity + 5) - 0.5) * 24;
  const reserveZ = centerZ + 268 + (hash01(identity + 6) - 0.5) * 30;
  const front = zigzagLine(safeSector, centerZ, 0, bend);
  const support = zigzagLine(safeSector, supportZ, 1, -bend * 0.55);
  const reserve = zigzagLine(safeSector, reserveZ, 2, bend * 0.35);
  const leftCommunication = communicationLine(safeSector, centerZ, supportZ, reserveZ, -1);
  const rightCommunication = communicationLine(safeSector, centerZ, supportZ, reserveZ, 1);
  const sapX = (hash01(identity + 7) - 0.5) * 280;
  const sap = [
    { x: sapX, z: centerZ - 4 },
    { x: sapX + 34, z: centerZ - 54 },
    { x: sapX - 8, z: centerZ - 106 },
  ];
  const edges = [
    ...polylineEdges(front, "front", 11.5, 18),
    ...polylineEdges(support, "support", 8.5, 16),
    ...polylineEdges(reserve, "reserve", 7, 15),
    ...polylineEdges(leftCommunication, "communication", 8, 14),
    ...polylineEdges(rightCommunication, "communication", 8, 14),
    ...polylineEdges(sap, "sap", 6.5, 12),
  ];
  if (encounter === "sunken-road") {
    edges.push(...polylineEdges([
      { x: -520, z: centerZ - 188 },
      { x: -180, z: centerZ - 142 },
      { x: 150, z: centerZ - 176 },
      { x: 520, z: centerZ - 118 },
    ], "sunken-road", 13, 34));
  } else if (encounter === "trench-junction-redoubt") {
    edges.push(
      ...polylineEdges([
        { x: -360, z: centerZ - 86 },
        tacticalPlan.occupation,
        { x: 350, z: centerZ + 170 },
      ], "junction-arm", 10, 18),
      ...polylineEdges([
        { x: 0, z: centerZ - 150 },
        tacticalPlan.occupation,
        { x: tacticalPlan.reserveEntry.x, z: tacticalPlan.reserveEntry.z },
      ], "junction-spine", 11, 19),
    );
  }

  const craterCount = region === "flanders" ? 12 : 10;
  const craters = [];
  for (let index = 0; index < craterCount; index += 1) {
    const cluster = index % 3;
    const clusterX = (hash01(identity + 40 + cluster * 17) - 0.5) * 620;
    const clusterZ = centerZ - 235 + hash01(identity + 50 + cluster * 19) * 455;
    const radius = 30 + hash01(identity + 70 + index * 11) * (region === "flanders" ? 48 : 58);
    craters.push({
      x: clamp(clusterX + (hash01(identity + 80 + index * 23) - 0.5) * 150, -465, 465),
      z: clusterZ + (hash01(identity + 90 + index * 29) - 0.5) * 105,
      radius,
      depth: 5.5 + radius * (0.105 + hash01(identity + 100 + index * 31) * 0.08),
      flooded: region === "flanders" || hash01(identity + 120 + index * 37) > 0.74,
      cluster,
    });
  }
  const strongpoints = [-0.76, -0.26, 0.27, 0.77].map((factor, index) => ({
    x: factor * 430,
    z: trenchFrontZAt(safeSector, factor * 430),
    kind: index === 1 && encounter === "trench-junction-redoubt" ? "redoubt" : "firing-bay",
  }));
  const profile = {
    sector: safeSector,
    seed: activeTerrainSeed,
    centerZ,
    supportZ,
    reserveZ,
    region,
    landform,
    encounter,
    edges,
    craters,
    strongpoints,
    occupationAnchor: tacticalPlan.occupation,
    tacticalPlan,
    landmark: {
      x: (safeSector % 2 === 0 ? 1 : -1) * (176 + hash01(identity + 9) * 42),
      z: centerZ - 76,
      kind: encounter === "shattered-copse" ? "shattered-copse" : "wreckage",
    },
  };
  sectorProfileCache.set(cacheKey, profile);
  return profile;
}

export function terrainSectorForZ(z) {
  return Math.max(0, Math.floor((z - (TERRAIN_FIRST_LINE_Z - TERRAIN_SECTOR_LENGTH * 0.5)) / TERRAIN_SECTOR_LENGTH));
}

export function trenchFrontZAt(sector, x) {
  const safeSector = Math.max(0, Math.trunc(sector));
  const centerZ = TERRAIN_FIRST_LINE_Z + safeSector * TERRAIN_SECTOR_LENGTH;
  const identity = activeTerrainSeed * 131 + safeSector * 977;
  const bend = (hash01(identity + 4) - 0.5) * 34;
  const cell = clamp(Math.floor((x + 520) / 130), 0, 7);
  const x0 = -520 + cell * 130;
  const amount = clamp((x - x0) / 130, 0, 1);
  const zAt = (index) => centerZ + (index % 2 === 0 ? -1 : 1) * (10 + hash01(safeSector * 97 + index) * 8) + ((-520 + index * 130) / 430) * bend;
  return lerp(zAt(cell), zAt(cell + 1), amount);
}

const terrainProfileAt = (z) => terrainSectorProfile(terrainSectorForZ(z));

const distanceToEdges = (x, z, profile) => {
  let nearest = Number.POSITIVE_INFINITY;
  let edgeKind = "open";
  for (const edge of profile.edges) {
    if (x < edge.minX || x > edge.maxX || z < edge.minZ || z > edge.maxZ) continue;
    const distance = pointSegmentDistance(x, z, edge.start, edge.end);
    if (distance < nearest) {
      nearest = distance;
      edgeKind = edge.kind;
    }
  }
  return { distance: nearest, kind: edgeKind };
};

/** @typedef {{x:number,z:number,radius:number,depth:number}} TerrainCrater */

export function baseTerrainHeight(x, z) {
  const profile = terrainProfileAt(z);
  const local = clamp((z - (profile.centerZ - TERRAIN_SECTOR_LENGTH * 0.5)) / TERRAIN_SECTOR_LENGTH, 0, 1);
  const envelope = Math.sin(local * Math.PI) ** 2;
  let strategicRelief = 0;
  if (profile.landform === "cross-slope") strategicRelief = (x / 430) * 8;
  else if (profile.landform === "shallow-bowl") strategicRelief = -11 * Math.exp(-((x / 250) ** 2));
  else if (profile.landform === "low-ridge") strategicRelief = 14 * Math.exp(-(((z - profile.centerZ + 80) / 175) ** 2));
  else if (profile.landform === "shallow-valley") strategicRelief = -12 * Math.exp(-(((z - profile.centerZ - 30) / 190) ** 2));
  else if (profile.landform === "saddle") strategicRelief = 8 * Math.cos(x / 150) - 7 * Math.exp(-(((z - profile.centerZ) / 125) ** 2));
  else strategicRelief = -13 * Math.exp(-(((x + 70) / 145) ** 2)) + 5 * Math.sin(z * 0.01);
  if (profile.encounter === "sunken-road") {
    const roadAxis = centerlineSunkenRoadZ(profile.centerZ, x);
    const distance = Math.abs(z - roadAxis);
    strategicRelief += -18 * Math.exp(-((distance / 46) ** 4));
    strategicRelief += 7 * Math.exp(-(((distance - 62) / 24) ** 2));
  } else if (profile.encounter === "reverse-slope-battery") {
    const ridge = 43 * Math.exp(-(((z - (profile.centerZ + 24)) / 92) ** 4));
    const batteryShelf = -18 * Math.exp(-(((z - (profile.centerZ + 164)) / 84) ** 4));
    strategicRelief += ridge + batteryShelf + (x / 430) * 5;
  } else if (profile.encounter === "trench-junction-redoubt") {
    strategicRelief += 18 * Math.exp(-(((z - (profile.centerZ + 55)) / 118) ** 4));
    strategicRelief += 6 * Math.exp(-((x / 190) ** 4));
  }
  const regionalScale = profile.region === "flanders" ? 0.68 : profile.region === "aisne" ? 1.08 : 0.9;
  return (
    perlinNoise2D(x * 0.0027 + 19.7, z * 0.0027 - 8.3) * 3.4 +
    perlinNoise2D(x * 0.009 - 31.2, z * 0.009 + 14.1) * 0.46 +
    strategicRelief * envelope * regionalScale
  );
}

function centerlineSunkenRoadZ(centerZ, x) {
  if (x < -180) return centerZ - 188 + ((x + 520) / 340) * 46;
  if (x < 150) return centerZ - 142 - ((x + 180) / 330) * 34;
  return centerZ - 176 + ((x - 150) / 370) * 58;
}

export function terrainFeaturesForSector(sector) {
  const cacheKey = `${activeTerrainSeed}:${sector}`;
  const cached = terrainFeatureCache.get(cacheKey);
  if (cached) return cached;
  const profile = terrainSectorProfile(sector);
  const lineZ = profile.centerZ;
  const seed = sector * 31 + 7 + activeTerrainSeed;
  const features = [
    {
      kind: "rubble",
      x: (hash01(seed) - 0.5) * 250,
      z: lineZ - 178,
      radius: 52,
      height: 21,
    },
    {
      kind: "wreckage",
      x: profile.landmark.x,
      z: profile.landmark.z,
      radius: 82,
      height: profile.landmark.kind === "shattered-copse" ? 34 : 54,
    },
  ];
  terrainFeatureCache.set(cacheKey, features);
  return features;
}

export function terrainDecorationsForSector(sector) {
  const cacheKey = `${activeTerrainSeed}:${sector}`;
  const cached = terrainDecorationCache.get(cacheKey);
  if (cached) return cached;
  const profile = terrainSectorProfile(sector);
  const decorations = profile.craters.map((crater, index) => ({
    ...crater,
    kind: crater.flooded ? "flooded-crater" : "shell-crater",
    id: `${profile.seed}:${sector}:crater:${index}`,
  }));
  decorations.push(
    {
      kind: "dugout-mouth",
      id: `${profile.seed}:${sector}:dugout:left`,
      x: -250,
      z: profile.supportZ + 7,
      radius: 34,
    },
    {
      kind: "dugout-mouth",
      id: `${profile.seed}:${sector}:dugout:right`,
      x: 245,
      z: profile.reserveZ - 4,
      radius: 34,
    },
  );
  if (profile.encounter === "reverse-slope-battery") {
    for (let index = 0; index < 3; index += 1) {
      decorations.push({
        kind: "battery-emplacement",
        id: `${profile.seed}:${sector}:battery:${index}`,
        x: -128 + index * 128,
        z: profile.centerZ + 166 + (index % 2) * 18,
        radius: 44,
      });
    }
  }
  if (profile.encounter === "shattered-copse") {
    for (let index = 0; index < 5; index += 1) {
      decorations.push({
        kind: "shattered-copse",
        id: `${profile.seed}:${sector}:stump:${index}`,
        x: profile.landmark.x + (hash01(sector * 211 + index * 17) - 0.5) * 170,
        z: profile.landmark.z + (hash01(sector * 223 + index * 23) - 0.5) * 150,
        radius: 22,
      });
    }
  }
  terrainDecorationCache.set(cacheKey, decorations);
  return decorations;
}

export function terrainDecorationsInRange(minZ, maxZ) {
  const first = Math.max(0, terrainSectorForZ(minZ) - 1);
  const last = terrainSectorForZ(maxZ) + 1;
  const decorations = [];
  for (let sector = first; sector <= last; sector += 1) {
    decorations.push(...terrainDecorationsForSector(sector));
  }
  return decorations.filter((decoration) => decoration.z + (decoration.radius ?? 0) >= minZ && decoration.z - (decoration.radius ?? 0) <= maxZ);
}

export function terrainFeaturesInRange(minZ, maxZ) {
  const first = Math.max(0, Math.floor((minZ - 550) / 620) - 1);
  const last = Math.max(first, Math.ceil((maxZ - 550) / 620) + 1);
  const features = [];
  for (let sector = first; sector <= last; sector += 1) {
    features.push(...terrainFeaturesForSector(sector));
  }
  return features;
}

function moundHeight(x, z, feature) {
  const distance = Math.hypot(x - feature.x, z - feature.z);
  if (distance >= feature.radius) return 0;
  const normalized = 1 - distance / feature.radius;
  if (feature.kind === "wreckage") {
    // Hard wreckage is a broad physical ramp in the rendered heightfield. The
    // body climbs it; it is never a vertical collider or a ghost sprite.
    return feature.height * smoothstep(0, 1, normalized);
  }
  return feature.height * Math.sin(normalized * Math.PI * 0.5) ** 1.5;
}

function trenchSystemHeight(x, z) {
  const profile = terrainProfileAt(z);
  let height = 0;
  for (const edge of profile.edges) {
    if (x < edge.minX || x > edge.maxX || z < edge.minZ || z > edge.maxZ) continue;
    const distance = pointSegmentDistance(x, z, edge.start, edge.end);
    if (distance > edge.width * 2.35) continue;
    const cut = edge.depth * Math.exp(-((distance / edge.width) ** 4));
    const bankCenter = edge.width * 1.42;
    const banks = edge.depth * 0.76 * Math.exp(-(((distance - bankCenter) / (edge.width * 0.42)) ** 2));
    height += banks - cut;
  }
  return height;
}

function craterHeight(x, z, crater) {
  const distance = Math.hypot(x - crater.x, z - crater.z);
  if (distance > crater.radius * 1.18) return 0;
  const normalized = distance / crater.radius;
  const bowl = normalized < 1
    ? -crater.depth * (1 - normalized * normalized) ** 2
    : 0;
  const lip = crater.depth * 0.32 * Math.exp(-(((normalized - 0.92) / 0.17) ** 2));
  return bowl + lip;
}

function staticTerrainHeightAt(x, z) {
  const profile = terrainProfileAt(z);
  let height = baseTerrainHeight(x, z) + trenchSystemHeight(x, z);
  for (const feature of terrainFeaturesForSector(profile.sector)) {
    height += moundHeight(x, z, feature);
  }
  for (const crater of profile.craters) {
    if (Math.abs(x - crater.x) > crater.radius * 1.18 || Math.abs(z - crater.z) > crater.radius * 1.18) continue;
    height += craterHeight(x, z, crater);
  }
  return height;
}

function dynamicCraterHeightAt(x, z, craters) {
  let height = 0;
  for (const crater of craters) {
    if (Math.abs(x - crater.x) > crater.radius * 1.18 || Math.abs(z - crater.z) > crater.radius * 1.18) continue;
    height += craterHeight(x, z, crater);
  }
  return height;
}

function staticLatticeHeightAt(cellX, cellZ) {
  const key = `${cellX}:${cellZ}`;
  const cached = staticLatticeHeightCache.get(key);
  if (cached !== undefined) return cached;
  const height = staticTerrainHeightAt(
    cellX * TERRAIN_GRID_STEP,
    cellZ * TERRAIN_GRID_STEP,
  );
  staticLatticeHeightCache.set(key, height);
  if (staticLatticeHeightCache.size > STATIC_LATTICE_CACHE_LIMIT) {
    const keys = staticLatticeHeightCache.keys();
    for (let index = 0; index < STATIC_LATTICE_CACHE_TRIM; index += 1) {
      const next = keys.next();
      if (next.done) break;
      staticLatticeHeightCache.delete(next.value);
    }
  }
  return height;
}

export function terrainSurfaceAt(x, z) {
  const profile = terrainProfileAt(z);
  const trench = distanceToEdges(x, z, profile);
  let craterWetness = 0;
  let craterDepth = 0;
  for (const crater of profile.craters) {
    if (Math.abs(x - crater.x) > crater.radius || Math.abs(z - crater.z) > crater.radius) continue;
    const normalized = Math.hypot(x - crater.x, z - crater.z) / crater.radius;
    if (normalized >= 1) continue;
    craterDepth = Math.max(craterDepth, 1 - normalized);
    if (crater.flooded) craterWetness = Math.max(craterWetness, 1 - smoothstep(0.18, 1, normalized));
  }
  const trenchWetness = trench.distance < 16
    ? (profile.region === "flanders" ? 0.92 : profile.region === "picardy" ? 0.4 : 0.22)
    : 0;
  const basin = clamp(
    0.16 +
      perlinNoise2D(x * 0.012 + 4.1, z * 0.012 - 7.3) * 0.28 +
      (profile.region === "flanders" ? 0.44 : 0),
    0,
    0.78,
  );
  const wetness = clamp(Math.max(craterWetness, trenchWetness, basin * craterDepth), 0, 1);
  const kind = craterWetness > 0.25
    ? "flooded-crater"
    : trench.distance < 18
      ? trench.kind
      : wetness > 0.5
        ? "mud-basin"
        : profile.region === "picardy"
          ? "chalk-soil"
          : "broken-ground";
  return {
    sector: profile.sector,
    region: profile.region,
    landform: profile.landform,
    encounter: profile.encounter,
    kind,
    wetness,
    traction: clamp(1 - wetness * 0.32, 0.68, 1),
    trenchDistance: trench.distance,
    trenchKind: trench.kind,
  };
}

/**
 * Height of the rendered terrain triangle at an arbitrary world coordinate.
 *
 * The GPU mesh uses the diagonal from the cell's far-left vertex to its
 * near-right vertex (`a,d,b` and `b,d,c`). Sampling that same pair here keeps
 * collision, feet, props, projectiles, and pixels on one physical surface.
 */
export function terrainHeightAt(x, z, craters = []) {
  const cellX = Math.floor(x / TERRAIN_GRID_STEP);
  const cellZ = Math.floor(z / TERRAIN_GRID_STEP);
  const x0 = cellX * TERRAIN_GRID_STEP;
  const z0 = cellZ * TERRAIN_GRID_STEP;
  const tx = (x - x0) / TERRAIN_GRID_STEP;
  const tz = (z - z0) / TERRAIN_GRID_STEP;
  const sample = (sampleCellX, sampleCellZ) => {
    const sampleX = sampleCellX * TERRAIN_GRID_STEP;
    const sampleZ = sampleCellZ * TERRAIN_GRID_STEP;
    return (
      staticLatticeHeightAt(sampleCellX, sampleCellZ) +
      dynamicCraterHeightAt(sampleX, sampleZ, craters)
    );
  };
  const a = sample(cellX, cellZ);
  const b = sample(cellX + 1, cellZ);
  const d = sample(cellX, cellZ + 1);

  if (tx + tz <= 1) {
    return a + tx * (b - a) + tz * (d - a);
  }

  const c = sample(cellX + 1, cellZ + 1);
  return c + (1 - tx) * (d - c) + (1 - tz) * (b - c);
}

const footprintHeights = (
  x,
  z,
  halfWidth,
  halfDepth,
  craters = [],
) => {
  const heights = [];
  for (const widthFactor of [-1, -0.5, 0, 0.5, 1]) {
    for (const depthFactor of [-1, 0, 1]) {
      heights.push(
        terrainHeightAt(
          x + halfWidth * widthFactor,
          z + halfDepth * depthFactor,
          craters,
        ),
      );
    }
  }
  return heights;
};

/**
 * A wide billboard cannot stand on one center-point height. Seat its whole
 * visible base at the lowest rendered triangle beneath the footprint so the
 * terrain may occlude and embed it, but can never leave air below it.
 */
export function terrainFootprintSeatHeight(
  x,
  z,
  halfWidth,
  halfDepth,
  craters = [],
) {
  return Math.min(...footprintHeights(x, z, halfWidth, halfDepth, craters));
}

/** Height variation under a wide prop, used to keep authored defenses off hills. */
export function terrainFootprintReliefAt(
  x,
  z,
  halfWidth,
  halfDepth,
  craters = [],
) {
  const heights = footprintHeights(x, z, halfWidth, halfDepth, craters);
  return Math.max(...heights) - Math.min(...heights);
}

/**
 * Six tread contacts plus one belly sample are the fixed mechanical budget.
 * @param {{x:number,z:number,angle:number}} pose
 * @param {(x:number,z:number)=>number} heightAt
 * @param {number} direction
 */
export function solveTreadSupport(pose, heightAt, direction = 1) {
  const forwardX = Math.cos(pose.angle);
  const forwardZ = Math.sin(pose.angle);
  const leftX = -forwardZ;
  const leftZ = forwardX;
  const longitudinal = [-TREAD_HALF_LENGTH, 0, TREAD_HALF_LENGTH];
  const sampleTread = (side) => longitudinal.map((distance) => {
    const x = pose.x + forwardX * distance + leftX * TREAD_HALF_GAUGE * side;
    const z = pose.z + forwardZ * distance + leftZ * TREAD_HALF_GAUGE * side;
    return { x, z, height: heightAt(x, z) };
  });
  const left = sampleTread(1);
  const right = sampleTread(-1);
  const belly = heightAt(pose.x, pose.z);
  const leadingIndex = direction >= 0 ? 2 : 0;
  const trailingIndex = direction >= 0 ? 0 : 2;
  const leftRise = left[leadingIndex].height - left[1].height;
  const rightRise = right[leadingIndex].height - right[1].height;
  const leftGrade = (left[2].height - left[0].height) / (TREAD_HALF_LENGTH * 2);
  const rightGrade = (right[2].height - right[0].height) / (TREAD_HALF_LENGTH * 2);
  const leftRoughness = Math.abs(left[0].height - left[1].height * 2 + left[2].height);
  const rightRoughness = Math.abs(right[0].height - right[1].height * 2 + right[2].height);
  const leftMounting = leftRise > MAX_MOUNT_STEP && Math.abs(leftGrade) > 0.22;
  const rightMounting = rightRise > MAX_MOUNT_STEP && Math.abs(rightGrade) > 0.22;
  const frontHeight = (left[2].height + right[2].height) * 0.5;
  const rearHeight = (left[0].height + right[0].height) * 0.5;
  const leftHeight = left.reduce((sum, point) => sum + point.height, 0) / 3;
  const rightHeight = right.reduce((sum, point) => sum + point.height, 0) / 3;
  const supportHeight = (leftHeight + rightHeight) * 0.5;
  const cresting = belly > (frontHeight + rearHeight) * 0.5 + 8;
  let state = "supported";
  if (cresting || (leftMounting && rightMounting)) state = "cresting";
  else if (leftMounting || leftRoughness > rightRoughness + 10) state = "left_mounting";
  else if (rightMounting || rightRoughness > leftRoughness + 10) state = "right_mounting";
  else if (Math.abs((frontHeight - rearHeight) / (TREAD_HALF_LENGTH * 2)) > 0.08) {
    state = frontHeight > rearHeight ? "climbing" : "descending";
  }

  return {
    sampleCount: TREAD_SAMPLE_BUDGET,
    elevation: supportHeight,
    pitch: Math.atan2(frontHeight - rearHeight, TREAD_HALF_LENGTH * 2),
    roll: Math.atan2(rightHeight - leftHeight, TREAD_HALF_GAUGE * 2),
    leftMounting,
    rightMounting,
    cresting,
    state,
    contacts: { left, right, belly, leadingIndex, trailingIndex },
  };
}

export function terrainBlocksSegment(previous, current, heightAt, clearance) {
  const samples = 5;
  const startClearance =
    typeof clearance === "number" ? clearance : clearance.previous;
  const endClearance =
    typeof clearance === "number" ? clearance : clearance.current;
  for (let index = 1; index <= samples; index += 1) {
    const amount = index / samples;
    const x = previous.x + (current.x - previous.x) * amount;
    const z = previous.z + (current.z - previous.z) * amount;
    const rayHeight =
      startClearance + (endClearance - startClearance) * amount;
    if (heightAt(x, z) >= rayHeight) return { x, z, height: heightAt(x, z) };
  }
  return null;
}
