import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const sourcePublic = join(projectRoot, "public");
const stagedPublic = join(projectRoot, ".crazygames-public");
const ostSource = join(sourcePublic, "ost");
const cinematicSource = join(sourcePublic, "cinematics", "through-the-slit-intro-v4.mp4");
const ignoredSourcePaths = new Set([
  ...readdirSync(ostSource).filter((name) => name.endsWith(".mp3")).map((name) => join(ostSource, name)),
  cinematicSource,
]);

function run(command, args) {
  execFileSync(command, args, { cwd: projectRoot, stdio: "inherit" });
}

rmSync(stagedPublic, { recursive: true, force: true });
cpSync(sourcePublic, stagedPublic, {
  recursive: true,
  filter: (source) => !ignoredSourcePaths.has(source),
});

const stagedOst = join(stagedPublic, "ost");
mkdirSync(stagedOst, { recursive: true });
for (const name of readdirSync(ostSource).filter((name) => name.endsWith(".mp3")).sort()) {
  run("ffmpeg", ["-nostdin", "-v", "error", "-y", "-i", join(ostSource, name), "-map_metadata", "0", "-codec:a", "libmp3lame", "-b:a", "88k", "-write_xing", "0", join(stagedOst, name)]);
}

const stagedCinematic = join(stagedPublic, "cinematics", "through-the-slit-intro-v4.mp4");
mkdirSync(dirname(stagedCinematic), { recursive: true });
run("ffmpeg", ["-nostdin", "-v", "error", "-y", "-i", cinematicSource, "-vf", "scale=640:-2:flags=lanczos,fps=12", "-c:v", "libx264", "-preset", "medium", "-crf", "32", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", stagedCinematic]);

if (process.argv.includes("--prepare-only")) {
  console.log(`prepared ${relative(projectRoot, stagedPublic)}`);
  process.exit(0);
}

run(join(projectRoot, "node_modules", ".bin", "vite"), ["build", "--config", "vite.crazygames.config.ts"]);
