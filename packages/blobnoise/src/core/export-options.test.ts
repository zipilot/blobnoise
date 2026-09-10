import { describe, expect, it } from "vitest";
import { createConfig } from "./config";
import { BlobnoiseError } from "./errors";
import {
  dimensionLimitReason, normalizeWebMOptions, normalizeWebPOptions, validateDimensions,
} from "../export/options";

const dimensions = { width: 512, height: 512 };
const free = { motion: { mode: "free" }, surface: { kind: "texture" } };

describe("WebP export options", () => {
  it("inherits defaults without changing the input", () => {
    const config = createConfig();
    const result = normalizeWebPOptions(config, dimensions);
    expect(result.timeSeconds).toBe(0);
    expect(result.config).toEqual(config);
    expect(result.config).not.toBe(config);
  });

  it("accepts alpha, explicit time and maximum dimensions", () => {
    const config = createConfig();
    const result = normalizeWebPOptions(config, {
      width: 4096, height: 4096, timeSeconds: 10.5, background: "transparent",
    });
    expect(result.config.background).toBe("transparent");
    expect(config.background).not.toBe("transparent");
  });

  it.each([NaN, Infinity, -1, null, "1"])("rejects invalid time %s", timeSeconds => {
    expect(() => normalizeWebPOptions({}, { ...dimensions, timeSeconds: timeSeconds as number }))
      .toThrow(/finite and nonnegative/);
  });

  it.each(["red", "#fff", "#ffffff00", "rgba(0,0,0,0)", "", null])("rejects invalid background %s", background => {
    expect(() => normalizeWebPOptions({}, { ...dimensions, background: background as string })).toThrow(/background/);
  });
});

describe("export dimensions", () => {
  it.each([0, -1, 1.5, NaN, Infinity, "512", null])("rejects invalid dimension %s", width => {
    expect(() => validateDimensions({ ...dimensions, width: width as number })).toThrow(/positive integer/);
    expect(() => validateDimensions({ ...dimensions, height: width as number })).toThrow(/positive integer/);
  });

  it("distinguishes format limits and allows portrait video", () => {
    expect(dimensionLimitReason({ width: 1080, height: 1920 }, "webm")).toBeUndefined();
    expect(dimensionLimitReason({ width: 1440, height: 1440 }, "webm")).toBeUndefined();
    expect(dimensionLimitReason({ width: 1441, height: 1440 }, "webm")).toMatch(/total pixels/);
    expect(dimensionLimitReason({ width: 1921, height: 1 }, "webm")).toMatch(/1920/);
    expect(dimensionLimitReason({ width: 2048, height: 2048 }, "webp")).toBeUndefined();
    expect(dimensionLimitReason({ width: 4097, height: 1 }, "webp")).toMatch(/4096/);
  });

  it("uses LIMIT_EXCEEDED for a format's size ceiling", () => {
    try {
      normalizeWebPOptions({}, { width: 4097, height: 1 });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(BlobnoiseError);
      expect((error as BlobnoiseError).code).toBe("LIMIT_EXCEEDED");
    }
  });
});

describe("WebM export options", () => {
  it("inherits the loop duration and excludes its duplicate endpoint", () => {
    const result = normalizeWebMOptions({ motion: { mode: "loop", durationSeconds: 3 } }, dimensions);
    expect(result.fps).toBe(30);
    expect(result.durationSeconds).toBe(3);
    expect(result.schedule.count).toBe(90);
    expect(result.schedule.timestamp(89)).toBe(89 / 30);
  });

  it("allows an equal loop override, not a different clip duration", () => {
    expect(normalizeWebMOptions({}, { ...dimensions, durationSeconds: 8 }).schedule.count).toBe(240);
    expect(() => normalizeWebMOptions({}, { ...dimensions, durationSeconds: 4 })).toThrow(/must equal/);
  });

  it("defaults free mode to 8 seconds and accepts its own clip duration", () => {
    expect(normalizeWebMOptions(free, dimensions).durationSeconds).toBe(8);
    expect(normalizeWebMOptions(free, { ...dimensions, durationSeconds: 2, fps: 24 }).schedule.count).toBe(48);
    expect(normalizeWebMOptions(free, { ...dimensions, durationSeconds: 20, fps: 60 }).schedule.count).toBe(1200);
  });

  it.each([0, 0.5, 20.1, NaN, Infinity, 8.01, null])("rejects invalid free duration %s", durationSeconds => {
    expect(() => normalizeWebMOptions(free, { ...dimensions, durationSeconds: durationSeconds as number })).toThrow();
  });

  it.each([0, 29, 120, null, "30"])("rejects invalid FPS %s", fps => {
    expect(() => normalizeWebMOptions({}, { ...dimensions, fps: fps as 30 })).toThrow(/FPS/);
  });

  it("requires explicit opaque background when the config has alpha", () => {
    expect(() => normalizeWebMOptions({ background: "transparent" }, dimensions)).toThrow(/opaque/);
    expect(() => normalizeWebMOptions({}, { ...dimensions, background: "transparent" })).toThrow(/opaque/);
    expect(normalizeWebMOptions({ background: "transparent" }, { ...dimensions, background: "#Ab12fF" })
      .config.background).toEqual({ color: "#Ab12fF" });
  });

  it("checks progress callbacks and abort signals", () => {
    expect(() => normalizeWebMOptions({}, { ...dimensions, onProgress: "bad" as never })).toThrow(/function/);
    expect(() => normalizeWebPOptions({}, { ...dimensions, signal: {} as AbortSignal })).toThrow(/AbortSignal/);
    const signal = new AbortController().signal;
    expect(normalizeWebMOptions({}, { ...dimensions, signal }).signal).toBe(signal);
  });
});
