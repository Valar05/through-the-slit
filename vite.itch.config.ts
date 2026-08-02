import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "itch",
  base: "./",
  publicDir: "../public",
  plugins: [react()],
  build: {
    outDir: "../dist-itch",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
    assetsInlineLimit: 0,
  },
});
