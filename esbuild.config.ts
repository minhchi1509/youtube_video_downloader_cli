import * as esbuild from "esbuild";

async function build() {
  // Build CJS version
  await esbuild.build({
    entryPoints: ["src/main.ts"],
    bundle: true,
    outfile: "dist/index.cjs",
    format: "cjs",
    platform: "node",
    tsconfig: "tsconfig.json",
    banner: {
      js: "#!/usr/bin/env node",
    },
    minify: true,
  });
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
