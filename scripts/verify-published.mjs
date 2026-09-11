import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(join(root, "packages/blobnoise/package.json"), "utf8"));
assert.equal(manifest.name, "@alejo-valencia/blobnoise");
const consumer = await mkdtemp(join(tmpdir(), "blobnoise-registry-"));

try {
  await writeFile(join(consumer, "package.json"), JSON.stringify({ private: true, type: "module" }));
  await writeFile(join(consumer, ".npmrc"), "@alejo-valencia:registry=https://npm.pkg.github.com\n");
  execFileSync("npm", [
    "install", "--ignore-scripts", "--no-audit", "--no-fund",
    `${manifest.name}@${manifest.version}`, "react@19.3.0", "@types/react@19.3.0",
  ], { cwd: consumer, stdio: "inherit" });
  const lock = JSON.parse(await readFile(join(consumer, "package-lock.json"), "utf8"));
  const installed = lock.packages["node_modules/@alejo-valencia/blobnoise"];
  assert.equal(installed.version, manifest.version);
  assert.equal(new URL(installed.resolved).hostname, "npm.pkg.github.com");

  execFileSync(process.execPath, ["--input-type=module", "-e", `
    import assert from "node:assert/strict";
    import { createConfig, createSnippet, parseConfig, serializeConfig } from "@alejo-valencia/blobnoise";
    import { createRenderer } from "@alejo-valencia/blobnoise/browser";
    import { exportWebP, exportWebM } from "@alejo-valencia/blobnoise/export";
    import { BlobNoise } from "@alejo-valencia/blobnoise/react";
    const config = createConfig();
    assert.equal(config.seed, 42);
    assert.deepEqual(parseConfig(serializeConfig(config)), config);
    assert.ok(createSnippet(config).includes('from "@alejo-valencia/blobnoise/browser"'));
    assert.equal(typeof createRenderer, "function");
    assert.equal(typeof exportWebP, "function");
    assert.equal(typeof exportWebM, "function");
    assert.ok(BlobNoise);
    console.log("Published package imports and configuration contracts passed.");
  `], { cwd: consumer, stdio: "inherit" });

  await writeFile(join(consumer, "consumer.ts"), `
    import { createConfig, type BlobConfig } from "@alejo-valencia/blobnoise";
    import { createRenderer, type BlobRenderer } from "@alejo-valencia/blobnoise/browser";
    import { exportWebP, exportWebM } from "@alejo-valencia/blobnoise/export";
    import { BlobNoise, type BlobNoiseProps } from "@alejo-valencia/blobnoise/react";
    const config: BlobConfig = createConfig();
    const factory: (canvas: HTMLCanvasElement) => BlobRenderer = canvas => createRenderer(canvas, config);
    const image: Promise<Blob> = exportWebP(config, {width: 128, height: 128});
    const video: Promise<Blob> = exportWebM(config, {width: 128, height: 128});
    const props: BlobNoiseProps = {config, playing: false};
    void [factory, image, video, props, BlobNoise];
  `);
  execFileSync(join(root, "node_modules/.bin/tsc"), [
    "--strict", "--noEmit", "--skipLibCheck", "--target", "ES2022",
    "--lib", "ES2022,DOM", "--module", "NodeNext", "--moduleResolution", "NodeNext",
    join(consumer, "consumer.ts"),
  ], { cwd: consumer, stdio: "inherit" });
  console.log(`Verified ${manifest.name}@${manifest.version} installed from GitHub Packages.`);
} finally {
  await rm(consumer, { recursive: true, force: true });
}
