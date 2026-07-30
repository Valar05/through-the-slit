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

test("ships the battlefield engine as a browser-loadable asset", async () => {
  const clientAssets = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(clientAssets);
  const pageFile = files.find((file) => /^page-.*\.js$/.test(file));
  const threeFile = files.find((file) => /^three\.module-.*\.js$/.test(file));

  assert.ok(pageFile, "client page bundle is missing");
  assert.ok(threeFile, "Three.js browser asset is missing");

  const [pageSource, threeSource] = await Promise.all([
    readFile(new URL(pageFile, clientAssets), "utf8"),
    readFile(new URL(threeFile, clientAssets), "utf8"),
  ]);

  assert.match(pageSource, new RegExp(`/assets/${threeFile.replaceAll(".", "\\.")}`));
  assert.match(pageSource, /import\([a-zA-Z_$][\w$]*\)/);
  assert.match(threeSource, /\bWebGLRenderer\b/);
});
