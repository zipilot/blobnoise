import type { BlobConfig } from "./config";
import { BlobnoiseError } from "./errors";

export function sampleTimeline(config: BlobConfig, seconds: number) {
  if (!Number.isFinite(seconds)) {
    throw new BlobnoiseError("INVALID_CONFIG", "Time must be finite");
  }
  const motion = config.motion;
  const phase = motion.mode === "loop"
    ? ((seconds % motion.durationSeconds) + motion.durationSeconds) % motion.durationSeconds / motion.durationSeconds
    : seconds * motion.speed;
  const evolutionAngle = phase * Math.PI * 2 * (motion.mode === "loop" ? motion.evolution.cycles : 1);
  const rotation = config.surface.kind === "sphere" ? config.surface.rotation : null;
  const rotationRadians = rotation
    ? rotation.mode === "loop" ? phase * rotation.turns * Math.PI * 2 : seconds * rotation.rpm / 60 * Math.PI * 2
    : 0;
  return { phase, evolutionAngle, rotationRadians };
}

export function frameSchedule(durationSeconds: number, fps: number) {
  if (![24, 30, 60].includes(fps) || !Number.isFinite(durationSeconds) ||
      durationSeconds < 1 || durationSeconds > 20) {
    throw new BlobnoiseError("INVALID_CONFIG", "Use 24, 30 or 60 FPS and a duration from 1 to 20 seconds");
  }
  const count = durationSeconds * fps;
  if (Math.abs(count - Math.round(count)) > 1e-7) {
    throw new BlobnoiseError("INVALID_CONFIG", "Duration multiplied by FPS must be a whole number of frames");
  }
  return { count: Math.round(count), durationSeconds, fps, timestamp: (i: number) => i / fps };
}

export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
