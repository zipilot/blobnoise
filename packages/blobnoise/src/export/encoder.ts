import type { VideoEncodingConfig } from "mediabunny";
import type { ExportDimensions, ExportFrameRate } from "./options";
import { abortable, throwIfAborted } from "./runtime";

export type WebMCodec = "vp9" | "vp8";
export type EncoderModule = typeof import("mediabunny");

const bitrate = 8_000_000;

export function videoEncodingConfig(bunny: EncoderModule, codec: WebMCodec): VideoEncodingConfig {
  return {
    codec,
    fullCodecString: codec === "vp9" ? "vp09.00.41.08" : "vp8",
    quality: new bunny.Quality({ bitrate, bitrateMode: "variable" }),
    alpha: "discard",
    latencyMode: "quality",
    keyFrameInterval: 2,
  };
}

export async function detectWebMEncoder(
  options: ExportDimensions & { fps: ExportFrameRate },
  signal?: AbortSignal,
): Promise<{ codec: WebMCodec; bunny: EncoderModule } | { codec: null; reason: string }> {
  throwIfAborted(signal);
  if (typeof VideoEncoder === "undefined") {
    return { codec: null, reason: "WebM export requires a browser with the WebCodecs VideoEncoder API" };
  }
  const bunny = await abortable(() => import("mediabunny"), signal);
  const { width, height, fps } = options;
  for (const codec of ["vp9", "vp8"] as const) {
    throwIfAborted(signal);
    const config = videoEncodingConfig(bunny, codec);
    if (!await abortable(() => bunny.canEncodeVideo(codec, { ...config, width, height }), signal)) continue;
    // Mediabunny 1.56's public capability options omit framerate; check it natively too.
    try {
      const support = await abortable(() => VideoEncoder.isConfigSupported({
        codec: config.fullCodecString!,
        width,
        height,
        framerate: fps,
        bitrate,
        bitrateMode: "variable",
        alpha: "discard",
        latencyMode: "quality",
      }), signal);
      if (support.supported) return { codec, bunny };
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "NotSupportedError")) throw error;
    }
  }
  return {
    codec: null,
    reason: `Neither a VP9 nor a VP8 encoder supports ${width} × ${height} at ${fps} FPS`,
  };
}
