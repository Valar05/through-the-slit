import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../dist-crazygames/", import.meta.url));
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else files.push(path);
  }
}
await walk(root);
if (!files.some((file) => relative(root, file) === "index.html")) throw new Error("CrazyGames build is missing root index.html");
const totalBytes = (await Promise.all(files.map((file) => stat(file)))).reduce((total, info) => total + info.size, 0);
const limit = 50 * 1024 * 1024;
if (totalBytes > limit) throw new Error(`CrazyGames build exceeds 50 MiB: ${totalBytes} bytes`);
console.log(JSON.stringify({ status: "ready", entrypoint: "index.html", files: files.length, totalBytes, limit }));
