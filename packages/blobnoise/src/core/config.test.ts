import { describe, expect, it } from "vitest";
import { createConfig, parseConfig, serializeConfig } from "./config";
import { frameSchedule, sampleTimeline } from "./timeline";
import { palettePixels } from "./palette";
import { getPreset, presetNames } from "../presets";

describe("configuration", () => {
  it("normalizes defaults and round-trips without losing state", () => {
    const config = createConfig();
    expect(parseConfig(serializeConfig(config))).toEqual(config);
    expect(config.material.palette[0].position).toBe(0);
    expect(config.material.palette.at(-1)!.position).toBe(1);
  });

  it.each([
    { seed: NaN }, { seed: -1 }, { schemaVersion: 2 }, { algorithmVersion: "other" },
    { surprise: 1 }, { material: { surprise: 1 } },
    { material: { palette: [] } }, { material: { palette: ["#ffffff"] } },
    { material: { palette: ["red", "#ffffff"] } },
    { material: { palette: [{ color: "#000000", position: 0.5 }, { color: "#ffffff", position: 1 }] } },
    { surface: { kind: "sphere", rotation: { mode: "loop", axis: [0, 0, 0] } } },
    { surface: { kind: "sphere", rotation: { mode: "free" } } },
    { material: { noise: { octaves: 2.3 } } },
  ])("rejects invalid input %j", input => {
    expect(() => createConfig(input)).toThrow();
  });

  it("bounds JSON and reports malformed JSON", () => {
    expect(() => parseConfig(" ".repeat(65_537))).toThrow(/64 KiB/);
    expect(() => parseConfig("{")).toThrow(/valid JSON/);
  });

  it("returns independent presets", () => {
    for (const name of presetNames) expect(() => createConfig(getPreset(name))).not.toThrow();
    const preset = getPreset("Cloud");
    preset.material.noise.scale = 10;
    expect(getPreset("Cloud").material.noise.scale).not.toBe(10);
  });
});

describe("timeline", () => {
  it("loops exactly and ignores call order", () => {
    const config = createConfig();
    expect(sampleTimeline(config, 8)).toEqual(sampleTimeline(config, 0));
    const before = sampleTimeline(config, 2);
    sampleTimeline(config, 7);
    expect(sampleTimeline(config, 2)).toEqual(before);
    expect(sampleTimeline(config, -0.1).phase).toBeCloseTo(sampleTimeline(config, 7.9).phase);
  });

  it("keeps arbitrary free speed independent from evolution", () => {
    const config = createConfig({
      surface: { kind: "sphere", rotation: { mode: "free", rpm: 30 } },
      motion: { mode: "free", speed: 0 },
    });
    expect(sampleTimeline(config, 1).rotationRadians).toBeCloseTo(Math.PI);
    expect(sampleTimeline(config, 1).evolutionAngle).toBe(0);
  });

  it("omits the duplicate endpoint", () => {
    const schedule = frameSchedule(8, 30);
    expect(schedule.count).toBe(240);
    expect(schedule.timestamp(239)).toBe(239 / 30);
    expect(() => frameSchedule(8.01, 30)).toThrow(/whole number/);
    expect(() => frameSchedule(8, 29)).toThrow();
  });
});

it("interpolates perceptual palettes with exact endpoints", () => {
  const bytes = palettePixels([{ color: "#000000", position: 0 }, { color: "#ffffff", position: 1 }]);
  expect(Array.from(bytes.slice(0, 4))).toEqual([0, 0, 0, 255]);
  expect(Array.from(bytes.slice(-4))).toEqual([255, 255, 255, 255]);
  expect(bytes[128 * 4]).toBeGreaterThan(50);
  expect(bytes[128 * 4]).toBeLessThan(150);
});
