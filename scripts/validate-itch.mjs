import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const rootUrl = new URL("../dist-itch/", import.meta.url);
const root = fileURLToPath(rootUrl);
const expectedIntroSha =
  "cabbd4a795db9b3ba44e75b222ca5d4bafccf6c70bcce32661a5c837d593607b";
const files = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else files.push(path);
  }
}

await walk(root);

if (!files.some((file) => relative(root, file) === "index.html")) {
  throw new Error("itch build is missing root index.html");
}

if (files.length > 1000) {
  throw new Error(`itch build has ${files.length} files; itch.io permits 1000`);
}

let totalBytes = 0;
for (const file of files) {
  const info = await stat(file);
  totalBytes += info.size;
  const name = relative(root, file);
  if (name.length > 240) throw new Error(`itch path exceeds 240 characters: ${name}`);
  if (info.size > 200 * 1024 * 1024) {
    throw new Error(`itch file exceeds 200 MB: ${name}`);
  }
}

if (totalBytes > 500 * 1024 * 1024) {
  throw new Error(`itch build exceeds 500 MB: ${totalBytes} bytes`);
}

const textFiles = files.filter((file) => /\.(?:html|css|js|mjs)$/u.test(file));
const forbiddenAbsoluteAsset =
  /(?:["'(=]|url\(["']?)\/(?:accessibility|captions|cinematics|ost|sfx|sprites|textures|vendor)\//u;

for (const file of textFiles) {
  const source = await readFile(file, "utf8");
  if (forbiddenAbsoluteAsset.test(source)) {
    throw new Error(`itch build contains an absolute local asset path: ${relative(root, file)}`);
  }
}

const intro = await readFile(
  new URL("cinematics/through-the-slit-intro-v4.mp4", rootUrl),
);
const introSha = createHash("sha256").update(intro).digest("hex");
if (introSha !== expectedIntroSha) {
  throw new Error(`intro SHA-256 mismatch: ${introSha}`);
}

console.log(
  JSON.stringify({
    status: "ready",
    entrypoint: "index.html",
    files: files.length,
    totalBytes,
    introSha,
  }),
);
