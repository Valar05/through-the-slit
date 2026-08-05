import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CARE_AUDIO_POLICY,
  CARE_SEQUENCE,
  FERRAVINE_CARE_CUES,
  RENEE_HUM_LOOPS,
} from "../app/care-audio.mjs";

test("the playable tending slice preserves every commissioned audio layer", async () => {
  assert.equal(CARE_AUDIO_POLICY.bodyCueCount, 12);
  assert.equal(CARE_AUDIO_POLICY.hummingLoopCount, 3);
  assert.equal(CARE_AUDIO_POLICY.twoTapMotif, true);
  assert.equal(CARE_AUDIO_POLICY.hummingStatus, "accepted-by-drew-sequenced-only");
  assert.match(CARE_AUDIO_POLICY.mixPolicy, /never simultaneous/);
  assert.equal(CARE_SEQUENCE.length, 9);
  const usedBodies = new Set(CARE_SEQUENCE.flatMap((step) => step.bodyCues));
  assert.deepEqual([...usedBodies].sort(), Object.keys(FERRAVINE_CARE_CUES).sort());
  assert.ok(CARE_SEQUENCE.some((step) => step.careFoley === "two-tap"));
  assert.ok(CARE_SEQUENCE.some((step) => step.careFoley === "cloth"));
  assert.ok(CARE_SEQUENCE.some((step) => step.careFoley === "nails"));
  assert.ok(CARE_SEQUENCE.some((step) => step.careFoley === "tools"));
  assert.ok(CARE_SEQUENCE.some((step) => step.careFoley === "breath"));

  for (const loop of Object.values(RENEE_HUM_LOOPS)) {
    const asset = new URL(`../public/${loop.path.replace("./", "")}`, import.meta.url);
    assert.equal(existsSync(asset), true, `missing ${loop.path}`);
    assert.ok(statSync(asset).size > 30_000, `${loop.path} is implausibly small`);
  }

  const [gameSource, soundSource] = await Promise.all([
    readFile(new URL("../app/game-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/sound-engine.ts", import.meta.url), "utf8"),
  ]);
  assert.match(gameSource, /TEND FERRAVINE/);
  assert.match(gameSource, /CARE_SEQUENCE/);
  assert.match(gameSource, /data-ferravine-care-cues/);
  assert.match(gameSource, /data-renee-humming-loops/);
  for (const id of Object.keys(FERRAVINE_CARE_CUES)) {
    assert.match(soundSource, new RegExp(`case "${id}"`));
  }
  assert.match(soundSource, /playReneeCareFoley/);
  assert.match(soundSource, /playReneeHum/);
  assert.match(soundSource, /activeReneeSource/);
  assert.match(gameSource, /voiceDelayMs/);
  assert.match(gameSource, /bodyDurationMs/);
});
