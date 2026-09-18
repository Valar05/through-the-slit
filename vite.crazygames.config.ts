import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "itch",
  base: "./",
  publicDir: "../.crazygames-public",
  plugins: [react()],
  build: {
    outDir: "../dist-crazygames",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
    assetsInlineLimit: 0,
  },
});
