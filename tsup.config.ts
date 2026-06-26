import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  format: ["cjs"],
  outDir: "dist",
  bundle: true,
  platform: "node",
  minify: true,
  clean: true,
  shims: false,
  noExternal: [/.*/],
  banner: {
    js: "#!/usr/bin/env node",
  },
});
