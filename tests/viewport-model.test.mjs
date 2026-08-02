import assert from "node:assert/strict";
import test from "node:test";

import { resolveGameViewport } from "../app/viewport-model.mjs";

test("fits Android landscape inside asymmetric system chrome", () => {
  const viewport = resolveGameViewport({
    innerWidth: 768,
    innerHeight: 345,
    visualViewport: {
      width: 678.5,
      height: 326.5,
      offsetLeft: 37.5,
      offsetTop: 0,
    },
  });

  assert.deepEqual(viewport, [678.5, 326.5]);
});

test("never expands beyond the layout viewport", () => {
  assert.deepEqual(
    resolveGameViewport({
      innerWidth: 720,
      innerHeight: 400,
      visualViewport: { width: 760, height: 420 },
    }),
    [720, 400],
  );
});

test("falls back safely while visual viewport values are transient", () => {
  assert.deepEqual(
    resolveGameViewport({
      innerWidth: 640,
      innerHeight: 360,
      visualViewport: { width: 0, height: Number.NaN },
    }),
    [640, 360],
  );
});
