import { expect, test } from "@playwright/test";
import type {} from "../apps/studio/src/harness";

test.beforeEach(async ({ page }) => {
  await page.goto("/harness.html");
  await page.waitForFunction(() => !!window.blobnoise);
});

test("renders original Perlin colors and a transparent actual sphere", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  const result = await page.evaluate(() => {
    const { createRenderer, createConfig } = window.blobnoise;
    const canvas = document.querySelector("canvas")!;
    const renderer = createRenderer(canvas, createConfig({
      background: "transparent", material: { glow: { amount: 0 } },
    }), { autoResize: false, pixelRatio: 1 });
    const gl = canvas.getContext("webgl2")!;
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const center = (256 * canvas.width + 256) * 4;
    const opaque = Array.from(pixels).filter((_, i) => i % 4 === 3 && pixels[i] === 255).length;
    const unique = new Set<string>();
    for (let i = 0; i < pixels.length; i += 64) {
      if (pixels[i + 3]) unique.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    }
    const value = { corner: pixels[3], center: Array.from(pixels.slice(center, center + 4)),
      opaque, colors: unique.size, glError: gl.getError() };
    renderer.dispose();
    return value;
  });
  expect(errors).toEqual([]);
  expect(result.glError).toBe(0);
  expect(result.corner).toBe(0);
  expect(result.center[3]).toBe(255);
  expect(result.colors).toBeGreaterThan(200);
  expect(result.opaque).toBeGreaterThan(100_000);
  expect(result.opaque).toBeLessThan(180_000);
});

test("same seed/time is order independent and both animations loop", async ({ page }) => {
  const result = await page.evaluate(() => {
    const { createConfig, createRenderer } = window.blobnoise;
    const canvas = document.querySelector("canvas")!;
    const config = createConfig({ material: { grain: { animated: true } } });
    const renderer = createRenderer(canvas, config, { autoResize: false, pixelRatio: 1 });
    renderer.resize(192, 192, 1);
    const gl = canvas.getContext("webgl2")!;
    function snapshot(time: number) {
      renderer.renderAt(time);
      const bytes = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      return bytes;
    }
    const start = snapshot(0);
    const middle = snapshot(2);
    snapshot(7);
    const again = snapshot(2);
    const end = snapshot(8);
    const difference = (a: Uint8Array, b: Uint8Array) =>
      a.reduce((total, byte, i) => total + Math.abs(byte - b[i]), 0);
    renderer.setConfig({ ...config, seed: 0xffffffff });
    const reseeded = snapshot(0);
    const value = {
      order: difference(middle, again), loop: difference(start, end), motion: difference(start, middle),
      seed: difference(start, reseeded),
    };
    renderer.dispose();
    return value;
  });
  expect(result.order).toBe(0);
  expect(result.loop).toBe(0);
  expect(result.motion).toBeGreaterThan(100_000);
  expect(result.seed).toBeGreaterThan(100_000);
});

test("switches projections, rejects bad updates and disposes safely", async ({ page }) => {
  const result = await page.evaluate(() => {
    const { createConfig, createRenderer } = window.blobnoise;
    const canvas = document.querySelector("canvas")!;
    const renderer = createRenderer(canvas, {}, { autoResize: false, pixelRatio: 1 });
    renderer.resize(256, 128, 1);
    renderer.setConfig(createConfig({ surface: { kind: "texture", projection: "equirectangular" } }));
    renderer.renderAt(1);
    const width = canvas.width;
    let invalid = false;
    try { renderer.setConfig({ seed: -1 }); } catch { invalid = true; }
    renderer.renderAt(0);
    renderer.play();
    renderer.pause();
    const paused = !renderer.playing;
    renderer.dispose();
    renderer.dispose();
    let disposed = false;
    try { renderer.renderAt(0); } catch { disposed = true; }
    return { width, invalid, disposed, paused };
  });
  expect(result).toEqual({ width: 256, invalid: true, disposed: true, paused: true });
});

test("context loss is surfaced and a paused renderer restores safely", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const canvas = document.querySelector("canvas")!;
    const errors: string[] = [];
    const renderer = window.blobnoise.createRenderer(canvas, {}, {
      autoResize: false, pixelRatio: 1, onError: error => errors.push(error.message),
    });
    const gl = canvas.getContext("webgl2")!;
    const extension = gl.getExtension("WEBGL_lose_context")!;
    renderer.play();
    extension.loseContext();
    await new Promise(resolve => setTimeout(resolve, 150));
    renderer.pause();
    extension.restoreContext();
    await new Promise(resolve => setTimeout(resolve, 200));
    renderer.renderAt(0);
    const value = { errors, lost: gl.isContextLost(), playing: renderer.playing };
    renderer.dispose();
    return value;
  });
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0]).toContain("context lost");
  expect(result.lost).toBe(false);
  expect(result.playing).toBe(false);
});

test("a disposed canvas can be immediately reused by a framework remount", async ({ page }) => {
  const value = await page.evaluate(() => {
    const canvas = document.querySelector("canvas")!;
    const first = window.blobnoise.createRenderer(canvas, {}, { autoResize: false, pixelRatio: 1 });
    first.dispose();
    const second = window.blobnoise.createRenderer(canvas, {}, { autoResize: false, pixelRatio: 1 });
    second.renderAt(1);
    const lost = canvas.getContext("webgl2")!.isContextLost();
    second.dispose();
    return lost;
  });
  expect(value).toBe(false);
});

test("rotation and evolution can be stopped independently", async ({ page }) => {
  const result = await page.evaluate(() => {
    const { createRenderer, createConfig } = window.blobnoise;
    const canvas = document.querySelector("canvas")!;
    const renderer = createRenderer(canvas, {}, { autoResize: false, pixelRatio: 1 });
    renderer.resize(128, 128, 1);
    const gl = canvas.getContext("webgl2")!;
    function difference(input: unknown) {
      renderer.setConfig(createConfig(input));
      const pixels = () => {
        const bytes = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
        return bytes;
      };
      renderer.renderAt(0); const start = pixels();
      renderer.renderAt(2); const end = pixels();
      return start.reduce((sum, byte, i) => sum + Math.abs(byte - end[i]), 0);
    }
    const rotation = difference({ motion: { mode: "loop", evolution: { amount: 0 } } });
    const evolution = difference({ surface: { kind: "sphere", rotation: { mode: "loop", turns: 0 } } });
    const still = difference({
      surface: { kind: "sphere", rotation: { mode: "loop", turns: 0 } },
      motion: { mode: "loop", evolution: { amount: 0 } },
    });
    renderer.dispose();
    return { rotation, evolution, still };
  });
  expect(result.rotation).toBeGreaterThan(10_000);
  expect(result.evolution).toBeGreaterThan(10_000);
  expect(result.still).toBe(0);
});

test("configuration failures do not silently replace a requested export size", async ({ page }) => {
  const result = await page.evaluate(() => {
    const renderer = window.blobnoise.createRenderer(document.querySelector("canvas")!, {}, {
      autoResize: false, pixelRatio: 1,
    });
    const rejected: string[] = [];
    for (const dimensions of [[4097, 100], [NaN, 100], [0, 100], [100, Infinity]]) {
      try { renderer.resize(dimensions[0], dimensions[1], 1); }
      catch (error) {
        if (error instanceof window.blobnoise.BlobnoiseError) rejected.push(error.code);
        else throw error;
      }
    }
    renderer.dispose();
    return rejected;
  });
  expect(result).toEqual(Array(4).fill("LIMIT_EXCEEDED"));
});
