import { createRenderer, type BlobRenderer } from "../browser";
import type { BlobConfig } from "../core/config";
import { BlobnoiseError } from "../core/errors";

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new BlobnoiseError("CANCELLED", "Export cancelled", { cause: signal.reason });
  }
}

export function exportError(error: unknown, message: string): BlobnoiseError {
  return error instanceof BlobnoiseError ? error : new BlobnoiseError("EXPORT_FAILED", message, { cause: error });
}

export async function abortable<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  throwIfAborted(signal);
  if (!signal) return operation();
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(new BlobnoiseError("CANCELLED", "Export cancelled", { cause: signal.reason }));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve().then(() => {
      throwIfAborted(signal);
      return operation();
    }).then(value => {
      signal.removeEventListener("abort", onAbort);
      if (signal.aborted) onAbort();
      else resolve(value);
    }, error => {
      signal.removeEventListener("abort", onAbort);
      reject(error);
    });
  });
}

export function yieldToBrowser(signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(new BlobnoiseError("CANCELLED", "Export cancelled", { cause: signal?.reason }));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, 0);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function withCleanup<T>(
  work: () => Promise<T>,
  cleanup: () => void | Promise<void>,
  message: string,
): Promise<T> {
  let result!: T;
  const failures: unknown[] = [];
  try {
    result = await work();
  } catch (error) {
    failures.push(error);
  }
  try {
    await cleanup();
  } catch (error) {
    failures.push(error);
  }
  if (failures.length === 1) throw exportError(failures[0], message);
  if (failures.length > 1) {
    throw new BlobnoiseError("EXPORT_FAILED", `${message}; resource cleanup also failed`, {
      cause: new AggregateError(failures, message),
    });
  }
  return result;
}

export function createExportCanvas(width: number, height: number): HTMLCanvasElement {
  if (typeof document === "undefined") {
    throw new BlobnoiseError("UNSUPPORTED_FORMAT", "Export requires a browser document and canvas");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export async function withExportRenderer<T>(
  config: BlobConfig,
  width: number,
  height: number,
  work: (renderer: BlobRenderer, canvas: HTMLCanvasElement) => Promise<T>,
): Promise<T> {
  const canvas = createExportCanvas(width, height);
  let renderer: BlobRenderer | undefined;
  let rendererError: Error | undefined;
  return withCleanup(async () => {
    renderer = createRenderer(canvas, config, {
      pixelRatio: 1,
      autoResize: false,
      releaseContext: true,
      onError: error => { rendererError = error; },
    });
    renderer.resize(width, height, 1);
    const result = await work(renderer, canvas);
    if (rendererError) throw rendererError;
    return result;
  }, () => {
    try {
      renderer?.dispose();
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }, "Unable to render or clean up the export canvas");
}

export function canvasToWebP(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new BlobnoiseError("EXPORT_FAILED", "The browser could not encode the canvas as WebP"));
      } else if (blob.type !== "image/webp") {
        reject(new BlobnoiseError("UNSUPPORTED_FORMAT", `The browser returned ${blob.type || "an unknown format"} instead of image/webp`));
      } else if (blob.size === 0) {
        reject(new BlobnoiseError("EXPORT_FAILED", "The browser returned an empty WebP image"));
      } else {
        resolve(blob);
      }
    }, "image/webp", 0.95);
  });
}
