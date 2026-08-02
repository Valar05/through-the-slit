import assert from "node:assert/strict";
import test from "node:test";

import {
  ENEMY_ATLAS_POSE_RECTS,
  THREAT_ATLAS_POSE_RECTS,
  enemyCorpseCell,
} from "../app/sprite-atlas-model.mjs";

const ATLAS_WIDTH = 1448;
const ATLAS_HEIGHT = 1086;

test("every enemy pose owns a bounded clean extraction window", () => {
  for (const rects of [ENEMY_ATLAS_POSE_RECTS, THREAT_ATLAS_POSE_RECTS]) {
    assert.deepEqual(Object.keys(rects).map(Number), [...Array(12).keys()]);
    for (const rect of Object.values(rects)) {
      assert.ok(rect.x >= 0 && rect.y >= 0);
      assert.ok(rect.x + rect.width <= ATLAS_WIDTH);
      assert.ok(rect.y + rect.height <= ATLAS_HEIGHT);
    }
  }
});

test("enemy deaths cannot select standing boots or the tank tableau", () => {
  const normal = new Set();
  const crushed = new Set();
  for (let id = 0; id < 32; id += 1) {
    normal.add(enemyCorpseCell(id, false));
    crushed.add(enemyCorpseCell(id, true));
  }
  assert.deepEqual([...normal].sort(), [4, 5]);
  assert.deepEqual([...crushed].sort(), [5, 7]);
  assert.equal(normal.has(6), false);
  assert.equal(crushed.has(6), false);
});
