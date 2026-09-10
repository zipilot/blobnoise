import { BlobnoiseError } from "../core/errors";
import { detectWebMEncoder, videoEncodingConfig, type WebMCodec } from "./encoder";
import {
  dimensionLimitReason, normalizeWebMOptions, normalizeWebPOptions, validateDimensions,
  validateFrameRate, type ExportCapabilityOptions, type WebMExportOptions, type WebPExportOptions,
} from "./options";
import {
  abortable, canvasToWebP, createExportCanvas, exportError, throwIfAborted,
  withCleanup, withExportRenderer, yieldToBrowser,
} from "./runtime";

export type {
  ExportCapabilityOptions, ExportDimensions, ExportFrameRate, ExportProgress,
  WebMExportOptions, WebPExportOptions,
} from "./options";
export type { WebMCodec } from "./encoder";

export interface ExportCapabilities {
  webp: boolean;
  webm: boolean;
  codec: WebMCodec | null;
  reason?: string;
}

export async function exportWebP(input: unknown, options: WebPExportOptions): Promise<Blob> {
  try {
    throwIfAborted(options?.signal);
    const { config, width, height, timeSeconds, signal } = normalizeWebPOptions(input, options);
    return await withExportRenderer(config, width, height, async (renderer, canvas) => {
      throwIfAborted(signal);
      renderer.renderAt(timeSeconds);
      return abortable(() => canvasToWebP(canvas), signal);
    });
  } catch (error) {
    throw exportError(error, "Unable to export WebP");
  }
}

/**
 * Main-thread, frame-driven export. Keeps compressed output in memory, not a raw-frame array.
 * Limited to 20 seconds, 60 FPS and 1080p pixel count; encoder memory remains device-dependent.
 */
export async function exportWebM(input: unknown, options: WebMExportOptions): Promise<Blob> {
  try {
    throwIfAborted(options?.signal);
    const settings = normalizeWebMOptions(input, options);
    const { config, width, height, fps, signal, schedule, onProgress } = settings;
    const encoder = await detectWebMEncoder(settings, signal);
    throwIfAborted(signal);
    if (!encoder.codec) throw new BlobnoiseError("UNSUPPORTED_FORMAT", encoder.reason);
    const { bunny, codec } = encoder;

    return await withExportRenderer(config, width, height, async (renderer, canvas) => {
      const target = new bunny.BufferTarget();
      const output = new bunny.Output({ format: new bunny.WebMOutputFormat(), target });
      return withCleanup(async () => {
        const source = new bunny.CanvasSource(canvas, videoEncodingConfig(bunny, codec));
        output.addVideoTrack(source, { frameRate: fps });
        await abortable(() => output.start(), signal);
        onProgress?.({ completedFrames: 0, totalFrames: schedule.count });
        for (let i = 0; i < schedule.count; i++) {
          await yieldToBrowser(signal);
          throwIfAborted(signal);
          renderer.renderAt(schedule.timestamp(i));
          await abortable(() => source.add(i / fps, 1 / fps), signal);
          throwIfAborted(signal);
          onProgress?.({ completedFrames: i + 1, totalFrames: schedule.count });
        }
        throwIfAborted(signal);
        // finalize also closes the source. Once started it cannot be cancelled in Mediabunny;
        // wait for resource release, then reject if cancellation arrived while flushing.
        await output.finalize();
        throwIfAborted(signal);
        if (!target.buffer?.byteLength) {
          throw new BlobnoiseError("EXPORT_FAILED", "The WebM encoder produced no output");
        }
        return new Blob([target.buffer], { type: "video/webm" });
      }, async () => {
        try {
          if (output.state !== "finalized" && output.state !== "finalizing") await output.cancel();
        } finally {
          target.buffer = null;
        }
      }, "Unable to encode or finalize WebM");
    });
  } catch (error) {
    throw exportError(error, "Unable to export WebM");
  }
}

export async function getExportCapabilities(options: ExportCapabilityOptions): Promise<ExportCapabilities> {
  validateDimensions(options);
  const fps = validateFrameRate(options.fps);
  if (typeof document === "undefined") {
    return { webp: false, webm: false, codec: null, reason: "Exports require a browser document and canvas" };
  }
  const webpLimit = dimensionLimitReason(options, "webp");
  const webmLimit = dimensionLimitReason(options, "webm");
  const [image, video] = await Promise.allSettled([
    (async () => {
      if (webpLimit) return { supported: false, reason: webpLimit };
      const canvas = createExportCanvas(1, 1);
      return withCleanup(async () => {
        await canvasToWebP(canvas);
        return { supported: true };
      }, () => { canvas.width = 0; canvas.height = 0; }, "Unable to check WebP support");
    })(),
    webmLimit
      ? Promise.resolve({ codec: null, reason: webmLimit })
      : detectWebMEncoder({ ...options, fps }),
  ]);
  const reasons: string[] = [];
  let webp = false;
  let codec: WebMCodec | null = null;
  if (image.status === "fulfilled") {
    webp = image.value.supported;
    if ("reason" in image.value && image.value.reason) reasons.push(image.value.reason);
  } else {
    reasons.push(`WebP: ${exportError(image.reason, "Unable to check WebP support").message}`);
  }
  if (video.status === "fulfilled") {
    codec = video.value.codec;
    if ("reason" in video.value) reasons.push(video.value.reason);
  } else {
    const error = exportError(video.reason, "Unable to check WebM encoder support");
    reasons.push(`WebM: ${error.message}${error.cause instanceof Error ? ` (${error.cause.message})` : ""}`);
  }
  return { webp, webm: codec !== null, codec, ...(reasons.length ? { reason: reasons.join("; ") } : {}) };
}
