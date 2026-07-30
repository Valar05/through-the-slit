import { build } from "vite";

await build({
  configFile: false,
  publicDir: false,
  logLevel: "warn",
  build: {
    emptyOutDir: false,
    lib: {
      entry: new URL("./three-browser-entry.js", import.meta.url).pathname,
      formats: ["iife"],
      name: "ThroughTheSlitEngine",
      fileName: () => "engine-v9.js",
    },
    minify: "esbuild",
    outDir: new URL("../public/vendor/three", import.meta.url).pathname,
  },
});
