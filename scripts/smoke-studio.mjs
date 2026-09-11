import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

if (!process.argv[2]) throw new Error("Usage: node scripts/smoke-studio.mjs https://STUDIO_HOST");
const target = new URL(process.argv[2]);
if (!["https:", "http:"].includes(target.protocol)) throw new Error("Expected an HTTP(S) studio URL");
const browser = await chromium.launch({ args: ["--enable-unsafe-swiftshader"] });

async function downloadBytes(page, buttonName) {
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: buttonName, exact: true }).click();
  const download = await waiting;
  assert.equal(await download.failure(), null);
  const stream = await download.createReadStream();
  if (!stream) throw new Error("Download did not provide a readable file");
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  const response = await page.goto(target.href);
  assert.equal(response?.status(), 200);
  assert.ok((await response.text()).includes("Perlin noise texture and 3D sphere generator"));
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://d16acm1lzz4dn2.cloudfront.net/");
  await expect(page.getByRole("link", { name: "View source on GitHub", exact: true }))
    .toHaveAttribute("href", "https://github.com/alejo-valencia/blobnoise");
  await expect(page.getByRole("button", { name: "Play animation", exact: true })).toBeEnabled();
  await expect(page.getByRole("heading", { name: "blobnoise." })).toBeVisible();
  await page.getByRole("button", { name: "Get code", exact: true }).click();
  const snippet = await page.getByRole("textbox", { name: "JavaScript snippet" }).inputValue();
  assert.ok(snippet.includes('from "@alejo-valencia/blobnoise/browser"'));
  await expect(page.getByRole("dialog")).toContainText("GitHub Packages");
  await expect(page.getByRole("link", { name: "Package setup" }))
    .toHaveAttribute("href", "https://github.com/alejo-valencia/blobnoise#install-the-package");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.locator("body")).not.toContainText("Made of math. Shaped by you.");
  await expect(page.locator("body")).not.toContainText("A playground for the in-between");
  await expect(page.locator("body")).not.toContainText("EXPERIMENT 001");
  await expect(page.getByText("Saved locally", { exact: true })).toBeAttached();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("blobnoise.studio.config.v1")));
  await page.getByRole("button", { name: "Randomize colors", exact: true }).click();
  await expect(page.getByText("Saved locally", { exact: true })).toBeAttached();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("blobnoise.studio.config.v1")));
  assert.notDeepEqual(after.material.palette, before.material.palette);
  assert.deepEqual(after.material.palette.map(stop => stop.position), before.material.palette.map(stop => stop.position));
  assert.deepEqual({ ...after, material: { ...after.material, palette: before.material.palette } }, before);
  const duration = page.getByRole("spinbutton", { name: "Loop duration", exact: true });
  await duration.fill("1");
  await duration.press("Tab");
  await expect(page.getByText("Saved locally", { exact: true })).toBeAttached();

  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("spinbutton", { name: "Width", exact: true }).fill("128");
  await page.getByRole("spinbutton", { name: "Height", exact: true }).fill("128");
  await page.getByRole("checkbox", { name: "Transparent WebP" }).check();
  await expect(page.getByRole("button", { name: "Export WebP", exact: true })).toBeEnabled({ timeout: 30_000 });
  const still = await downloadBytes(page, "Export WebP");
  assert.equal(still.subarray(0, 4).toString(), "RIFF");
  assert.equal(still.subarray(8, 12).toString(), "WEBP");

  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: "WebM video", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "Duration (seconds)" })).toHaveValue("1");
  await page.getByRole("spinbutton", { name: "Width", exact: true }).fill("128");
  await page.getByRole("spinbutton", { name: "Height", exact: true }).fill("128");
  await page.getByRole("combobox", { name: "Frame rate" }).selectOption("24");
  await expect(page.getByRole("button", { name: "Export WebM", exact: true })).toBeEnabled({ timeout: 30_000 });
  const video = await downloadBytes(page, "Export WebM");
  assert.deepEqual(video.subarray(0, 4), Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  const media = await page.evaluate(async bytes => {
    const element = document.createElement("video");
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "video/webm" }));
    try {
      return await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Exported video did not decode")), 15_000);
        element.onloadeddata = () => {
          clearTimeout(timeout);
          resolve({ width: element.videoWidth, height: element.videoHeight, duration: element.duration });
        };
        element.onerror = () => {
          clearTimeout(timeout);
          reject(new Error(element.error?.message ?? "Exported video failed to decode"));
        };
        element.preload = "auto";
        element.src = url;
      });
    } finally {
      element.removeAttribute("src");
      element.load();
      URL.revokeObjectURL(url);
    }
  }, [...video]);
  assert.equal(media.width, 128);
  assert.equal(media.height, 128);
  assert.ok(Math.abs(media.duration - 1) < 0.05);
  assert.deepEqual(errors, []);
  const noScript = await browser.newPage({ javaScriptEnabled: false });
  await noScript.goto(target.href);
  await expect(noScript.locator(".site-info")).toContainText("WebP images or WebM loops");
  await noScript.close();
  const robots = await fetch(new URL("/robots.txt", target));
  assert.equal(robots.status, 200);
  assert.ok((await robots.text()).includes("Sitemap: https://d16acm1lzz4dn2.cloudfront.net/sitemap.xml"));
  const sitemap = await fetch(new URL("/sitemap.xml", target));
  assert.equal(sitemap.status, 200);
  assert.ok((await sitemap.text()).includes("<loc>https://d16acm1lzz4dn2.cloudfront.net/</loc>"));
  const social = await fetch(new URL("/og-image.png", target));
  assert.equal(social.status, 200);
  const socialBytes = Buffer.from(await social.arrayBuffer());
  assert.equal(socialBytes.readUInt32BE(16), 1200);
  assert.equal(socialBytes.readUInt32BE(20), 630);
  assert.equal((await fetch(new URL("/this-page-does-not-exist", target))).status, 404);
  console.log(JSON.stringify({
    url: target.href, webpBytes: still.length, webmBytes: video.length, video: media, runtimeErrors: errors,
  }, null, 2));
} finally {
  await browser.close();
}
