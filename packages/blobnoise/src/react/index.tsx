import {
  forwardRef, useEffect, useImperativeHandle, useRef, useState,
  type CanvasHTMLAttributes,
} from "react";
import { createRenderer, type BlobRenderer } from "../browser";
import type { ConfigInput } from "../core/config";
import { BlobnoiseError } from "../core/errors";

export interface BlobNoiseProps extends Omit<CanvasHTMLAttributes<HTMLCanvasElement>, "onError"> {
  config: ConfigInput;
  /** Defaults to true; the user's reduced-motion preference always takes precedence. */
  playing?: boolean;
  onError?: (error: Error) => void;
}

export const BlobNoise = forwardRef<HTMLCanvasElement, BlobNoiseProps>(function BlobNoise(
  { config, playing = true, onError, ...canvasProps },
  forwardedRef,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<BlobRenderer | null>(null);
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const [reducedMotion, setReducedMotion] = useState(true);
  useImperativeHandle(forwardedRef, () => canvasRef.current!, []);

  function report(error: unknown) {
    const failure = error instanceof Error ? error :
      new BlobnoiseError("RENDER_FAILED", "The canvas renderer failed", { cause: error });
    if (errorRef.current) errorRef.current(failure);
    else console.error("[blobnoise]", failure);
  }

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      setReducedMotion(false);
      return;
    }
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      if (rendererRef.current) rendererRef.current.setConfig(config);
      else rendererRef.current = createRenderer(canvasRef.current, config, { onError: report });
    } catch (error) {
      report(error);
    }
  }, [config]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    try {
      if (playing && !reducedMotion) renderer.play();
      else renderer.pause();
    } catch (error) {
      report(error);
    }
  }, [playing, reducedMotion, config]);

  useEffect(() => () => {
    const renderer = rendererRef.current;
    rendererRef.current = null;
    try {
      renderer?.dispose();
    } catch (error) {
      report(error);
    }
  }, []);

  return <canvas {...canvasProps} ref={canvasRef} />;
});
