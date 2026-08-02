import assert from "node:assert/strict";
import test from "node:test";

import {
  captureAcre,
  createAcreDirector,
  getCaptureBlockers,
  loseRun,
  pendingOfferCount,
} from "../app/acre-director.mjs";
import {
  defenseEchelonAt,
  defenseDamageForSector,
  FORMATION_CONNECTION_DISTANCE,
  FORMATION_STRETCH_DISTANCE,
  formationStateFor,
  formationPressure,
} from "../app/difficulty-model.mjs";
import {
  stepTreads,
  TREAD_RESPONSE_MULTIPLIER,
} from "../app/tread-model.mjs";
import {
  ARTILLERY_BLAST_RADIUS,
  ARTILLERY_SALVO_SIZE,
  aimedDefenseLaneClear,
  aimedVerticalVelocity,
  artilleryBlastDamage,
  artilleryMarkForTank,
  artilleryMissionProfile,
  artilleryPressureAt,
  artilleryRangingPoint,
  artillerySalvoPoint,
  cannonProfile,
  chooseAntiArmorEmplacement,
  defenseHullContactPolicy,
  heBlastDamage,
  heShotInterval,
  isCrushable,
  nextCombatRandom,
  projectileHitsTarget,
  resolveArtilleryImpact,
  resolveHeavyArmorImpact,
  sternumContact,
  trenchquakeDamage,
  treadContactSide,
} from "../app/combat-model.mjs";
import {
  DEFAULT_TERRAIN_SEED,
  getTerrainSeed,
  setTerrainSeed,
  solveTreadSupport,
  terrainBlocksSegment,
  terrainFeaturesForSector,
  terrainFootprintReliefAt,
  terrainFootprintSeatHeight,
  terrainHeightAt,
  terrainDecorationsForSector,
  terrainSectorProfile,
  terrainSurfaceAt,
  trenchFrontZAt,
  TERRAIN_GRID_STEP,
  TREAD_SAMPLE_BUDGET,
} from "../app/terrain-model.mjs";
import {
  awardNutrients,
  nutrientTargetForLevel,
  nutrientValueForDefender,
  spendNutrientLevel,
} from "../app/progression-model.mjs";
import {
  arsenalVolleyProfile,
  commonShelterCasualtyMultiplier,
  graftIsEligible,
  scarLarderRepair,
  toxicCloudDamage,
} from "../app/graft-model.mjs";
import {
  activeFriendlyFireteams,
  chooseFriendlyRifleTarget,
  friendlyRifleDamage,
  friendlyRifleLaneClear,
  friendlySuppressionFor,
  friendlyVolleyCadence,
  softTargetPinned,
  suppressedFireCadenceMultiplier,
} from "../app/infantry-combat-model.mjs";

test("a live-wired artillery mission kills a stationary non-returning landship", () => {
  const tank = {
    x: 0,
    z: 90,
    angle: Math.PI / 2,
    forwardVelocity: 0,
    armor: { front: 100, left: 72, right: 72, rear: 44 },
    scars: { front: 0, left: 0, right: 0, rear: 0 },
    core: 100,
    leftTread: 100,
    rightTread: 100,
  };
  const mark = artilleryMarkForTank(tank);
  assert.deepEqual(mark, { x: tank.x, z: tank.z });
  assert.equal(artilleryBlastDamage(ARTILLERY_BLAST_RADIUS), 0);
  const profile = artilleryMissionProfile(0, 0, true);
  assert.equal(profile.salvoSize, ARTILLERY_SALVO_SIZE);
  let hullContacts = 0;
  let armorDamage = 0;
  let organDamage = 0;

  const landShell = (offset) => {
    const source = { x: mark.x + offset.x, z: mark.z + offset.z };
    const beforeArmor = Object.values(tank.armor).reduce((sum, value) => sum + value, 0);
    const beforeOrgans = tank.core + tank.leftTread + tank.rightTread;
    const impact = resolveArtilleryImpact(tank, source);
    assert.notEqual(impact.outcome, "terrain");
    hullContacts += 1;
    tank.armor[impact.face] = impact.armor;
    tank.scars[impact.face] = impact.scar;
    tank.core = impact.core;
    tank.leftTread = impact.leftTread;
    tank.rightTread = impact.rightTread;
    armorDamage += beforeArmor - Object.values(tank.armor).reduce((sum, value) => sum + value, 0);
    organDamage += beforeOrgans - (tank.core + tank.leftTread + tank.rightTread);
  };

  landShell(artilleryRangingPoint(0, tank.angle, true));
  landShell(artilleryRangingPoint(1, tank.angle, true));
  for (let index = 0; index < profile.salvoSize; index += 1) {
    landShell(artillerySalvoPoint(index, tank.angle, profile.dispersion));
  }

  assert.equal(hullContacts, profile.salvoSize + 2);
  assert.ok(armorDamage > 0, "visible artillery never damaged armor");
  assert.ok(organDamage > 0, "artillery contacts never reached an organ");
  assert.ok(
    tank.core <= 0 || tank.leftTread <= 0 || tank.rightTread <= 0,
    `idle landship survived the committed salvo: ${JSON.stringify(tank)}`,
  );
});

test("artillery pressure repeats historically shaped missions without removing the warning floor", () => {
  const opening = artilleryMissionProfile(0, 0, true);
  const lateObserved = artilleryMissionProfile(560, 6, true);
  const lateRegistered = artilleryMissionProfile(560, 6, false);

  assert.equal(artilleryPressureAt(0, 0), 0);
  assert.equal(artilleryPressureAt(560, 6), 8);
  assert.equal(opening.warning, 6.2);
  assert.equal(lateObserved.warning, 6.2);
  assert.ok(lateObserved.salvoSize > opening.salvoSize);
  assert.ok(lateObserved.batteryPause < opening.batteryPause);
  assert.ok(lateObserved.batteryPause >= 11);
  assert.ok(lateRegistered.batteryPause <= 27);
  assert.ok(lateRegistered.dispersion > lateObserved.dispersion);
  assert.ok(lateObserved.cadence >= 0.86);
});

test("aimed infantry fire follows a source-to-target height instead of dying on the first rise", () => {
  const hill = (x) => x * 0.5;
  assert.equal(
    terrainBlocksSegment(
      { x: 0, z: 0 },
      { x: 100, z: 0 },
      hill,
      { previous: 10, current: 60 },
    ),
    null,
  );
  assert.ok(
    terrainBlocksSegment(
      { x: 0, z: 0 },
      { x: 100, z: 0 },
      hill,
      10,
    ),
  );
});

test("war-party rifles own visible fireteams, terrain-aware targets, and soft suppression", () => {
  assert.equal(
    activeFriendlyFireteams({ casualties: 0, cohesion: 100, suppression: 0 }),
    6,
  );
  assert.equal(
    activeFriendlyFireteams({ casualties: 60, cohesion: 100, suppression: 0 }),
    3,
  );
  assert.equal(
    activeFriendlyFireteams({ casualties: 60, cohesion: 35, suppression: 70 }),
    1,
  );
  assert.ok(
    friendlyVolleyCadence({ suppression: 70, casualties: 50 }) >
      friendlyVolleyCadence({ suppression: 0, casualties: 0 }),
  );

  const parapet = (x, z) =>
    z > 38 && z < 62 && Math.abs(x) < 22 ? 30 : 0;
  const source = { x: 0, z: 0 };
  const buriedMg = {
    id: 1,
    kind: "machine-gun",
    x: 0,
    z: 100,
    alive: true,
  };
  const exposedInfantry = {
    id: 2,
    kind: "infantry",
    x: 100,
    z: 100,
    alive: true,
  };
  assert.equal(friendlyRifleLaneClear(source, buriedMg, parapet), false);
  assert.equal(friendlyRifleLaneClear(source, exposedInfantry, parapet), true);
  assert.equal(
    chooseFriendlyRifleTarget({
      source,
      defenders: [buriedMg, exposedInfantry],
      heightAt: parapet,
    })?.id,
    exposedInfantry.id,
  );

  const flat = () => 0;
  const observer = {
    id: 3,
    kind: "observer",
    x: 24,
    z: 120,
    alive: true,
  };
  assert.equal(
    chooseFriendlyRifleTarget({
      source,
      defenders: [buriedMg, observer],
      heightAt: flat,
      witnessCilia: true,
    })?.id,
    observer.id,
  );
  assert.equal(friendlyRifleDamage("infantry"), 8);
  assert.ok(friendlyRifleDamage("anti-armor") < 2);
  assert.ok(friendlySuppressionFor("machine-gun", true) > 0);
  assert.equal(friendlySuppressionFor("anti-armor", true), 0);
  assert.equal(softTargetPinned("machine-gun", 72), true);
  assert.equal(softTargetPinned("anti-armor", 100), false);
  assert.ok(suppressedFireCadenceMultiplier(60) > 1);
});

test("defensive aim, placement, and impact priority share one deterministic kernel", () => {
  const first = nextCombatRandom(1917);
  const repeated = nextCombatRandom(1917);
  assert.deepEqual(first, repeated);
  assert.notEqual(nextCombatRandom(first.state).value, first.value);

  assert.equal(
    aimedVerticalVelocity({
      source: { x: 0, z: 0, elevation: 10 },
      target: { x: 0, z: 100, elevation: 35 },
      speed: 200,
    }),
    50,
  );
  assert.equal(defenseHullContactPolicy("machine-gun", 0.05), "consume");
  assert.equal(defenseHullContactPolicy("anti-armor", 0.05), "resolve");

  const firstImpact = resolveHeavyArmorImpact({
    face: "front",
    armor: 100,
    scar: 0,
    core: 100,
    leftTread: 100,
    rightTread: 100,
    damage: 58,
  });
  assert.equal(firstImpact.outcome, "bounce");
  const secondImpact = resolveHeavyArmorImpact({
    face: "front",
    armor: firstImpact.armor,
    scar: firstImpact.scar,
    core: firstImpact.core,
    leftTread: firstImpact.leftTread,
    rightTread: firstImpact.rightTread,
    damage: 58,
  });
  assert.equal(secondImpact.outcome, "bounce");
  const rememberedImpact = resolveHeavyArmorImpact({
    face: "front",
    armor: secondImpact.armor,
    scar: secondImpact.scar,
    core: secondImpact.core,
    leftTread: secondImpact.leftTread,
    rightTread: secondImpact.rightTread,
    damage: 58,
  });
  assert.equal(rememberedImpact.outcome, "penetration");
  assert.ok(rememberedImpact.core < secondImpact.core);
});

test("every seeded AP gun owns a real approach lane before battle starts", () => {
  for (const seed of [1917, 1918, 1919, 1920]) {
    setTerrainSeed(seed);
    for (const sector of [0, 1, 2, 3]) {
      const sectorBase = 250 + sector * 620;
      const sectorProfile = terrainSectorProfile(sector);
      const emplacement = chooseAntiArmorEmplacement({
        desiredX: sector === 0 ? -184 : 0,
        sector,
        approachZ: sectorBase - 160,
        trenchZAt: (x) => trenchFrontZAt(sector, x),
        heightAt: (x, z) => terrainHeightAt(x, z),
      });
      assert.ok(emplacement.clearLanes >= 3, `${seed}:${sector} buried its AP gun`);
      const supportEmplacement = chooseAntiArmorEmplacement({
        desiredX: sector === 0 ? -184 : 0,
        sector,
        approachZ: sectorProfile.supportZ - 220,
        trenchZAt: () => sectorProfile.supportZ,
        heightAt: (x, z) => terrainHeightAt(x, z),
      });
      assert.ok(
        supportEmplacement.clearLanes >= 3,
        `${seed}:${sector} buried its support-line AP gun`,
      );
      const hasCenterLane = [
        { x: -180, z: sectorBase - 160 },
        { x: 0, z: sectorBase - 160 },
        { x: 180, z: sectorBase - 160 },
        { x: -180, z: sectorBase - 40 },
        { x: 0, z: sectorBase - 40 },
        { x: 180, z: sectorBase - 40 },
        { x: -180, z: sectorBase + 80 },
        { x: 0, z: sectorBase + 80 },
        { x: 180, z: sectorBase + 80 },
      ].some((target) =>
        aimedDefenseLaneClear(emplacement, target, terrainHeightAt),
      );
      assert.equal(hasCenterLane, true);
    }
  }
  setTerrainSeed(DEFAULT_TERRAIN_SEED);
});

test("nutrient grafts keep survivor momentum without menu spam", () => {
  assert.deepEqual(
    Array.from({ length: 12 }, (_, level) => nutrientTargetForLevel(level)),
    [18, 29, 42, 56, 70, 84, 100, 115, 131, 147, 163, 180],
  );
  assert.equal(nutrientValueForDefender("infantry"), 1.3);
  assert.equal(nutrientValueForDefender("observer"), 2.6);
  assert.equal(nutrientValueForDefender("machine-gun"), 2.6);
  assert.equal(nutrientValueForDefender("anti-armor"), 3.9000000000000004);
  assert.equal(nutrientValueForDefender("carrier"), 3.9000000000000004);
  assert.equal(nutrientValueForDefender("infantry", 6), 1.3);
  assert.equal(nutrientValueForDefender("carrier", 6), 3.9000000000000004);

  assert.ok(nutrientTargetForLevel(0) >= 18);
  assert.ok(nutrientTargetForLevel(8) / nutrientValueForDefender("carrier", 6) >= 30);

  const first = spendNutrientLevel(20, 0);
  assert.deepEqual(first, { nutrientXp: 2, nutrientLevel: 1, spent: 18 });
  assert.equal(spendNutrientLevel(first.nutrientXp, first.nutrientLevel), null);

  const trenchful = awardNutrients(16, 0, 40);
  assert.equal(trenchful, 18, "multi-kill banked a hidden second menu");
  const spentTrenchful = spendNutrientLevel(trenchful, 0);
  assert.deepEqual(spentTrenchful, {
    nutrientXp: 0,
    nutrientLevel: 1,
    spent: 18,
  });
  assert.equal(
    spendNutrientLevel(spentTrenchful.nutrientXp, spentTrenchful.nutrientLevel),
    null,
  );
});

test("living arsenal escalates spectacle and locks sibling lineages", () => {
  const grafts = {
    "bow-gunner": 1,
    "needle-lattice": 0,
    "rupture-bloom": 0,
    "scute-borer": 0,
    "funeral-lung": 0,
    "bone-harpoon": 0,
    "butchers-reel": 0,
  };
  assert.equal(graftIsEligible("needle-lattice", grafts), true);
  assert.equal(graftIsEligible("bone-harpoon", grafts), true);
  assert.deepEqual(arsenalVolleyProfile(grafts), {
    missiles: 1,
    explosive: false,
    pierce: 0,
    toxic: false,
    specialistPriority: false,
    executionBurst: false,
    damage: 11,
    spreadStep: 0,
  });

  grafts["needle-lattice"] = 1;
  assert.equal(graftIsEligible("bone-harpoon", grafts), false);
  assert.equal(graftIsEligible("rupture-bloom", grafts), true);
  Object.assign(grafts, {
    "rupture-bloom": 1,
    "scute-borer": 1,
    "funeral-lung": 1,
  });
  assert.deepEqual(arsenalVolleyProfile(grafts), {
    missiles: 3,
    explosive: true,
    pierce: 1,
    toxic: true,
    specialistPriority: false,
    executionBurst: false,
    damage: 11,
    spreadStep: 0.075,
  });
  assert.ok(toxicCloudDamage(0, 82, 1) > toxicCloudDamage(70, 82, 1));
  assert.equal(toxicCloudDamage(82, 82, 1), 0);

  const harpoon = {
    ...grafts,
    "needle-lattice": 0,
    "rupture-bloom": 0,
    "scute-borer": 0,
    "funeral-lung": 0,
    "bone-harpoon": 1,
    "butchers-reel": 1,
  };
  assert.deepEqual(arsenalVolleyProfile(harpoon), {
    missiles: 1,
    explosive: false,
    pierce: 2,
    toxic: false,
    specialistPriority: true,
    executionBurst: true,
    damage: 34,
    spreadStep: 0,
  });
});

test("ram grafts create committed contact and a sideways force path", () => {
  const tank = {
    x: 0,
    z: 0,
    angle: Math.PI / 2,
    forwardVelocity: 32,
  };
  assert.equal(sternumContact(tank, { x: 0, z: 78 }, 1), true);
  assert.equal(sternumContact(tank, { x: 82, z: 78 }, 1), false);
  assert.equal(
    sternumContact({ ...tank, forwardVelocity: 8 }, { x: 0, z: 78 }, 3),
    false,
  );
  assert.ok(trenchquakeDamage(24, 1) > trenchquakeDamage(74, 1));
  assert.equal(trenchquakeDamage(200, 3), 0);
  assert.equal(scarLarderRepair(0, 40), 0);
  assert.equal(scarLarderRepair(1, 40), 4);
  assert.equal(scarLarderRepair(1, 2), 2);
  assert.equal(commonShelterCasualtyMultiplier(0, true), 1);
  assert.equal(commonShelterCasualtyMultiplier(1, false), 1);
  assert.equal(commonShelterCasualtyMultiplier(1, true), 0.72);
});

test("acre captures never mint a second upgrade faucet through ten minutes", () => {
  const director = createAcreDirector();
  const captureTimes = [54, 102, 150, 198, 246, 294, 342, 390, 438, 486, 534, 582];

  for (let acre = 1; acre <= captureTimes.length; acre += 1) {
    const at = captureTimes[acre - 1];
    assert.equal(captureAcre(director, acre, at), true);
    assert.equal(pendingOfferCount(director), 0);
    assert.equal(captureAcre(director, acre, at + 0.1), false);
    assert.equal(director.phase, "breach");
    assert.equal(director.activeAcre, acre + 1);
    assert.equal(director.nextSectorLive, true);
  }

  assert.ok(captureTimes[0] <= 60, "first acre misses the opening cadence");
  assert.ok(
    captureTimes.filter((time) => time <= 300).length >= 5,
    "five-minute build is missing",
  );
  assert.ok(
    captureTimes.filter((time) => time <= 600).length >= 8,
    "ten-minute continuation is missing",
  );
  assert.equal(director.capturedAcres, 12);
  assert.equal(director.resolvedOffers, 0);
  assert.equal(director.status, "running");
  assert.equal(director.lossCause, null);
});

test("duplicate capture events cannot mint offers or advance twice", () => {
  const director = createAcreDirector();
  assert.equal(captureAcre(director, 1, 54), true);
  assert.equal(captureAcre(director, 1, 54.01), false);
  assert.equal(director.capturedAcres, 1);
  assert.equal(director.resolvedOffers, 0);
  assert.equal(pendingOfferCount(director), 0);
  assert.equal(director.phase, "breach");
});

test("captured ground resumes the advance without a hold or reprisal phase", () => {
  const director = createAcreDirector();
  assert.equal(captureAcre(director, 1, 20), true);
  assert.equal(director.phase, "breach");
  assert.equal(director.activeAcre, 2);
  assert.equal(director.nextSectorLive, true);
  assert.equal("reprisalAcre" in director, false);
  assert.equal("deadPhaseTrips" in director, false);
});

test("brutal pressure escalates with depth while distance alone never kills", () => {
  assert.equal(FORMATION_CONNECTION_DISTANCE, 340);
  assert.equal(FORMATION_STRETCH_DISTANCE, 500);
  assert.equal(defenseDamageForSector(10, 0), 10);
  assert.equal(defenseDamageForSector(10, 6), 12.4);
  assert.equal(defenseDamageForSector(10, 20), 14);
  const profile = { centerZ: 550, supportZ: 695, reserveZ: 818 };
  assert.equal(defenseEchelonAt(380, profile), "screen");
  assert.equal(defenseEchelonAt(500, profile), "main-line");
  assert.equal(defenseEchelonAt(675, profile), "support-line");
  assert.equal(defenseEchelonAt(800, profile), "reserve-line");
  assert.equal(defenseEchelonAt(930, profile), "consolidation");

  const quietSeparation = formationPressure({
    connected: false,
    activeMachineGun: false,
    activeFlanker: false,
    suppression: 70,
  });
  assert.equal(quietSeparation.casualtyPerSecond, 0);
  assert.ok(quietSeparation.suppressionPerSecond < 0);

  const blockedRoute = formationPressure({
    connected: false,
    activeMachineGun: true,
    activeFlanker: true,
    routeContested: true,
    suppression: 70,
  });
  const ramWake = formationPressure({
    connected: false,
    activeMachineGun: true,
    activeFlanker: true,
    routeContested: true,
    inBreachWake: true,
    suppression: 70,
  });
  assert.ok(blockedRoute.casualtyPerSecond > 0);
  assert.ok(ramWake.suppressionPerSecond < blockedRoute.suppressionPerSecond);
  assert.equal(ramWake.casualtyPerSecond, blockedRoute.casualtyPerSecond);
});

test("formation states preserve dependency and make ram separation recoverable", () => {
  const base = {
    cohesion: 90,
    suppression: 20,
    routeContested: false,
    breachWake: false,
  };
  assert.equal(formationStateFor({ ...base, gap: 200 }), "connected");
  assert.equal(formationStateFor({ ...base, gap: 410 }), "stretched");
  assert.equal(formationStateFor({ ...base, gap: 620 }), "separated");
  assert.equal(
    formationStateFor({ ...base, gap: 620, breachWake: true }),
    "reconnecting",
  );
  assert.equal(
    formationStateFor({
      ...base,
      gap: 410,
      routeContested: true,
      suppression: 92,
    }),
    "overrun",
  );
});

test("only named hull or war-party losses terminate the director", () => {
  const hull = createAcreDirector();
  assert.equal(loseRun(hull, "hull_failure", 20), true);
  assert.equal(hull.status, "lost");
  assert.equal(hull.lossCause, "hull_failure");

  const party = createAcreDirector();
  assert.equal(loseRun(party, "war_party_ruin", 20), true);
  assert.equal(party.status, "lost");
  assert.equal(party.lossCause, "war_party_ruin");
});

test("capture truth requires the whole formation and clears legibly", () => {
  const blocked = getCaptureBlockers({
    phase: "breach",
    connected: true,
    cohesion: 90,
    formationX: 0,
    formationZ: 500,
    formationWidth: 118,
    nodeX: 0,
    nodeZ: 550,
    wire: { gapCenter: 0, gapWidth: 100 },
    breachClearance: 8,
    heavyThreats: 2,
    localInfantry: 9,
  });
  assert.deepEqual(blocked, [
    "BARBERED WIRE 126m",
    "2 HARDPOINTS",
    "5 INFANTRY IN TRENCH",
    "50m TO LINE",
  ]);

  const clear = getCaptureBlockers({
    phase: "consolidate",
    connected: true,
    cohesion: 90,
    formationX: 0,
    formationZ: 550,
    formationWidth: 118,
    nodeX: 0,
    nodeZ: 550,
    wire: { gapCenter: 0, gapWidth: 126 },
    breachClearance: 8,
    heavyThreats: 0,
    localInfantry: 4,
  });
  assert.deepEqual(clear, []);
});

test("different two-tread traces create different weapon geometry", () => {
  const straight = {
    x: 0,
    z: 90,
    angle: Math.PI / 2,
    leftSpool: 0,
    rightSpool: 0,
    forwardVelocity: 0,
    yawVelocity: 0,
  };
  const turn = { ...straight };
  const wounded = { ...straight };

  for (let frame = 0; frame < 360; frame += 1) {
    stepTreads(straight, {
      leftDemand: 1,
      rightDemand: 1,
      leftHealth: 1,
      rightHealth: 1,
      dt: 1 / 60,
    });
    stepTreads(turn, {
      leftDemand: 1,
      rightDemand: 0.28,
      leftHealth: 1,
      rightHealth: 1,
      dt: 1 / 60,
    });
    stepTreads(wounded, {
      leftDemand: 1,
      rightDemand: 1,
      leftHealth: 0.22,
      rightHealth: 1,
      dt: 1 / 60,
    });
  }

  assert.ok(Math.abs(straight.angle - turn.angle) > 0.5);
  assert.ok(Math.abs(straight.x - turn.x) > 40);
  assert.ok(Math.abs(straight.angle - wounded.angle) > 0.35);
  assert.ok(Math.abs(straight.z - wounded.z) > 25);
});

test("the landship answers 20% sooner without increasing its top speed", () => {
  assert.equal(TREAD_RESPONSE_MULTIPLIER, 1.2);
  const tank = {
    x: 0,
    z: 90,
    angle: Math.PI / 2,
    leftSpool: 0,
    rightSpool: 0,
    forwardVelocity: 0,
    yawVelocity: 0,
  };
  for (let frame = 0; frame < 60; frame += 1) {
    stepTreads(tank, {
      leftDemand: 1,
      rightDemand: 1,
      leftHealth: 1,
      rightHealth: 1,
      dt: 1 / 60,
    });
  }
  assert.ok(tank.forwardVelocity >= 39);
  assert.ok(tank.forwardVelocity < 118);
  assert.ok(tank.z >= 106);
});

test("six tread contacts and one belly sample produce deterministic broken-ground pose", () => {
  const pose = { x: 0, z: 500, angle: Math.PI / 2 };
  const first = solveTreadSupport(pose, (x, z) => terrainHeightAt(x, z), 1);
  const second = solveTreadSupport(pose, (x, z) => terrainHeightAt(x, z), 1);
  assert.equal(first.sampleCount, TREAD_SAMPLE_BUDGET);
  assert.equal(first.contacts.left.length, 3);
  assert.equal(first.contacts.right.length, 3);
  assert.deepEqual(first, second);
  assert.ok(Number.isFinite(first.elevation));
  assert.ok(Number.isFinite(first.pitch));
  assert.ok(Number.isFinite(first.roll));
});

test("the same front seed reproduces military intent and destruction exactly", () => {
  setTerrainSeed(1917);
  const first = structuredClone(terrainSectorProfile(3));
  setTerrainSeed(1917);
  const second = structuredClone(terrainSectorProfile(3));
  assert.deepEqual(second, first);
  assert.equal(first.edges.some((edge) => edge.kind === "front"), true);
  assert.equal(first.edges.some((edge) => edge.kind === "support"), true);
  assert.equal(first.edges.some((edge) => edge.kind === "reserve"), true);
  assert.equal(first.edges.some((edge) => edge.kind === "communication"), true);
  assert.equal(first.edges.some((edge) => edge.kind === "sap"), true);
  assert.ok(first.craters.length >= 10);
  assert.equal(terrainDecorationsForSector(3).filter((item) => item.kind.includes("crater")).length, first.craters.length);
  setTerrainSeed(DEFAULT_TERRAIN_SEED);
});

test("different front seeds change geography, graph, bombardment, and approach", () => {
  setTerrainSeed(1917);
  const first = structuredClone(terrainSectorProfile(2));
  const firstOpening = terrainHeightAt(40, trenchFrontZAt(2, 40));
  setTerrainSeed(1918);
  const second = structuredClone(terrainSectorProfile(2));
  const secondOpening = terrainHeightAt(40, trenchFrontZAt(2, 40));
  assert.notDeepEqual(
    { region: first.region, landform: first.landform, encounter: first.encounter, craters: first.craters },
    { region: second.region, landform: second.landform, encounter: second.encounter, craters: second.craters },
  );
  assert.notEqual(firstOpening, secondOpening);
  setTerrainSeed(DEFAULT_TERRAIN_SEED);
  assert.equal(getTerrainSeed(), DEFAULT_TERRAIN_SEED);
});

test("wet lows tax speed without owning tread differential", () => {
  setTerrainSeed(DEFAULT_TERRAIN_SEED);
  const profile = terrainSectorProfile(0);
  const flooded = profile.craters.find((crater) => crater.flooded) ?? profile.craters[0];
  const surface = terrainSurfaceAt(flooded.x, flooded.z);
  assert.ok(surface.traction >= 0.68 && surface.traction <= 1);
  const mud = {
    x: 0,
    z: 90,
    angle: Math.PI / 2,
    leftSpool: 0,
    rightSpool: 0,
    forwardVelocity: 0,
    yawVelocity: 0,
  };
  const firm = { ...mud };
  for (let frame = 0; frame < 180; frame += 1) {
    stepTreads(mud, { leftDemand: 1, rightDemand: 0.35, leftHealth: 1, rightHealth: 1, traction: 0.68, dt: 1 / 60 });
    stepTreads(firm, { leftDemand: 1, rightDemand: 0.35, leftHealth: 1, rightHealth: 1, traction: 1, dt: 1 / 60 });
  }
  assert.ok(mud.forwardVelocity < firm.forwardVelocity);
  assert.ok(Math.abs(mud.angle - firm.angle) < 1e-9, "mud stole steering authority");
});

test("collision samples the exact same two triangles as the rendered terrain", () => {
  const x0 = -3 * TERRAIN_GRID_STEP;
  const z0 = 41 * TERRAIN_GRID_STEP;
  const a = terrainHeightAt(x0, z0);
  const b = terrainHeightAt(x0 + TERRAIN_GRID_STEP, z0);
  const d = terrainHeightAt(x0, z0 + TERRAIN_GRID_STEP);
  const c = terrainHeightAt(
    x0 + TERRAIN_GRID_STEP,
    z0 + TERRAIN_GRID_STEP,
  );

  const nearX = 0.23;
  const nearZ = 0.31;
  const nearExpected = a + nearX * (b - a) + nearZ * (d - a);
  assert.ok(
    Math.abs(
      terrainHeightAt(
        x0 + nearX * TERRAIN_GRID_STEP,
        z0 + nearZ * TERRAIN_GRID_STEP,
      ) - nearExpected,
    ) < 1e-9,
  );

  const farX = 0.72;
  const farZ = 0.64;
  const farExpected =
    c + (1 - farX) * (d - c) + (1 - farZ) * (b - c);
  assert.ok(
    Math.abs(
      terrainHeightAt(
        x0 + farX * TERRAIN_GRID_STEP,
        z0 + farZ * TERRAIN_GRID_STEP,
      ) - farExpected,
    ) < 1e-9,
  );
});

test("wide scenery seats from its whole rendered footprint instead of a hilltop", () => {
  const feature = terrainFeaturesForSector(0).find(
    (candidate) => candidate.kind === "wreckage",
  );
  assert.ok(feature);
  const centerHeight = terrainHeightAt(feature.x, feature.z);
  const seatHeight = terrainFootprintSeatHeight(
    feature.x,
    feature.z,
    46,
    20,
  );
  assert.ok(centerHeight - seatHeight > 8);
  assert.ok(seatHeight < centerHeight);
  assert.ok(
    terrainFootprintReliefAt(feature.x, feature.z, 46, 20) >=
      centerHeight - seatHeight,
  );
});

test("one tread mounting changes hull pose without stealing steering", () => {
  const rubble = terrainFeaturesForSector(0).find((feature) => feature.kind === "rubble");
  assert.ok(rubble);
  const pose = {
    x: rubble.x - 43,
    z: rubble.z - 50,
    angle: Math.PI / 2,
  };
  const support = solveTreadSupport(pose, (x, z) => terrainHeightAt(x, z), 1);
  assert.ok(Math.abs(support.roll) > 0.04);

  const brokenGroundTank = {
    ...pose,
    leftSpool: 0,
    rightSpool: 0,
    forwardVelocity: 0,
    yawVelocity: 0,
  };
  const flatGroundTank = { ...brokenGroundTank };
  for (let frame = 0; frame < 90; frame += 1) {
    stepTreads(brokenGroundTank, {
      leftDemand: 1,
      rightDemand: 1,
      leftHealth: 1,
      rightHealth: 1,
      dt: 1 / 60,
    });
    stepTreads(flatGroundTank, {
      leftDemand: 1,
      rightDemand: 1,
      leftHealth: 1,
      rightHealth: 1,
      dt: 1 / 60,
    });
  }
  assert.deepEqual(brokenGroundTank, flatGroundTank);
});

test("substantial wreckage is rendered terrain that the body climbs", () => {
  const wreckage = terrainFeaturesForSector(0).find((feature) => feature.kind === "wreckage");
  assert.ok(wreckage);
  const approach = {
    x: wreckage.x,
    z: wreckage.z - 72,
    angle: Math.PI / 2,
  };
  const forward = solveTreadSupport(
    approach,
    (x, z) => terrainHeightAt(x, z),
    1,
  );
  assert.ok(["climbing", "cresting", "left_mounting", "right_mounting"].includes(forward.state));
  assert.ok(forward.elevation > terrainHeightAt(wreckage.x, wreckage.z - wreckage.radius - 20));
  assert.equal("blocked" in forward, false);
});

test("an artillery crater persists as a physical depression with a raised lip", () => {
  const crater = { x: 12, z: 700, radius: 112, depth: 20 };
  const centerBefore = terrainHeightAt(crater.x, crater.z);
  const centerAfter = terrainHeightAt(crater.x, crater.z, [crater]);
  const lipAfter = terrainHeightAt(crater.x + crater.radius * 0.92, crater.z, [crater]);
  assert.ok(centerAfter < centerBefore - 14);
  assert.ok(lipAfter > terrainHeightAt(crater.x + crater.radius * 0.92, crater.z));
  const support = solveTreadSupport(
    { x: crater.x, z: crater.z - 42, angle: Math.PI / 2 },
    (x, z) => terrainHeightAt(x, z, [crater]),
    1,
  );
  assert.ok(Math.abs(support.pitch) > 0.04 || support.state !== "supported");
});

test("compact AP stays lethal while HE remains a deterministic fifth-shot cycle", () => {
  const he = cannonProfile("he");
  const ap = cannonProfile("ap");
  assert.ok(he.damage >= 120);
  assert.ok(he.blastRadius >= 140);
  assert.equal(he.cooldown, 0.9);
  assert.ok(heBlastDamage("infantry", 120) >= 18);
  assert.ok(heBlastDamage("machine-gun", 60) >= 52);
  assert.ok(heBlastDamage("anti-armor", 0) < he.damage * 0.2);
  assert.equal(ap.damage, 96);
  assert.equal(ap.blastRadius, 26);
  assert.equal(ap.cooldown, 0.72);
  assert.equal(heShotInterval(0), Number.POSITIVE_INFINITY);
  assert.equal(heShotInterval(1), 5);
});

test("main-mouth shells cannot tunnel through a body between frames", () => {
  assert.equal(
    projectileHitsTarget(
      { x: 0, z: 0 },
      { x: 0, z: 32 },
      { x: 0, z: 17 },
      4,
    ),
    true,
  );
  assert.equal(
    projectileHitsTarget(
      { x: 0, z: 0 },
      { x: 0, z: 32 },
      { x: 8, z: 17 },
      4,
    ),
    false,
  );
});

test("twin tread geometry—not a hidden attack button—owns crushing", () => {
  const tank = {
    x: 0,
    z: 100,
    angle: Math.PI / 2,
    forwardVelocity: 70,
  };
  assert.equal(treadContactSide(tank, { x: -32, z: 122 }), "left");
  assert.equal(treadContactSide(tank, { x: 32, z: 122 }), "right");
  assert.equal(treadContactSide(tank, { x: 0, z: 190 }), null);
  assert.equal(
    treadContactSide({ ...tank, forwardVelocity: 0 }, { x: -32, z: 122 }),
    null,
  );
  assert.equal(isCrushable("infantry"), true);
  assert.equal(isCrushable("observer"), true);
  assert.equal(isCrushable("machine-gun"), true);
  assert.equal(isCrushable("flanker"), true);
  assert.equal(isCrushable("anti-armor"), true);
  assert.equal(isCrushable("carrier"), true);
});
