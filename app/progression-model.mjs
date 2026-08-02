// @ts-check

/**
 * Nutrient grafts arrive early, then become increasingly scarce. nutrientXp is
 * the current bar, not a lifetime score: buying a graft spends this target.
 * That makes a second menu impossible unless the player earns another entire
 * level after returning to battle.
 *
 * Opening per-level targets: 18, 29, 42, 56, 70, 84, 100...
 *
 * @param {number} completedLevels
 */
export function nutrientTargetForLevel(completedLevels) {
  const level = Math.max(0, Math.floor(completedLevels));
  return 18 + level * 9 + Math.floor(Math.pow(level, 1.35) * 2.5);
}

/**
 * Spend exactly one full bar. Kill values are smaller than every target, so
 * the remainder can never contain another completed level. The caller returns
 * to battle before this function can succeed again.
 * @param {number} nutrientXp
 * @param {number} completedLevels
 */
export function spendNutrientLevel(nutrientXp, completedLevels) {
  const level = Math.max(0, Math.floor(completedLevels));
  const cost = nutrientTargetForLevel(level);
  if (nutrientXp < cost) return null;
  return {
    nutrientXp: nutrientXp - cost,
    nutrientLevel: level + 1,
    spent: cost,
  };
}

/**
 * Stop feeding the bar once one menu is ready. A single HE detonation may kill
 * a trenchful of bodies in one simulation step; nutrients earned after the bar
 * fills are intentionally lost instead of banking a hidden second menu.
 * @param {number} nutrientXp
 * @param {number} completedLevels
 * @param {number} award
 */
export function awardNutrients(nutrientXp, completedLevels, award) {
  return Math.min(
    nutrientTargetForLevel(completedLevels),
    Math.max(0, nutrientXp) + Math.max(0, award),
  );
}

/**
 * Hardpoints remain worth more than rank-and-file bodies, but depth never
 * multiplies kill value. Escalation already increases kill rate; increasing XP
 * per corpse as well caused several graft menus to bank inside one trench.
 *
 * @param {string} kind
 * @param {number} [sector]
 */
export function nutrientValueForDefender(kind, sector = 0) {
  void sector;
  const baseline =
    kind === "carrier" || kind === "anti-armor"
      ? 3
      : kind === "machine-gun" ||
          kind === "flanker" ||
          kind === "observer" ||
          kind === "satchel"
        ? 2
        : 1;
  return baseline * 1.3;
}
