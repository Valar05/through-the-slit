// @ts-check

export const DEFENSE_SECTOR_FAMILIES = [
  "sunken-road",
  "reverse-slope-battery",
  "trench-junction-redoubt",
];

/** @param {number} sector */
export function defenseSectorFamily(sector) {
  return DEFENSE_SECTOR_FAMILIES[Math.max(0, Math.trunc(sector)) % DEFENSE_SECTOR_FAMILIES.length];
}

/** @param {number} sector @param {number} centerZ */
export function defenseSectorPlan(sector, centerZ) {
  const family = defenseSectorFamily(sector);
  if (family === "sunken-road") return {
    family, label: "SUNKEN ROAD ENFILADE",
    occupation: { x: 92, z: centerZ + 32 }, hardpoint: { x: -238, z: centerZ + 92 },
    observer: { x: 246, z: centerZ + 184 }, reserveEntry: { x: -338, z: centerZ + 354 },
    coveredApproach: { x: -248, z: centerZ - 74 }, consolidationSeconds: 7.5,
  };
  if (family === "reverse-slope-battery") return {
    family, label: "REVERSE-SLOPE BATTERY",
    occupation: { x: -44, z: centerZ + 122 }, hardpoint: { x: 176, z: centerZ + 178 },
    observer: { x: -252, z: centerZ - 34 }, reserveEntry: { x: 286, z: centerZ + 382 },
    coveredApproach: { x: 168, z: centerZ + 42 }, consolidationSeconds: 8.5,
  };
  return {
    family, label: "TRENCH JUNCTION REDOUBT",
    occupation: { x: 0, z: centerZ + 40 }, hardpoint: { x: 0, z: centerZ + 112 },
    observer: { x: 224, z: centerZ + 224 },
    reserveEntry: { x: sector % 2 === 0 ? -320 : 320, z: centerZ + 346 },
    coveredApproach: { x: sector % 2 === 0 ? -176 : 176, z: centerZ + 18 },
    consolidationSeconds: 10,
  };
}
