import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  outDir: "dist",
  loader: {
    ".md": "text",
    ".mdc": "text",
  },
  // Bundle @figdeck/shared into the output (not published to npm)
  noExternal: ["@figdeck/shared"],
});
