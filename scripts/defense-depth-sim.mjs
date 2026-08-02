import {
  beginConsolidation,
  consolidationState,
  counterattackComposition,
  defenseSectorPlan,
} from "../app/defense-depth-model.mjs";
import {
  setTerrainSeed,
  terrainHeightAt,
  terrainSectorProfile,
} from "../app/terrain-model.mjs";

function freshNode(holdSeconds) {
  return {
    captured: false,
    consolidationStartedAt: null,
    counterattackSpawned: false,
    counterattackBroken: false,
    counterattackBrokenAt: null,
    holdSeconds,
  };
}

export function simulateDefenseDepth() {
  const runs = [];
  for (const seed of [1917, 1918, 1919, 1920]) {
    setTerrainSeed(seed);
    for (const sector of [0, 1, 2]) {
      const profile = terrainSectorProfile(sector);
      const plan = defenseSectorPlan(sector, profile.centerZ);
      const node = freshNode(plan.consolidationSeconds);
      beginConsolidation(node, 100);
      const beforeReserve = consolidationState(node, 101);
      const summon = consolidationState(node, 101.5);
      node.counterattackSpawned = true;
      const contested = consolidationState(node, 105);
      node.counterattackBroken = true;
      node.counterattackBrokenAt = 106;
      const holding = consolidationState(node, 106 + plan.consolidationSeconds - 0.1);
      const secured = consolidationState(node, 106 + plan.consolidationSeconds + 0.1);
      const relief = {
        approach: terrainHeightAt(plan.occupation.x, profile.centerZ - 180),
        objective: terrainHeightAt(plan.occupation.x, plan.occupation.z),
        reserve: terrainHeightAt(plan.reserveEntry.x, plan.reserveEntry.z),
        ridge: terrainHeightAt(0, profile.centerZ + 24),
        battery: terrainHeightAt(0, profile.centerZ + 164),
        road: terrainHeightAt(-180, profile.centerZ - 142),
        roadBank: terrainHeightAt(-180, profile.centerZ - 80),
        junction: terrainHeightAt(0, profile.centerZ + 40),
        junctionFlank: terrainHeightAt(180, profile.centerZ + 170),
      };
      runs.push({
        seed,
        sector,
        family: plan.family,
        composition: counterattackComposition(plan.family),
        relief,
        stages: [beforeReserve.stage, summon.stage, contested.stage, holding.stage, secured.stage],
      });
    }
  }
  const guardrails = {
    allThreeFamiliesAuthored: [0, 1, 2].every((sector) =>
      runs.some((run) => run.sector === sector && run.family === [
        "sunken-road",
        "reverse-slope-battery",
        "trench-junction-redoubt",
      ][sector]),
    ),
    counterattackCannotBeSkipped: runs.every((run) =>
      run.stages.join(">") === "holding>summon-counterattack>counterattack>holding>secured",
    ),
    everySectorHasReserveAndTender: runs.every((run) =>
      run.composition.assault >= 3 && run.composition.engineers === 1,
    ),
    reverseSlopeActuallyMasksBattery: runs
      .filter((run) => run.family === "reverse-slope-battery")
      .every((run) => run.relief.ridge - run.relief.battery >= 18),
    strategicReliefExceedsCarpetNoise: runs.every((run) =>
      run.family === "sunken-road"
        ? run.relief.roadBank - run.relief.road >= 18
        : run.family === "reverse-slope-battery"
          ? run.relief.ridge - run.relief.battery >= 18
          : Math.abs(run.relief.junction - run.relief.junctionFlank) >= 12),
  };
  return { model: "v84 authored sector topology and consolidation kernel", guardrails, runs };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const first = simulateDefenseDepth();
  const second = simulateDefenseDepth();
  console.log(JSON.stringify(first, null, 2));
  if (JSON.stringify(first) !== JSON.stringify(second)) {
    throw new Error("defense-depth simulation is not deterministic");
  }
  if (Object.values(first.guardrails).some((value) => value !== true)) {
    throw new Error(`defense-depth guardrail failed: ${JSON.stringify(first.guardrails)}`);
  }
}
