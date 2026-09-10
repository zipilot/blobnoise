import { expect, test } from "@playwright/test";
import type {} from "../apps/studio/src/harness";

test.beforeEach(async ({ page }) => {
  await page.goto("/harness.html");
  await page.waitForFunction(() => !!window.blobnoise);
});

test("WebP exports the requested size and alpha without changing a preview", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { createConfig, createRenderer, exportWebP } = window.blobnoise;
    const canvas = document.querySelector("canvas")!;
    const config = createConfig();
    const preview = createRenderer(canvas, config, { autoResize: false, pixelRatio: 1 });
    preview.renderAt(2);
    const blob = await exportWebP(config, { width: 320, height: 240, timeSeconds: 1, background: "transparent" });
    const bitmap = await createImageBitmap(blob);
    const output = document.createElement("canvas");
    output.width = bitmap.width; output.height = bitmap.height;
    const context = output.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const value = {
      mime: blob.type, width: bitmap.width, height: bitmap.height,
      alpha: context.getImageData(0, 0, 1, 1).data[3],
      previewWidth: canvas.width, previewTime: preview.time, bytes: blob.size,
    };
    bitmap.close();
    preview.dispose();
    return value;
  });
  expect(result.mime).toBe("image/webp");
  expect(result.width).toBe(320);
  expect(result.height).toBe(240);
  expect(result.alpha).toBe(0);
  expect(result.previewWidth).toBe(512);
  expect(result.previewTime).toBe(2);
  expect(result.bytes).toBeGreaterThan(1000);
});

test("WebM contains every scheduled frame and decodes as a real video", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { createConfig, exportWebM, getExportCapabilities, loadMedia } = window.blobnoise;
    const config = createConfig({
      motion: { mode: "loop", durationSeconds: 1 },
      material: { noise: { octaves: 2 } },
    });
    const caps = await getExportCapabilities({ width: 160, height: 120, fps: 24 });
    if (!caps.webm) throw new Error(caps.reason ?? "Expected a browser WebM encoder");
    const progress: number[] = [];
    const blob = await exportWebM(config, {
      width: 160, height: 120, fps: 24, onProgress: p => progress.push(p.completedFrames),
    });
    const { Input, BlobSource, ALL_FORMATS, EncodedPacketSink, VideoSampleSink } = await loadMedia();
    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    try {
      const track = await input.getPrimaryVideoTrack();
      if (!track) throw new Error("Missing video track");
      const timestamps: number[] = [];
      for await (const packet of new EncodedPacketSink(track).packets()) timestamps.push(packet.timestamp);
      const sample = await new VideoSampleSink(track).getSample(0.5);
      if (!sample) throw new Error("Could not decode exported frame");
      const value = { mime: blob.type, bytes: blob.size, duration: await input.computeDuration(),
        timestamps, progress, width: sample.displayWidth, height: sample.displayHeight };
      sample.close();
      return value;
    } finally {
      input.dispose();
    }
  });
  expect(result.mime).toBe("video/webm");
  expect(result.bytes).toBeGreaterThan(1000);
  expect(result.width).toBe(160);
  expect(result.height).toBe(120);
  expect(result.timestamps).toHaveLength(24);
  expect(result.timestamps[0]).toBe(0);
  expect(result.timestamps.at(-1)).toBeCloseTo(23 / 24, 3);
  expect(result.duration).toBeCloseTo(1, 2);
  expect(result.progress.at(-1)).toBe(24);
});

test("export cancellation and unsupported encoders fail explicitly", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const api = window.blobnoise;
    const config = api.createConfig({ motion: { mode: "loop", durationSeconds: 1 } });
    const controller = new AbortController();
    let cancelled = "";
    try {
      await api.exportWebM(config, {
        width: 128, height: 128, fps: 24, signal: controller.signal,
        onProgress: p => { if (p.completedFrames >= 2) controller.abort(); },
      });
    } catch (error) {
      cancelled = error instanceof api.BlobnoiseError ? error.code : String(error);
    }
    const alreadyAborted = new AbortController();
    alreadyAborted.abort();
    let early = "";
    try {
      await api.exportWebP(config, { width: 128, height: 128, signal: alreadyAborted.signal });
    } catch (error) {
      early = error instanceof api.BlobnoiseError ? error.code : String(error);
    }
    Object.defineProperty(window, "VideoEncoder", { value: undefined, configurable: true });
    const caps = await api.getExportCapabilities({ width: 128, height: 128 });
    let unsupported = "";
    try { await api.exportWebM(config, { width: 128, height: 128 }); }
    catch (error) { unsupported = error instanceof api.BlobnoiseError ? error.code : String(error); }
    return { cancelled, early, unsupported, webm: caps.webm, webp: caps.webp };
  });
  expect(result).toEqual({
    cancelled: "CANCELLED", early: "CANCELLED", unsupported: "UNSUPPORTED_FORMAT", webm: false, webp: true,
  });
});
