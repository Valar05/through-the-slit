import assert from "node:assert/strict";
import test from "node:test";
import {
  canPresentGraftOffer,
  tacticalExplosionRadiusCap,
} from "../app/defense-depth-model.mjs";

test("organ choices wait for their earning spectacle and artillery warning", () => {
  const runtime = { captionClock: 0, artillery: null, explosions: [] };
  assert.equal(canPresentGraftOffer(runtime), true);
  runtime.captionClock = 0.1;
  assert.equal(canPresentGraftOffer(runtime), false);
  runtime.captionClock = 0;
  runtime.artillery = { stage: "incoming" };
  assert.equal(canPresentGraftOffer(runtime), false);
  runtime.artillery = null;
  runtime.explosions = [{ kind: "he", intensity: 3, age: 0.2, life: 1 }];
  assert.equal(canPresentGraftOffer(runtime), false);
  runtime.explosions[0].age = 0.8;
  assert.equal(canPresentGraftOffer(runtime), true);
});

test("the first three grafts hammer through opening spectacle but not artillery", () => {
  const runtime = {
    captionClock: 4,
    nutrientLevel: 0,
    artillery: null,
    explosions: [{ kind: "he", intensity: 3, age: 0.1, life: 1 }],
  };
  assert.equal(canPresentGraftOffer(runtime), true);
  runtime.nutrientLevel = 2;
  assert.equal(canPresentGraftOffer(runtime), true);
  runtime.nutrientLevel = 3;
  assert.equal(canPresentGraftOffer(runtime), false);
  runtime.artillery = { stage: "incoming" };
  runtime.nutrientLevel = 0;
  assert.equal(canPresentGraftOffer(runtime), false);
});

test("blast spectacle leaves a tactical perimeter on short landscape screens", () => {
  assert.equal(tacticalExplosionRadiusCap(1000, 400, "he"), 88);
  assert.equal(tacticalExplosionRadiusCap(1000, 400, "artillery"), 108);
  assert.equal(tacticalExplosionRadiusCap(100, 100, "he"), 28);
});
