import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportWebM, exportWebP, getExportCapabilities } from "./index";
import { BlobnoiseError } from "../core/errors";

const mocks = vi.hoisted(() => ({
  createRenderer: vi.fn(),
  renderAt: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
  canEncodeVideo: vi.fn<(codec: string, options: unknown) => Promise<boolean>>(),
  isConfigSupported: vi.fn<(config: VideoEncoderConfig) => Promise<VideoEncoderSupport>>(),
  toBlob: vi.fn<(callback: BlobCallback, type: string) => void>(),
  start: vi.fn<() => Promise<void>>(),
  add: vi.fn<(time: number, duration: number) => Promise<void>>(),
  addVideoTrack: vi.fn(),
  finalize: vi.fn<() => Promise<void>>(),
  cancel: vi.fn<() => Promise<void>>(),
  close: vi.fn(),
}));

vi.mock("../browser", () => ({ createRenderer: mocks.createRenderer }));
vi.mock("mediabunny", () => ({
  canEncodeVideo: mocks.canEncodeVideo,
  Quality: class { constructor(public options: unknown) {} },
  BufferTarget: class { buffer: ArrayBuffer | null = null; },
  WebMOutputFormat: class {},
  CanvasSource: class {
    add = mocks.add;
    close = mocks.close;
  },
  Output: class {
    state = "pending";
    constructor(public options: { target: { buffer: ArrayBuffer | null } }) {}
    addVideoTrack = mocks.addVideoTrack;
    async start() {
      this.state = "started";
      await mocks.start();
    }
    async finalize() {
      this.state = "finalizing";
      mocks.close();
      await mocks.finalize();
      this.options.target.buffer = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]).buffer;
      this.state = "finalized";
    }
    async cancel() {
      this.state = "canceled";
      mocks.close();
      await mocks.cancel();
    }
  },
}));

const dimensions = { width: 64, height: 64 };
const shortLoop = { motion: { mode: "loop", durationSeconds: 1 } };
let canvases: Array<{ width: number; height: number; toBlob: typeof mocks.toBlob }>;

beforeEach(() => {
  vi.resetAllMocks();
  canvases = [];
  vi.stubGlobal("document", {
    createElement: vi.fn(() => {
      const canvas = { width: 300, height: 150, toBlob: mocks.toBlob };
      canvases.push(canvas);
      return canvas;
    }),
  });
  vi.stubGlobal("VideoEncoder", { isConfigSupported: mocks.isConfigSupported });
  mocks.canEncodeVideo.mockResolvedValue(true);
  mocks.isConfigSupported.mockImplementation(async config => ({ supported: true, config }));
  mocks.toBlob.mockImplementation(callback => callback(new Blob(["webp"], { type: "image/webp" })));
  mocks.start.mockResolvedValue();
  mocks.add.mockResolvedValue();
  mocks.finalize.mockResolvedValue();
  mocks.cancel.mockResolvedValue();
  mocks.createRenderer.mockReturnValue({
    renderAt: mocks.renderAt, resize: mocks.resize, dispose: mocks.dispose,
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("WebP export lifecycle", () => {
  it("uses its own explicitly sized alpha canvas and releases it", async () => {
    const blob = await exportWebP({}, { ...dimensions, timeSeconds: 2, background: "transparent" });
    expect(blob.type).toBe("image/webp");
    expect(mocks.createRenderer).toHaveBeenCalledWith(canvases[0],
      expect.objectContaining({ background: "transparent" }),
      expect.objectContaining({ pixelRatio: 1, autoResize: false, releaseContext: true }));
    expect(mocks.resize).toHaveBeenCalledWith(64, 64, 1);
    expect(mocks.resize.mock.invocationCallOrder[0]).toBeLessThan(mocks.renderAt.mock.invocationCallOrder[0]);
    expect(mocks.renderAt).toHaveBeenCalledWith(2);
    expect(mocks.dispose).toHaveBeenCalledOnce();
    expect(canvases[0]).toMatchObject({ width: 0, height: 0 });
    expect(mocks.canEncodeVideo).not.toHaveBeenCalled();
  });

  it.each([null, new Blob(["png"], { type: "image/png" }), new Blob([], { type: "image/webp" })])(
    "rejects null, format fallback or empty images rather than naming them WebP",
    async blob => {
      mocks.toBlob.mockImplementation(callback => callback(blob));
      await expect(exportWebP({}, dimensions)).rejects.toBeInstanceOf(BlobnoiseError);
      expect(mocks.dispose).toHaveBeenCalledOnce();
      expect(canvases[0].width).toBe(0);
    },
  );

  it("cancels a pending canvas encoding and ignores its late callback", async () => {
    let complete!: BlobCallback;
    mocks.toBlob.mockImplementation(callback => { complete = callback; });
    const controller = new AbortController();
    const promise = exportWebP({}, { ...dimensions, signal: controller.signal });
    await vi.waitFor(() => expect(mocks.toBlob).toHaveBeenCalledOnce());
    controller.abort("user cancelled");
    await expect(promise).rejects.toMatchObject({ code: "CANCELLED", cause: "user cancelled" });
    expect(mocks.dispose).toHaveBeenCalledOnce();
    complete(new Blob(["late"], { type: "image/webp" }));
  });

  it("preserves encoding errors and still releases the renderer", async () => {
    const cause = new Error("browser image encoder crashed");
    mocks.toBlob.mockImplementation(() => { throw cause; });
    await expect(exportWebP({}, dimensions)).rejects.toMatchObject({ code: "EXPORT_FAILED", cause });
    expect(mocks.dispose).toHaveBeenCalledOnce();
  });

  it("does not hide a cleanup failure behind an encoding failure", async () => {
    const encoding = new Error("encoding failed");
    const cleanup = new Error("dispose failed");
    mocks.toBlob.mockImplementation(() => { throw encoding; });
    mocks.dispose.mockImplementation(() => { throw cleanup; });
    await expect(exportWebP({}, dimensions)).rejects.toMatchObject({
      code: "EXPORT_FAILED", cause: { errors: [encoding, cleanup] },
    });
    expect(canvases[0].width).toBe(0);
  });
});

describe("export capability detection", () => {
  it("can be imported on a server and explicitly reports missing browser APIs", async () => {
    vi.unstubAllGlobals();
    await expect(getExportCapabilities(dimensions)).resolves.toMatchObject({
      webp: false, webm: false, codec: null, reason: expect.stringContaining("browser"),
    });
    expect(mocks.createRenderer).not.toHaveBeenCalled();
    expect(mocks.canEncodeVideo).not.toHaveBeenCalled();
  });

  it("reports WebP independently of missing VideoEncoder", async () => {
    vi.stubGlobal("VideoEncoder", undefined);
    await expect(getExportCapabilities(dimensions)).resolves.toMatchObject({
      webp: true, webm: false, codec: null, reason: expect.stringContaining("VideoEncoder"),
    });
    expect(mocks.canEncodeVideo).not.toHaveBeenCalled();
  });

  it("reports WebM independently of a WebP MIME fallback", async () => {
    mocks.toBlob.mockImplementation(callback => callback(new Blob(["png"], { type: "image/png" })));
    await expect(getExportCapabilities(dimensions)).resolves.toMatchObject({
      webp: false, webm: true, codec: "vp9", reason: expect.stringContaining("image/png"),
    });
  });

  it("checks each format's dimensions separately without loading an oversized video encoder", async () => {
    await expect(getExportCapabilities({ width: 2048, height: 2048 })).resolves.toMatchObject({
      webp: true, webm: false, codec: null, reason: expect.stringContaining("1920"),
    });
    expect(mocks.canEncodeVideo).not.toHaveBeenCalled();
  });

  it("tries VP9 before VP8 and checks dimensions and framerate", async () => {
    mocks.canEncodeVideo.mockImplementation(async codec => codec === "vp8");
    await expect(getExportCapabilities({ ...dimensions, fps: 60 })).resolves.toMatchObject({
      webp: true, webm: true, codec: "vp8",
    });
    expect(mocks.canEncodeVideo.mock.calls.map(call => call[0])).toEqual(["vp9", "vp8"]);
    expect(mocks.canEncodeVideo).toHaveBeenLastCalledWith("vp8", expect.objectContaining(dimensions));
    expect(mocks.isConfigSupported).toHaveBeenCalledWith(expect.objectContaining({
      ...dimensions, codec: "vp8", framerate: 60, latencyMode: "quality", alpha: "discard",
    }));
  });

  it("tries VP8 if VP9 cannot support the requested framerate", async () => {
    mocks.isConfigSupported.mockImplementation(async config => ({
      supported: config.codec === "vp8", config,
    }));
    await expect(getExportCapabilities(dimensions)).resolves.toMatchObject({ codec: "vp8" });
    expect(mocks.canEncodeVideo.mock.calls.map(call => call[0])).toEqual(["vp9", "vp8"]);
  });

  it("tries VP8 after an explicit native unsupported-codec error", async () => {
    mocks.isConfigSupported.mockImplementation(async config => {
      if (config.codec !== "vp8") throw new DOMException("VP9 not supported", "NotSupportedError");
      return { supported: true, config };
    });
    await expect(getExportCapabilities(dimensions)).resolves.toMatchObject({ codec: "vp8" });
  });

  it("gives a reason for a null encoder and rejects an actual unsupported export", async () => {
    mocks.canEncodeVideo.mockResolvedValue(false);
    await expect(getExportCapabilities(dimensions)).resolves.toMatchObject({
      webp: true, webm: false, codec: null, reason: expect.stringContaining("Neither a VP9 nor a VP8"),
    });
    await expect(exportWebM({}, dimensions)).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
    expect(mocks.createRenderer).not.toHaveBeenCalled();
  });

  it("reports unexpected probe failures instead of pretending no encoder exists", async () => {
    const cause = new Error("capability probe failed");
    mocks.canEncodeVideo.mockRejectedValue(cause);
    await expect(getExportCapabilities(dimensions)).resolves.toMatchObject({
      webp: true, webm: false, codec: null, reason: expect.stringContaining(cause.message),
    });
    await expect(exportWebM({}, dimensions)).rejects.toMatchObject({ code: "EXPORT_FAILED", cause });
  });
});

describe("frame-driven WebM export lifecycle", () => {
  it("awaits every frame, excludes the endpoint and finalizes owned resources", async () => {
    const progress = vi.fn();
    const blob = await exportWebM(shortLoop, { ...dimensions, fps: 24, onProgress: progress });
    expect(blob.type).toBe("video/webm");
    expect(mocks.addVideoTrack).toHaveBeenCalledWith(expect.anything(), { frameRate: 24 });
    expect(mocks.resize).toHaveBeenCalledWith(64, 64, 1);
    expect(mocks.createRenderer).toHaveBeenCalledWith(canvases[0], expect.anything(),
      expect.objectContaining({ autoResize: false, pixelRatio: 1, releaseContext: true }));
    expect(mocks.renderAt.mock.calls).toEqual(Array.from({ length: 24 }, (_, i) => [i / 24]));
    expect(mocks.add.mock.calls).toEqual(Array.from({ length: 24 }, (_, i) => [i / 24, 1 / 24]));
    expect(progress).toHaveBeenCalledTimes(25);
    expect(progress).toHaveBeenLastCalledWith({ completedFrames: 24, totalFrames: 24 });
    expect(mocks.finalize).toHaveBeenCalledOnce();
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(mocks.dispose).toHaveBeenCalledOnce();
  });

  it("rejects cancellation before encoder detection or canvas allocation", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(exportWebM({}, { ...dimensions, signal: controller.signal })).rejects.toMatchObject({
      code: "CANCELLED",
    });
    expect(mocks.canEncodeVideo).not.toHaveBeenCalled();
    expect(mocks.createRenderer).not.toHaveBeenCalled();
  });

  it("cancels a pending encoder probe without allocating a renderer", async () => {
    let release!: (value: boolean) => void;
    mocks.canEncodeVideo.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const controller = new AbortController();
    const promise = exportWebM({}, { ...dimensions, signal: controller.signal });
    await vi.waitFor(() => expect(mocks.canEncodeVideo).toHaveBeenCalledOnce());
    controller.abort();
    await expect(promise).rejects.toMatchObject({ code: "CANCELLED" });
    release(true);
    expect(mocks.createRenderer).not.toHaveBeenCalled();
    expect(mocks.isConfigSupported).not.toHaveBeenCalled();
  });

  it("respects backpressure and cancels while source.add is pending", async () => {
    let release!: () => void;
    mocks.add.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const controller = new AbortController();
    const promise = exportWebM(shortLoop, { ...dimensions, fps: 24, signal: controller.signal });
    await vi.waitFor(() => expect(mocks.add).toHaveBeenCalledOnce());
    expect(mocks.renderAt).toHaveBeenCalledOnce();
    controller.abort();
    await expect(promise).rejects.toMatchObject({ code: "CANCELLED" });
    expect(mocks.cancel).toHaveBeenCalledOnce();
    expect(mocks.dispose).toHaveBeenCalledOnce();
    expect(mocks.finalize).not.toHaveBeenCalled();
    release();
  });

  it("waits for non-cancellable finalization cleanup before rejecting a late abort", async () => {
    let release!: () => void;
    mocks.finalize.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const controller = new AbortController();
    const promise = exportWebM(shortLoop, { ...dimensions, fps: 24, signal: controller.signal });
    let settled = false;
    void promise.then(() => { settled = true; }, () => { settled = true; });
    await vi.waitFor(() => expect(mocks.finalize).toHaveBeenCalledOnce());
    controller.abort();
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(mocks.dispose).not.toHaveBeenCalled();
    release();
    await expect(promise).rejects.toMatchObject({ code: "CANCELLED" });
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(mocks.dispose).toHaveBeenCalledOnce();
  });

  it("cancels output and releases the renderer after a frame encoding failure", async () => {
    const cause = new Error("encoder crashed");
    mocks.add.mockRejectedValue(cause);
    await expect(exportWebM(shortLoop, { ...dimensions, fps: 24 })).rejects.toMatchObject({
      code: "EXPORT_FAILED", cause,
    });
    expect(mocks.renderAt).toHaveBeenCalledOnce();
    expect(mocks.cancel).toHaveBeenCalledOnce();
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.dispose).toHaveBeenCalledOnce();
    expect(canvases[0].width).toBe(0);
  });

  it("does not turn a throwing progress callback into a successful export", async () => {
    const cause = new Error("progress handler failed");
    await expect(exportWebM(shortLoop, {
      ...dimensions, onProgress: () => { throw cause; },
    })).rejects.toMatchObject({ code: "EXPORT_FAILED", cause });
    expect(mocks.cancel).toHaveBeenCalledOnce();
    expect(mocks.dispose).toHaveBeenCalledOnce();
    expect(mocks.add).not.toHaveBeenCalled();
  });

  it("disposes resources when finalization itself fails", async () => {
    const cause = new Error("muxer failed");
    mocks.finalize.mockRejectedValue(cause);
    await expect(exportWebM(shortLoop, { ...dimensions, fps: 24 })).rejects.toMatchObject({
      code: "EXPORT_FAILED", cause,
    });
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(mocks.dispose).toHaveBeenCalledOnce();
  });
});
