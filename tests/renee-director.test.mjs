import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import test from "node:test";
import { RENEE_CUES, RENEE_POLICY, ReneeDirector } from "../app/renee-director.mjs";

const baseline = {
  forwardVelocity: 0,
  core: 100,
  front: 100,
  leftTread: 100,
  rightTread: 100,
  suppression: 0,
  formationState: "connected",
};

test("Renee manifest is complete, captioned, state-driven, and asset-backed", () => {
  const cues = Object.values(RENEE_CUES);
  assert.equal(cues.length, 29);
  assert.equal(RENEE_POLICY.randomChatter, false);
  assert.equal(RENEE_POLICY.semanticCaptions, true);
  assert.equal(RENEE_POLICY.triggerModel, "authored-events-and-state-transitions-only");
  assert.equal(RENEE_POLICY.castingStatus, "accepted-by-drew");
  assert.equal(RENEE_POLICY.postSpeechGapSeconds, 2.5);
  assert.equal(new Set(cues.map((cue) => cue.path)).size, cues.length);
  for (const cue of cues) {
    assert.ok(cue.text.length >= 20, `${cue.id} needs a meaningful semantic caption`);
    assert.ok(cue.duration > 1);
    const asset = new URL(`../public/${cue.path.replace("./", "")}`, import.meta.url);
    assert.equal(existsSync(asset), true, `missing ${cue.path}`);
    assert.ok(statSync(asset).size > 100_000, `${cue.path} is implausibly small`);
  }
});

test("state transitions speak once without a chatter timer", () => {
  const emitted = [];
  const director = new ReneeDirector((cue) => emitted.push(cue.id));
  director.sync(baseline, 0);
  director.sync({ ...baseline, forwardVelocity: 12 }, 2);
  director.sync({ ...baseline, forwardVelocity: 20 }, 4);
  assert.deepEqual(emitted, ["first-motion"]);
});

test("Renee waits for the active line and a quiet beat before speaking again", () => {
  const emitted = [];
  const director = new ReneeDirector((cue) => emitted.push(cue.id));
  assert.equal(director.signal("small-arms", 1, true), true);
  assert.equal(director.signal("armor-bounce", 1.2), false);
  assert.equal(director.signal("artillery-incoming", 1.3), false);
  assert.equal(director.flush(6), false);
  assert.equal(director.flush(7.7), true);
  assert.deepEqual(emitted, ["small-arms", "artillery-incoming"]);
});

test("critical damage wins when several state transitions arrive together", () => {
  const emitted = [];
  const director = new ReneeDirector((cue) => emitted.push(cue.id));
  director.sync(baseline, 0);
  director.sync(
    {
      ...baseline,
      core: 30,
      front: 50,
      suppression: 80,
      formationState: "separated",
    },
    2,
  );
  assert.equal(emitted[0], "core-critical");
  assert.equal(director.flush(8.4), false);
  assert.equal(director.flush(8.5), true);
  assert.equal(emitted[1], "front-wound");
});

test("Renee can be disabled independently", () => {
  const emitted = [];
  const director = new ReneeDirector((cue) => emitted.push(cue.id));
  director.setEnabled(false);
  assert.equal(director.signal("wake", 0, true), false);
  director.sync(baseline, 0);
  director.sync({ ...baseline, core: 20 }, 2);
  assert.deepEqual(emitted, []);
});
