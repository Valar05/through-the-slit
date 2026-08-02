import assert from "node:assert/strict";
import test from "node:test";

import {
  beginConsolidation,
  consolidationState,
  counterattackComposition,
  defenseSectorPlan,
  updateSectorControl,
} from "../app/defense-depth-model.mjs";
import {
  setTerrainSeed,
  terrainHeightAt,
  terrainSectorProfile,
} from "../app/terrain-model.mjs";

const nodeFor = (holdSeconds) => ({
  captured: false,
  consolidationStartedAt: null,
  counterattackSpawned: false,
  counterattackBroken: false,
  counterattackBrokenAt: null,
  holdSeconds,
});

test("three authored sectors replace interchangeable bumpy carpet", () => {
  setTerrainSeed(1917);
  const profiles = [0, 1, 2].map((sector) => terrainSectorProfile(sector));
  assert.deepEqual(profiles.map((profile) => profile.encounter), [
    "sunken-road",
    "reverse-slope-battery",
    "trench-junction-redoubt",
  ]);
  for (const profile of profiles) {
    const plan = defenseSectorPlan(profile.sector, profile.centerZ);
    assert.equal(profile.occupationAnchor.x, plan.occupation.x);
    assert.equal(profile.occupationAnchor.z, plan.occupation.z);
  }
  assert.ok(
    terrainHeightAt(-180, profiles[0].centerZ - 80) -
      terrainHeightAt(-180, profiles[0].centerZ - 142) >= 18,
    "sunken road does not read as a cut",
  );
  const reverse = profiles[1];
  assert.ok(
    terrainHeightAt(0, reverse.centerZ + 24) -
      terrainHeightAt(0, reverse.centerZ + 164) >= 18,
    "reverse slope does not mask the battery shelf",
  );
  assert.ok(
    Math.abs(
      terrainHeightAt(0, profiles[2].centerZ + 40) -
        terrainHeightAt(180, profiles[2].centerZ + 170),
    ) >= 12,
    "junction redoubt lacks tactical relief",
  );
});

test("ownership requires the reserve counterattack and a real consolidation hold", () => {
  const plan = defenseSectorPlan(2, 1790);
  const node = nodeFor(plan.consolidationSeconds);
  assert.equal(beginConsolidation(node, 10), true);
  assert.equal(consolidationState(node, 11).stage, "holding");
  assert.equal(consolidationState(node, 11.5).stage, "summon-counterattack");
  node.counterattackSpawned = true;
  assert.equal(consolidationState(node, 30).stage, "counterattack");
  const broken = updateSectorControl(node, 31, true, false);
  assert.equal(broken.secured, false);
  assert.equal(broken.state.stage, "holding");
  assert.equal(
    updateSectorControl(node, 31 + plan.consolidationSeconds + 0.1, true, false).secured,
    true,
  );
  assert.deepEqual(counterattackComposition(plan.family), {
    assault: 5,
    engineers: 1,
    carrier: 1,
  });
});
