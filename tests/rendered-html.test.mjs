import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
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
  const html = await response.text();
  assert.match(html, developmentPreviewMeta);
  assert.match(
    html,
    /THROUGH(?:<!--.*?-->)?<br\s*\/?>(?:<!--.*?-->)?THE SLIT/i,
    "the first response must contain a visible briefing without waiting for hydration",
  );
});

test("ships the visible game shell in the initial client module graph", async () => {
  const clientAssets = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(clientAssets);
  const shellFile = files.find((file) => /^browser-shell-.*\.js$/.test(file));

  assert.ok(shellFile, "client game shell is missing");

  const shellSource = await readFile(new URL(shellFile, clientAssets), "utf8");

  assert.match(shellSource, /ENTER THE ARMOR/);
  assert.doesNotMatch(shellSource, /game-client-[\w-]+\.js/);
  assert.match(shellSource, /\/vendor\/three\/bootstrap\.js/);
  assert.doesNotMatch(
    shellSource,
    /\bimport\(/,
    "the engine must not use Vinext's broken production import wrapper",
  );
  await access(
    new URL("../dist/client/vendor/three/bootstrap.js", import.meta.url),
  );
  await access(
    new URL("../dist/client/vendor/three/three.module.min.js", import.meta.url),
  );
  await access(
    new URL("../dist/client/vendor/three/three.core.min.js", import.meta.url),
  );
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
