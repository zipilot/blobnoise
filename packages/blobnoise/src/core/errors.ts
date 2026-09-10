export type ErrorCode =
  | "INVALID_CONFIG"
  | "WEBGL_UNAVAILABLE"
  | "CONTEXT_LOST"
  | "RENDER_FAILED"
  | "DISPOSED"
  | "UNSUPPORTED_FORMAT"
  | "EXPORT_FAILED"
  | "LIMIT_EXCEEDED"
  | "CANCELLED";

export class BlobnoiseError extends Error {
  constructor(public readonly code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "BlobnoiseError";
  }
}
