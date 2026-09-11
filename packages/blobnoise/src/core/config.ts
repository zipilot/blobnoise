import { z } from "zod";
import { BlobnoiseError } from "./errors";

const number = (min: number, max: number) => z.number().finite().min(min).max(max);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex color");
const stop = z.strictObject({ color, position: number(0, 1) });
const palette = z.union([
  z.array(color).min(2).max(8).transform(colors =>
    colors.map((color, i) => ({ color, position: i / (colors.length - 1) }))),
  z.array(stop).min(2).max(8),
]).refine(stops => stops.length >= 2 && stops[0].position === 0 && stops.at(-1)!.position === 1 &&
  stops.every((s, i) => i === 0 || s.position > stops[i - 1].position),
"Palette stops must increase strictly from 0 to 1");
const axis = z.tuple([number(-1e6, 1e6), number(-1e6, 1e6), number(-1e6, 1e6)])
  .refine(v => Math.hypot(...v) > 1e-6, "Rotation axis must be nonzero");
const rotation = z.discriminatedUnion("mode", [
  z.strictObject({
    mode: z.literal("loop"),
    axis: axis.default([0, 1, 0]),
    turns: number(-8, 8).int().default(1),
  }),
  z.strictObject({
    mode: z.literal("free"),
    axis: axis.default([0, 1, 0]),
    rpm: number(-60, 60).default(4),
  }),
]);
const surface = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("texture"),
    projection: z.enum(["planar", "equirectangular"]).default("planar"),
  }),
  z.strictObject({
    kind: z.literal("sphere"),
    rotation: rotation.prefault({ mode: "loop" }),
    orientation: z.tuple([number(-360, 360), number(-360, 360), number(-360, 360)])
      .default([0, 0, 0]),
    lighting: z.strictObject({
      intensity: number(0, 1).default(0.35),
      rim: number(0, 1).default(0.3),
    }).prefault({}),
  }),
]);
const motion = z.discriminatedUnion("mode", [
  z.strictObject({
    mode: z.literal("loop"),
    durationSeconds: number(1, 20).default(8),
    evolution: z.strictObject({
      amount: number(0, 2).default(0.45),
      cycles: number(0, 8).int().default(1),
    }).prefault({}),
  }),
  z.strictObject({
    mode: z.literal("free"),
    speed: number(0, 2).default(0.08),
    evolution: z.strictObject({ amount: number(0, 2).default(0.45) }).prefault({}),
  }),
]);

export const configSchema = z.strictObject({
  schemaVersion: z.literal(1).default(1),
  algorithmVersion: z.literal("perlin-v1").default("perlin-v1"),
  seed: number(0, 0xffffffff).int().default(42),
  material: z.strictObject({
    palette: palette.prefault(["#14203E", "#6C87CF", "#D4B5E9", "#F4D8CE"]),
    noise: z.strictObject({
      scale: number(0.1, 10).default(2.4),
      octaves: number(1, 6).int().default(4),
      warp: number(0, 2).default(0.65),
      softness: number(0.05, 1).default(0.8),
      contrast: number(0.2, 3).default(1.1),
    }).prefault({}),
    grain: z.strictObject({
      amount: number(0, 0.3).default(0.035),
      size: number(0.5, 8).default(1),
      animated: z.boolean().default(false),
    }).prefault({}),
    glow: z.strictObject({ amount: number(0, 1).default(0.15) }).prefault({}),
    gradient: z.strictObject({
      strength: number(0, 1).default(0.15),
      angle: number(0, 360).default(45),
    }).prefault({}),
    exposure: number(0.25, 2).default(1),
  }).prefault({}),
  surface: surface.prefault({ kind: "sphere" }),
  motion: motion.prefault({ mode: "loop" }),
  background: z.union([
    z.strictObject({ color }),
    z.literal("transparent"),
  ]).default({ color: "#10121A" }),
}).superRefine((config, ctx) => {
  if (config.surface.kind === "sphere" && config.surface.rotation.mode !== config.motion.mode) {
    ctx.addIssue({
      code: "custom",
      path: ["surface", "rotation", "mode"],
      message: "Sphere rotation and motion must both use free mode or both use loop mode",
    });
  }
});

export type BlobConfig = z.output<typeof configSchema>;
export type ConfigInput = z.input<typeof configSchema>;
export type ColorStop = BlobConfig["material"]["palette"][number];

export function createConfig(input: unknown = {}): BlobConfig {
  const result = configSchema.safeParse(input);
  if (!result.success) {
    throw new BlobnoiseError("INVALID_CONFIG", result.error.issues
      .map(issue => `${issue.path.join(".") || "config"}: ${issue.message}`).join("; "));
  }
  return result.data;
}

export function parseConfig(json: string): BlobConfig {
  if (json.length > 65_536) {
    throw new BlobnoiseError("LIMIT_EXCEEDED", "Configuration JSON is limited to 64 KiB of text");
  }
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new BlobnoiseError("INVALID_CONFIG", "Configuration is not valid JSON", { cause: error });
  }
  return createConfig(value);
}

export function serializeConfig(config: BlobConfig): string {
  return JSON.stringify(createConfig(config), null, 2);
}

export function createSnippet(config: BlobConfig): string {
  return `import { createRenderer } from "@alejo-valencia/blobnoise/browser";

const config = ${serializeConfig(config)};
const canvas = document.createElement("canvas");
canvas.style.cssText = "width:100%;height:100%;display:block";
const container = document.createElement("div");
container.style.cssText = "width:min(100%,720px);height:480px";
container.append(canvas);
document.body.append(container);
const renderer = createRenderer(canvas, config);
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) renderer.play();

// When removing the embedding, call renderer.dispose() and container.remove().
`;
}
