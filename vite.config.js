import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths, so the built site works from any sub-path -
  // a GitHub Pages project URL, a StackBlitz preview, or a plain file server.
  base: "./",
  build: {
    outDir: "dist",
    target: "es2020"
  }
});
