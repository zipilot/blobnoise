import { createConfig, type BlobConfig } from "../core/config";
import { BlobnoiseError } from "../core/errors";
import { frameSchedule } from "../core/timeline";

export type ExportFrameRate = 24 | 30 | 60;

export interface ExportDimensions {
  width: number;
  height: number;
}

export interface WebPExportOptions extends ExportDimensions {
  /** A finite, nonnegative timeline position; defaults to zero. */
  timeSeconds?: number;
  /** Six-digit hex or transparent; otherwise inherit the configuration. */
  background?: "transparent" | string;
  signal?: AbortSignal;
}

export interface ExportProgress {
  completedFrames: number;
  totalFrames: number;
}

export interface WebMExportOptions extends ExportDimensions {
  fps?: ExportFrameRate;
  /** 1–20 seconds. Loop mode inherits its duration; free mode defaults to 8. */
  durationSeconds?: number;
  /** Opaque six-digit hex; required when the configuration is transparent. */
  background?: string;
  signal?: AbortSignal;
  onProgress?: (progress: ExportProgress) => void;
}

export interface ExportCapabilityOptions extends ExportDimensions {
  fps?: ExportFrameRate;
}

export const WEBP_MAX_DIMENSION = 4096;
export const WEBM_MAX_DIMENSION = 1920;
export const WEBM_MAX_PIXELS = 1920 * 1080;

export function validateDimensions(options: ExportDimensions): void {
  if (!options || !Number.isSafeInteger(options.width) || !Number.isSafeInteger(options.height) ||
      options.width < 1 || options.height < 1) {
    throw new BlobnoiseError("INVALID_CONFIG", "Export width and height must be positive integer pixels");
  }
}

export function dimensionLimitReason(options: ExportDimensions, format: "webp" | "webm"): string | undefined {
  const { width, height } = options;
  if (format === "webp" && Math.max(width, height) > WEBP_MAX_DIMENSION) {
    return "WebP exports are limited to 4096 pixels per side";
  }
  if (format === "webm" &&
      (Math.max(width, height) > WEBM_MAX_DIMENSION || width * height > WEBM_MAX_PIXELS)) {
    return "WebM exports are limited to 1920 pixels per side and 1920 × 1080 total pixels";
  }
}

export function validateFrameRate(fps: number = 30): ExportFrameRate {
  if (fps !== 24 && fps !== 30 && fps !== 60) {
    throw new BlobnoiseError("INVALID_CONFIG", "Export FPS must be 24, 30 or 60");
  }
  return fps;
}

function validateCommon(options: WebPExportOptions | WebMExportOptions, format: "webp" | "webm") {
  validateDimensions(options);
  const reason = dimensionLimitReason(options, format);
  if (reason) throw new BlobnoiseError("LIMIT_EXCEEDED", reason);
  const signal = options.signal;
  if (signal !== undefined && (!signal || typeof signal.aborted !== "boolean" ||
      typeof signal.addEventListener !== "function" || typeof signal.removeEventListener !== "function")) {
    throw new BlobnoiseError("INVALID_CONFIG", "Export signal must be an AbortSignal");
  }
}

function withBackground(input: unknown, background: string | undefined, opaque: boolean): BlobConfig {
  const config = createConfig(input);
  if (background !== undefined) {
    if (background !== "transparent" && (typeof background !== "string" || !/^#[0-9a-f]{6}$/i.test(background))) {
      throw new BlobnoiseError("INVALID_CONFIG", "Export background must be a six-digit hex color or transparent");
    }
    config.background = background === "transparent" ? background : { color: background };
  }
  if (opaque && config.background === "transparent") {
    throw new BlobnoiseError("INVALID_CONFIG", "WebM requires an opaque six-digit hex background; alpha video is not supported");
  }
  return config;
}

export function normalizeWebPOptions(input: unknown, options: WebPExportOptions) {
  validateCommon(options, "webp");
  const timeSeconds = options.timeSeconds === undefined ? 0 : options.timeSeconds;
  if (!Number.isFinite(timeSeconds) || timeSeconds < 0) {
    throw new BlobnoiseError("INVALID_CONFIG", "WebP timeSeconds must be finite and nonnegative");
  }
  return { ...options, timeSeconds, config: withBackground(input, options.background, false) };
}

export function normalizeWebMOptions(input: unknown, options: WebMExportOptions) {
  validateCommon(options, "webm");
  const config = withBackground(input, options.background, true);
  const fps = validateFrameRate(options.fps);
  const durationSeconds = options.durationSeconds === undefined
    ? config.motion.mode === "loop" ? config.motion.durationSeconds : 8
    : options.durationSeconds;
  if (config.motion.mode === "loop" && durationSeconds !== config.motion.durationSeconds) {
    throw new BlobnoiseError("INVALID_CONFIG", "A loop export duration must equal motion.durationSeconds");
  }
  if (options.onProgress !== undefined && typeof options.onProgress !== "function") {
    throw new BlobnoiseError("INVALID_CONFIG", "Export onProgress must be a function");
  }
  return { ...options, config, fps, durationSeconds, schedule: frameSchedule(durationSeconds, fps) };
}
