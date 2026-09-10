import { createConfig } from "../core/config";
import { BlobnoiseError } from "../core/errors";

export const presetNames = ["Cloud", "Mist", "Nebula"] as const;
export type PresetName = typeof presetNames[number];

export function getPreset(name: PresetName) {
  if (name === "Mist") {
    return createConfig({
      seed: 1801,
      material: {
        palette: ["#153B3A", "#638A8C", "#B5D2CE", "#EFE8D5"],
        noise: { scale: 1.8, warp: 0.4, contrast: 0.85 },
      },
      surface: { kind: "texture", projection: "planar" },
    });
  }
  if (name === "Nebula") {
    return createConfig({
      seed: 9317,
      material: {
        palette: ["#130B2D", "#473A8F", "#BF73BD", "#F5C6AF"],
        noise: { scale: 2.9, warp: 0.9, contrast: 1.4 },
        glow: { amount: 0.3 },
      },
    });
  }
  if (name === "Cloud") return createConfig();
  throw new BlobnoiseError("INVALID_CONFIG", `Unknown preset: ${String(name)}`);
}
