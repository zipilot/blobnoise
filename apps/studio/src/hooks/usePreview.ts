import { useCallback, useEffect, useRef, useState } from "react";
import { createRenderer } from "blobnoise/browser";
import type { BlobConfig } from "blobnoise";
import { errorMessage } from "./useStudioConfig";

export function usePreview(config: BlobConfig) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ReturnType<typeof createRenderer> | null>(null);
  const configRef = useRef(config);
  configRef.current = config;
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [playing, setPlaying] = useState(!reducedMotion);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const [time, setTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const fail = useCallback((reason: unknown) => {
    setError(errorMessage(reason));
    setPlaying(false);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(media.matches);
      if (media.matches) setPlaying(false);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    setError(null);
    setReady(false);
    try {
      const instance = createRenderer(canvasRef.current, configRef.current, {
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        autoResize: true,
        onError: fail,
      });
      renderer.current = instance;
      setTime(0);
      if (playingRef.current) instance.play();
      setReady(true);
    } catch (reason) {
      fail(reason);
    }
    return () => {
      renderer.current?.dispose();
      renderer.current = null;
    };
  }, [attempt, fail]);

  useEffect(() => {
    try {
      renderer.current?.setConfig(config);
    } catch (reason) {
      fail(reason);
    }
  }, [config, fail]);

  useEffect(() => {
    try {
      if (playing) renderer.current?.play();
      else renderer.current?.pause();
    } catch (reason) {
      fail(reason);
    }
    if (!playing) return;
    const timer = window.setInterval(() => {
      if (renderer.current) setTime(renderer.current.time);
    }, 80);
    return () => window.clearInterval(timer);
  }, [playing, attempt, fail]);

  const seek = useCallback((seconds: number) => {
    setPlaying(false);
    try {
      renderer.current?.pause();
      renderer.current?.renderAt(seconds);
      setTime(seconds);
    } catch (reason) {
      fail(reason);
    }
  }, [fail]);

  return {
    canvasRef, time, playing, reducedMotion, ready, error, seek,
    toggle: () => setPlaying(value => !value),
    retry: () => setAttempt(value => value + 1),
  };
}
