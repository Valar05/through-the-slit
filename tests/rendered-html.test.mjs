import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("ships the battlefield engine through the normal client module graph", async () => {
  const clientAssets = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(clientAssets);
  const gameFile = files.find((file) => /^game-client-.*\.js$/.test(file));

  assert.ok(gameFile, "client game bundle is missing");

  const gameSource = await readFile(new URL(gameFile, clientAssets), "utf8");

  assert.doesNotMatch(gameSource, /three\.module-[\w-]+\.js/);
  assert.doesNotMatch(gameSource, /import\([a-zA-Z_$][\w$]*\)/);
  assert.match(gameSource, /WebGLRenderer/);
});

test("keeps Three.js out of the Cloudflare Worker module scope", async () => {
  const serverAssets = new URL("../dist/server/ssr/assets/", import.meta.url);
  const files = (await readdir(serverAssets)).filter(
    (file) => /^browser-shell-.*\.js$/.test(file),
  );
  assert.ok(files.length > 0, "browser-only shell is missing from the SSR build");

  const sources = await Promise.all(
    files.map((file) => readFile(new URL(file, serverAssets), "utf8")),
  );
  const serverSource = sources.join("\n");

  assert.doesNotMatch(
    serverSource,
    /\bnew LoadingManager\b/,
    "Three.js LoadingManager leaked into the Worker bundle",
  );
  assert.doesNotMatch(
    serverSource,
    /\bnew WebGLRenderer\b/,
    "Three.js renderer leaked into the Worker bundle",
  );
});
