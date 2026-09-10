import { expect, test, type Page } from "@playwright/test";
import type { BlobConfig } from "../packages/blobnoise/src/index";

const storageKey = "blobnoise.studio.config.v1";

async function savedConfig(page: Page): Promise<BlobConfig> {
  await expect(page.getByText("Saved locally", { exact: true })).toBeAttached();
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), storageKey);
}

async function setNumber(page: Page, label: string, value: string) {
  const input = page.getByRole("spinbutton", { name: label, exact: true });
  await input.fill(value);
  await input.press("Tab");
}

async function codeConfig(page: Page): Promise<BlobConfig> {
  await page.getByRole("button", { name: "Get code", exact: true }).click();
  const snippet = await page.getByRole("textbox", { name: "JavaScript snippet" }).inputValue();
  const config = JSON.parse(snippet.slice(snippet.indexOf("const config = ") + 15, snippet.indexOf(";\nconst canvas")));
  await page.getByRole("button", { name: "Close dialog" }).click();
  return config as BlobConfig;
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "blobnoise." })).toBeVisible();
});

test("preview, presets, matching motion modes, playback and scrub", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await expect(page.getByTestId("preview-canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Play animation" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Cloud preset" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Mist preset" }).click();
  await expect(page.getByRole("button", { name: "Plane", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Free", exact: true }).click();
  await page.getByRole("button", { name: "Sphere", exact: true }).click();
  let config = await savedConfig(page);
  expect(config.motion.mode).toBe("free");
  expect(config.surface.kind).toBe("sphere");
  if (config.surface.kind === "sphere") expect(config.surface.rotation.mode).toBe("free");
  await page.getByRole("button", { name: "Loop", exact: true }).click();
  config = await savedConfig(page);
  expect(config.motion.mode).toBe("loop");
  if (config.surface.kind === "sphere") expect(config.surface.rotation.mode).toBe("loop");
  await page.getByRole("slider", { name: "Scrub animation" }).fill("2.5");
  await expect(page.getByTestId("timecode")).toContainText("2.50");
  await page.getByRole("button", { name: "Play animation" }).click();
  await expect(page.getByRole("button", { name: "Pause animation" })).toBeEnabled();
  await expect.poll(async () => Number(await page.getByRole("slider", { name: "Scrub animation" }).inputValue())).not.toBe(2.5);
  await page.getByRole("button", { name: "Pause animation" }).click();
  await page.getByRole("button", { name: "Nebula preset" }).click();
  expect((await savedConfig(page)).seed).toBe(9317);
  expect(errors).toEqual([]);
});

test("palette anchors, validation, shuffle locks and history", async ({ page }) => {
  const original = await savedConfig(page);
  await page.getByRole("button", { name: "Add color stop" }).click();
  const added = await savedConfig(page);
  expect(added.material.palette).toHaveLength(5);
  expect(added.material.palette[0].position).toBe(0);
  expect(added.material.palette.at(-1)?.position).toBe(1);
  await expect(page.getByRole("spinbutton", { name: "Stop 1 position", exact: true })).toBeDisabled();
  await expect(page.getByRole("spinbutton", { name: "Stop 5 position", exact: true })).toBeDisabled();
  await setNumber(page, "Stop 2 position", "0");
  await expect(page.getByRole("alert")).toContainText("Palette stops must increase strictly");
  expect((await savedConfig(page)).material.palette).toEqual(added.material.palette);
  await setNumber(page, "Stop 2 position", "12");
  await page.getByRole("textbox", { name: "Color stop 2", exact: true }).fill("#AABBCC");
  await page.getByRole("textbox", { name: "Color stop 2", exact: true }).press("Tab");
  const edited = await savedConfig(page);
  expect(edited.material.palette[1]).toEqual({ position: 0.12, color: "#AABBCC" });
  await page.getByRole("button", { name: "Remove color stop 2" }).click();
  expect((await savedConfig(page)).material.palette).toHaveLength(4);
  await page.getByRole("button", { name: "Palette lock", exact: true }).click();
  const beforeShuffle = await savedConfig(page);
  await page.getByRole("button", { name: "Shuffle variation" }).click();
  const shuffled = await savedConfig(page);
  expect(shuffled.seed).not.toBe(beforeShuffle.seed);
  expect(shuffled.material.palette).toEqual(beforeShuffle.material.palette);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await savedConfig(page)).seed).toBe(beforeShuffle.seed);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect((await savedConfig(page)).seed).toBe(shuffled.seed);
  await page.getByRole("button", { name: "Reset to Cloud" }).click();
  expect(await savedConfig(page)).toEqual(original);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await savedConfig(page)).seed).toBe(shuffled.seed);
  await page.getByRole("button", { name: "Shape lock", exact: true }).click();
  await expect(page.getByRole("button", { name: "Shuffle variation" })).toBeDisabled();
  await page.getByRole("button", { name: "Palette lock", exact: true }).click();
  await page.getByRole("button", { name: "Shuffle variation" }).click();
  const paletteOnly = await savedConfig(page);
  expect(paletteOnly.seed).toBe(shuffled.seed);
  expect(paletteOnly.material.noise).toEqual(shuffled.material.noise);
  expect(paletteOnly.material.palette).not.toEqual(shuffled.material.palette);
});

test("invalid numbers and JSON leave the draft intact; valid imports are undoable", async ({ page }) => {
  const initial = await savedConfig(page);
  await setNumber(page, "Scale", "11");
  await expect(page.getByRole("alert")).toContainText("Use a number from 0.1 to 10");
  expect((await savedConfig(page)).material.noise.scale).toBe(initial.material.noise.scale);
  await setNumber(page, "Scale", "3");
  await page.getByRole("button", { name: "Import configuration" }).click();
  await page.getByRole("textbox", { name: "Configuration JSON" }).fill('{"seed":');
  await page.getByRole("button", { name: "Import config", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("not valid JSON");
  await page.getByRole("textbox", { name: "Configuration JSON" }).fill('{"motion":{"mode":"free"},"surface":{"kind":"sphere","rotation":{"mode":"loop"}}}');
  await page.getByRole("button", { name: "Import config", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("must both use free mode or both use loop mode");
  await page.getByRole("textbox", { name: "Configuration JSON" }).fill(JSON.stringify({ seed: 777 }));
  await page.getByRole("button", { name: "Import config", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect((await savedConfig(page)).seed).toBe(777);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  const undone = await savedConfig(page);
  expect(undone.seed).toBe(initial.seed);
  expect(undone.material.noise.scale).toBe(3);
  await page.getByRole("button", { name: "Import configuration" }).click();
  await page.getByLabel("Import JSON file").setInputFiles({
    name: "oversized.json", mimeType: "application/json", buffer: Buffer.from(" ".repeat(65_537)),
  });
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("64 KiB or smaller");
  await page.getByRole("button", { name: "Close dialog" }).click();
  expect((await savedConfig(page)).seed).toBe(initial.seed);
});

test("finish controls and sphere vectors stay inside the validated schema", async ({ page }) => {
  await page.locator("summary").filter({ hasText: /^Finish$/ }).click();
  await setNumber(page, "Grain amount", "0.12");
  await setNumber(page, "Grain size", "2.5");
  await page.getByRole("checkbox", { name: "Animated grain" }).check();
  await setNumber(page, "Glow", "0.4");
  await setNumber(page, "Exposure", "1.3");
  await setNumber(page, "Gradient strength", "0.5");
  await setNumber(page, "Gradient angle", "90");
  await page.locator("summary").filter({ hasText: /^Sphere$/ }).click();
  await setNumber(page, "Lighting", "0.6");
  await setNumber(page, "Rim light", "0.7");
  await setNumber(page, "Orientation Z", "25");
  await setNumber(page, "Axis Y", "0");
  await expect(page.getByRole("alert")).toContainText("Rotation axis must be nonzero");
  await setNumber(page, "Axis X", "1");
  await setNumber(page, "Axis Y", "0");
  await setNumber(page, "Rotation turns", "2");
  const config = await savedConfig(page);
  expect(config.material.grain).toEqual({ amount: 0.12, size: 2.5, animated: true });
  expect(config.material.glow.amount).toBe(0.4);
  expect(config.material.exposure).toBe(1.3);
  expect(config.material.gradient).toEqual({ strength: 0.5, angle: 90 });
  expect(config.surface).toMatchObject({
    kind: "sphere", lighting: { intensity: 0.6, rim: 0.7 },
    orientation: [0, 0, 25], rotation: { mode: "loop", axis: [1, 0, 0], turns: 2 },
  });
});

test("autosave survives reload and quota failures retain the editable draft", async ({ page }) => {
  await setNumber(page, "Seed", "54321");
  await savedConfig(page);
  await page.reload();
  await expect(page.getByRole("spinbutton", { name: "Seed", exact: true })).toHaveValue("54321");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new DOMException("Storage quota exceeded", "QuotaExceededError"); };
    (window as typeof window & { restoreStorage: () => void }).restoreStorage = () => { Storage.prototype.setItem = original; };
  });
  await setNumber(page, "Seed", "67890");
  await expect(page.getByRole("alert")).toContainText("Local autosave failed");
  await expect(page.getByRole("alert")).toContainText("Your draft is still open");
  expect((await codeConfig(page)).seed).toBe(67890);
  await page.evaluate(() => (window as typeof window & { restoreStorage: () => void }).restoreStorage());
  await page.getByRole("button", { name: "Retry save" }).click();
  expect((await savedConfig(page)).seed).toBe(67890);
  await expect(page.getByRole("alert")).not.toBeVisible();
});

test("corrupt local data is reported instead of being silently overwritten", async ({ page }) => {
  await savedConfig(page);
  await page.evaluate(key => localStorage.setItem(key, "not JSON"), storageKey);
  // Navigation flushes the current good draft, so inject corruption before the next app initialization.
  await page.addInitScript(key => localStorage.setItem(key, "not JSON"), storageKey);
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Could not restore the local draft");
  await expect(page.getByRole("spinbutton", { name: "Seed", exact: true })).toHaveValue("42");
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe("not JSON");
  await setNumber(page, "Seed", "111");
  expect((await savedConfig(page)).seed).toBe(111);
});

test("full code/config export and unavailable clipboard report honestly", async ({ page }) => {
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined }));
  await page.getByRole("button", { name: "Get code", exact: true }).click();
  const snippet = page.getByRole("textbox", { name: "JavaScript snippet" });
  await expect(snippet).toContainText('import { createRenderer } from "blobnoise/browser"');
  await expect(snippet).toContainText('"algorithmVersion": "perlin-v1"');
  await expect(snippet).toContainText("renderer.dispose()");
  await page.getByRole("button", { name: "Copy JavaScript" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Clipboard is unavailable");
  await expect(page.getByRole("button", { name: "Copied!" })).not.toBeVisible();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download config", exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("blobnoise-42.json");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const config = JSON.parse(Buffer.concat(chunks).toString("utf8")) as BlobConfig;
  expect(config.schemaVersion).toBe(1);
  expect(config.material.palette[0].position).toBe(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Get code", exact: true })).toBeFocused();
});

test("still export offers transparency and video validates dimensions, FPS and duration", async ({ page }) => {
  const original = await savedConfig(page);
  await page.getByRole("slider", { name: "Scrub animation" }).fill("2");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: "512 square" }).click();
  await page.getByRole("checkbox", { name: "Transparent WebP" }).check();
  await expect(page.getByText("Still frame at 2.00s.", { exact: false })).toBeVisible();
  const stillButton = page.getByRole("button", { name: "Export WebP", exact: true });
  await expect(stillButton).toBeEnabled({ timeout: 30_000 });
  const downloading = page.waitForEvent("download");
  await stillButton.click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("blobnoise-42-512x512.webp");
  expect(await download.failure()).toBeNull();
  expect(await savedConfig(page)).toEqual(original);

  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: /^WebM Keep/ }).click();
  await expect(page.getByRole("spinbutton", { name: "Duration (seconds)" })).toHaveJSProperty("readOnly", true);
  await expect(page.getByRole("spinbutton", { name: "Duration (seconds)" })).toHaveValue("8");
  await expect(page.getByText("Duration matches your draft exactly.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  expect(await savedConfig(page)).toEqual(original);
  await page.getByRole("button", { name: "Free", exact: true }).click();
  const freeConfig = await savedConfig(page);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: /^WebM Keep/ }).click();
  await expect(page.getByRole("spinbutton", { name: "Duration (seconds)" })).toBeEditable();
  await expect(page.getByRole("textbox", { name: "Export background", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Frame rate" }).selectOption("24");
  await page.getByRole("spinbutton", { name: "Duration (seconds)" }).fill("21");
  await expect(page.getByRole("alert")).toContainText("Use 1–20 seconds");
  await expect(page.getByRole("button", { name: "Export WebM", exact: true })).toBeDisabled();
  await page.getByRole("spinbutton", { name: "Duration (seconds)" }).fill("1");
  await page.getByRole("spinbutton", { name: "Width", exact: true }).fill("0");
  await expect(page.getByRole("alert")).toContainText("whole numbers from 1 to 4096");
  await page.getByRole("button", { name: "512 square" }).click();
  await expect(page.getByText("Video starts at time zero.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  expect(await savedConfig(page)).toEqual(freeConfig);
});

test("video export progress can be canceled without changing the draft", async ({ page }) => {
  await page.getByRole("button", { name: "Free", exact: true }).click();
  const original = await savedConfig(page);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: /^WebM Keep/ }).click();
  await page.getByRole("button", { name: "512 square" }).click();
  await page.getByRole("spinbutton", { name: "Duration (seconds)" }).fill("20");
  await expect(page.getByRole("dialog").getByRole("status")).not.toContainText("Checking", { timeout: 30_000 });
  const button = page.getByRole("button", { name: "Export WebM", exact: true });
  if (await button.isDisabled()) {
    await expect(page.getByRole("dialog").getByRole("status")).toContainText(/unavailable|support|encoder|WebCodecs/i);
    return;
  }
  await button.click();
  await expect(page.getByRole("progressbar", { name: "Export progress" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel export" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Export canceled", { timeout: 30_000 });
  await expect(button).toBeEnabled();
  await page.getByRole("button", { name: "Close dialog" }).click();
  expect(await savedConfig(page)).toEqual(original);
});

test("video downloads with the chosen background and the exact draft loop duration", async ({ page }) => {
  await setNumber(page, "Loop duration", "1");
  const original = await savedConfig(page);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("button", { name: /^WebM Keep/ }).click();
  await page.getByRole("spinbutton", { name: "Width", exact: true }).fill("64");
  await page.getByRole("spinbutton", { name: "Height", exact: true }).fill("64");
  await page.getByRole("combobox", { name: "Frame rate" }).selectOption("24");
  await expect(page.getByRole("spinbutton", { name: "Duration (seconds)" })).toHaveValue("1");
  await expect(page.getByRole("spinbutton", { name: "Duration (seconds)" })).toHaveJSProperty("readOnly", true);
  await expect(page.getByRole("dialog").getByRole("status")).not.toContainText("Checking", { timeout: 30_000 });
  const button = page.getByRole("button", { name: "Export WebM", exact: true });
  if (await button.isDisabled()) {
    await expect(page.getByRole("dialog").getByRole("status")).toContainText(/unavailable|support|encoder|WebCodecs/i);
    return;
  }
  await page.getByRole("textbox", { name: "Export background", exact: true }).fill("invalid");
  await page.getByRole("textbox", { name: "Export background", exact: true }).press("Tab");
  await expect(button).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("six-digit hex");
  await page.getByRole("textbox", { name: "Export background", exact: true }).fill("#112233");
  await page.getByRole("textbox", { name: "Export background", exact: true }).press("Tab");
  const downloading = page.waitForEvent("download");
  await button.click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("blobnoise-42-64x64.webm");
  expect(await download.failure()).toBeNull();
  const chunks: Buffer[] = [];
  for await (const chunk of await download.createReadStream()) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).subarray(0, 4).toString("hex")).toBe("1a45dfa3");
  expect(await savedConfig(page)).toEqual(original);
});

test("mobile layout is contained and controls remain keyboard reachable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("preview-canvas")).toBeVisible();
  await expect(page.getByRole("link", { name: "Controls", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Controls", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Make some noise." })).toBeInViewport();
  await setNumber(page, "Scale", "3.5");
  expect((await savedConfig(page)).material.noise.scale).toBe(3.5);
  await expect(page.getByRole("button", { name: "Play animation" })).toBeAttached();
});
