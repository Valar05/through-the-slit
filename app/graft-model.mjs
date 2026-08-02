/** Branching graft doctrine: every stage adds a battlefield verb. */

export const GRAFT_PREREQUISITES = Object.freeze({
  "needle-lattice": ["bow-gunner"],
  "rupture-bloom": ["needle-lattice"],
  "scute-borer": ["rupture-bloom"],
  "funeral-lung": ["scute-borer"],
  "bone-harpoon": ["bow-gunner"],
  "butchers-reel": ["bone-harpoon"],
  "whelping-shot": ["bow-gunner"],
  "trenchquake-bladders": ["battering-sternum"],
  "scar-larder": ["battering-sternum"],
  "witness-cilia": ["rifle-choir"],
  "common-shelter": ["rifle-choir"],
  "munition-womb": ["trench-teeth"],
});

export const GRAFT_FAMILIES = Object.freeze({
  "bow-gunner": "living-arsenal",
  "needle-lattice": "living-arsenal",
  "rupture-bloom": "living-arsenal",
  "scute-borer": "living-arsenal",
  "funeral-lung": "living-arsenal",
  "bone-harpoon": "living-arsenal",
  "butchers-reel": "living-arsenal",
  "top-gunner": "living-arsenal",
  "rib-mortar-brood": "living-arsenal",
  "whelping-shot": "living-arsenal",
  "battering-sternum": "breach-body",
  "trenchquake-bladders": "breach-body",
  "scar-larder": "breach-body",
  "rifle-choir": "war-party",
  "sapper-brood": "war-party",
  "trench-teeth": "war-party",
  "witness-cilia": "war-party",
  "common-shelter": "war-party",
  "munition-womb": "war-party",
});

export const GRAFT_EXCLUSIONS = Object.freeze({
  "needle-lattice": ["bone-harpoon", "butchers-reel"],
  "rupture-bloom": ["bone-harpoon", "butchers-reel"],
  "scute-borer": ["bone-harpoon", "butchers-reel"],
  "funeral-lung": ["bone-harpoon", "butchers-reel"],
  "bone-harpoon": ["needle-lattice", "rupture-bloom", "scute-borer", "funeral-lung"],
  "butchers-reel": ["needle-lattice", "rupture-bloom", "scute-borer", "funeral-lung"],
});

export function graftIsEligible(key, grafts) {
  const requirements = GRAFT_PREREQUISITES[key] ?? [];
  const exclusions = GRAFT_EXCLUSIONS[key] ?? [];
  return requirements.every((required) => (grafts[required] ?? 0) > 0) &&
    exclusions.every((excluded) => (grafts[excluded] ?? 0) === 0);
}

export function arsenalVolleyProfile(grafts) {
  const needlePath = (grafts["needle-lattice"] ?? 0) > 0;
  const harpoonPath = (grafts["bone-harpoon"] ?? 0) > 0;
  return {
    missiles: needlePath ? 3 : 1,
    explosive: (grafts["rupture-bloom"] ?? 0) > 0,
    pierce: (grafts["scute-borer"] ?? 0) > 0 ? 1 : harpoonPath ? 2 : 0,
    toxic: (grafts["funeral-lung"] ?? 0) > 0,
    specialistPriority: harpoonPath,
    executionBurst: (grafts["butchers-reel"] ?? 0) > 0,
    damage: harpoonPath ? 34 : 11,
    spreadStep: needlePath ? 0.075 : 0,
  };
}

export function toxicCloudDamage(distance, radius, dt) {
  if (distance >= radius || radius <= 0 || dt <= 0) return 0;
  return 13 * dt * (0.35 + 0.65 * (1 - distance / radius));
}

/** A sternum kill repairs only wounds the run has actually suffered. */
export function scarLarderRepair(level, missingArmor) {
  if (level <= 0 || missingArmor <= 0) return 0;
  return Math.min(missingArmor, 2.5 + level * 1.5);
}

/**
 * Securing ground gives the crew one short consolidation window. It closes a
 * useful fraction of every existing wound without replacing Scar Larder's
 * repeatable, kill-fed combat repair.
 */
export function fieldConsolidationRepair(current, maximum) {
  const missing = Math.max(0, maximum - current);
  if (missing <= 0) return 0;
  return Math.min(missing, 4 + missing * 0.12);
}

/** Shelter preserves artillery timing and spectacle while reducing casualties. */
export function commonShelterCasualtyMultiplier(level, connected) {
  if (level <= 0 || !connected) return 1;
  return Math.max(0.42, 0.72 - (level - 1) * 0.08);
}
