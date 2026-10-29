// Bundles the MIT PR Lens renderer as one inlineable script (a `PrLens` global)
// for the viewer page. `render()` never hashes, but the package imports
// node:crypto at module scope for its manifest path, so the browser build gets a
// throwing stub in its place.
import { defineConfig } from "vite";
export default defineConfig({
  resolve: { alias: { "node:crypto": new URL("./crypto-stub.js", import.meta.url).pathname } },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: { entry: "lib.js", name: "PrLens", formats: ["iife"], fileName: () => "pr-lens.iife.js" },
  },
});
