import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = join(root, "apps/studio/public");
const base = new URL(process.argv[2] ?? "http://127.0.0.1:5173");
const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });
try {
  await mkdir(destination, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(new URL("/harness.html", base).href);
  await page.waitForFunction(() => Boolean(window.blobnoise));
  const image = await page.evaluate(() => {
    const { createRenderer, createConfig } = window.blobnoise;
    const canvas = document.querySelector("canvas");
    const renderer = createRenderer(canvas, createConfig({ background: "transparent" }), {
      autoResize: false, pixelRatio: 1,
    });
    try {
      renderer.resize(512, 512, 1);
      renderer.renderAt(0);
      return canvas.toDataURL("image/png");
    } finally {
      renderer.dispose();
    }
  });
  await page.setContent(`<!doctype html><html lang="en"><head><meta charset="UTF-8">
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; width: 1200px; height: 630px; background: #141416; color: #eeeaf5;
        font-family: system-ui, sans-serif; display: grid; grid-template-columns: 1fr 500px; align-items: center; padding: 56px 60px; gap: 24px; }
      h1 { font-size: 84px; letter-spacing: -5px; margin: 0 0 24px; font-weight: 650; }
      p { margin: 0; font-size: 30px; line-height: 1.45; color: #c8c1d4; }
      .formats { font-size: 19px; margin-top: 32px; color: #aaa0bb; }
      img { width: 500px; height: 500px; }
    </style></head><body><div><h1>blobnoise</h1><p>Perlin noise textures<br>and animated 3D spheres</p>
    <p class="formats">Open source / WebP / WebM / JavaScript</p></div><img alt="" src="${image}"></body></html>`);
  await page.locator("img").evaluate(image => image.decode());
  await page.screenshot({ path: join(destination, "og-image.png") });
  const icon = await readFile(join(destination, "favicon.svg"), "utf8");
  await page.setViewportSize({ width: 180, height: 180 });
  await page.setContent(`<html><body style="margin:0;background:#141416">${icon}</body></html>`);
  await page.screenshot({ path: join(destination, "apple-touch-icon.png") });
  console.log("Generated original 1200x630 social card and 180x180 icon.");
} finally {
  await browser.close();
}
