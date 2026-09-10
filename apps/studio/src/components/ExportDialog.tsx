import { useEffect, useRef, useState } from "react";
import type { BlobConfig } from "@zipilot/blobnoise";
import type { ExportCapabilities } from "@zipilot/blobnoise/export";
import { errorMessage } from "../hooks/useStudioConfig";
import { ColorField, Toggle } from "./Controls";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { downloadBlob } from "./files";

export function ExportDialog({ config, time, onClose, notify }: {
  config: BlobConfig; time: number; onClose: () => void; notify: (message: string) => void;
}) {
  const [format, setFormat] = useState<"webp" | "webm">("webp");
  const [width, setWidth] = useState("1080");
  const [height, setHeight] = useState("1080");
  const [fps, setFps] = useState<24 | 30 | 60>(30);
  const [duration, setDuration] = useState(String(config.motion.mode === "loop" ? config.motion.durationSeconds : 8));
  const [transparent, setTransparent] = useState(config.background === "transparent");
  const [background, setBackground] = useState(config.background === "transparent" ? "#141416" : config.background.color);
  const [backgroundValid, setBackgroundValid] = useState(true);
  const [capabilities, setCapabilities] = useState<ExportCapabilities | null>(null);
  const [capabilityError, setCapabilityError] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({ completedFrames: 0, totalFrames: 0 });
  const [working, setWorking] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const formatName = format === "webp" ? "WebP" : "WebM";
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const widthNumber = Number(width);
  const heightNumber = Number(height);
  const durationNumber = config.motion.mode === "loop" ? config.motion.durationSeconds : Number(duration);
  const dimensionsValid = [widthNumber, heightNumber].every(value => Number.isInteger(value) && value >= 1 && value <= 4096);
  const wholeFrames = Math.abs(durationNumber * fps - Math.round(durationNumber * fps)) < 1e-7;
  const durationValid = duration.trim() !== "" && Number.isFinite(durationNumber) && durationNumber >= 1 && durationNumber <= 20 && wholeFrames;
  const supported = capabilities?.[format] === true;
  const settingsValid = dimensionsValid && (format === "webp" || durationValid)
    && ((format === "webp" && transparent) || backgroundValid);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); };
  }, []);

  useEffect(() => {
    let active = true;
    setCapabilities(null);
    setCapabilityError("");
    if (!dimensionsValid) return;
    const timeout = window.setTimeout(() => {
      void import("@zipilot/blobnoise/export").then(module => module.getExportCapabilities({
        width: widthNumber, height: heightNumber, fps,
      })).then(result => { if (active) setCapabilities(result); })
        .catch(reason => { if (active) setCapabilityError(errorMessage(reason)); });
    }, 200);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [widthNumber, heightNumber, fps, dimensionsValid]);

  const startExport = async () => {
    if (controller.current || !settingsValid || !supported) return;
    setError("");
    setWorking(true);
    setCanceling(false);
    setProgress({ completedFrames: 0, totalFrames: format === "webm" ? Math.round(durationNumber * fps) : 1 });
    const abort = new AbortController();
    controller.current = abort;
    try {
      const module = await import("@zipilot/blobnoise/export");
      const blob = format === "webp"
        ? await module.exportWebP(config, { width: widthNumber, height: heightNumber, timeSeconds: time, background: transparent ? "transparent" : background, signal: abort.signal })
        : await module.exportWebM(config, {
          width: widthNumber, height: heightNumber, fps, durationSeconds: durationNumber, background,
          signal: abort.signal, onProgress: value => { if (mounted.current) setProgress(value); },
        });
      if (!abort.signal.aborted && mounted.current) {
        downloadBlob(blob, `blobnoise-${config.seed}-${widthNumber}x${heightNumber}.${format}`);
        notify(`${formatName} download started.`);
        onClose();
      }
    } catch (reason) {
      if (mounted.current) {
        setError(abort.signal.aborted ? "Export canceled. Your draft has not changed." : `Export failed: ${errorMessage(reason)}`);
      }
    } finally {
      controller.current = null;
      if (mounted.current) { setWorking(false); setCanceling(false); }
    }
  };
  const cancel = () => { setCanceling(true); controller.current?.abort(); };
  const percent = progress.totalFrames ? Math.round(progress.completedFrames / progress.totalFrames * 100) : 0;

  return (
    <Modal title="Export" onClose={onClose}>
      <fieldset disabled={working} className="export-settings">
        <legend className="sr-only">Export settings</legend>
        <div className="format-options" role="group" aria-label="Export format">
          <button type="button" aria-label="WebP image" aria-pressed={format === "webp"} onClick={() => { setFormat("webp"); setError(""); }}>
            <strong>WebP</strong><span>Still image</span><small>Transparency supported</small>
          </button>
          <button type="button" aria-label="WebM video" aria-pressed={format === "webm"} onClick={() => { setFormat("webm"); setError(""); }}>
            <strong>WebM</strong><span>Video</span><small>Solid background · up to 20s</small>
          </button>
        </div>
        <div className="export-dimensions">
          <label>Width<input type="number" min="1" max="4096" step="1" value={width} onChange={event => setWidth(event.target.value)} /></label>
          <span aria-hidden="true">×</span>
          <label>Height<input type="number" min="1" max="4096" step="1" value={height} onChange={event => setHeight(event.target.value)} /></label>
          <span className="dimension-unit">px</span>
        </div>
        <div className="size-presets" role="group" aria-label="Export size presets">
          <button type="button" onClick={() => { setWidth("512"); setHeight("512"); }}>512 square</button>
          <button type="button" onClick={() => { setWidth("1080"); setHeight("1080"); }}>1080 square</button>
          <button type="button" onClick={() => { setWidth("1920"); setHeight("1080"); }}>1920 × 1080</button>
        </div>
        {!dimensionsValid && <p className="field-error" role="alert">Width and height must be whole numbers from 1 to 4096.</p>}
        {format === "webm" ? <>
          <div className="export-video-fields">
            <label>Frame rate<select value={fps} onChange={event => setFps(Number(event.target.value) as 24 | 30 | 60)}>
              <option value={24}>24 fps</option><option value={30}>30 fps</option><option value={60}>60 fps</option>
            </select></label>
            <label>Duration (seconds)<input type="number" min="1" max="20" step="0.1"
              readOnly={config.motion.mode === "loop"}
              value={config.motion.mode === "loop" ? config.motion.durationSeconds : duration}
              aria-describedby="video-timing-help"
              onChange={event => setDuration(event.target.value)} /></label>
          </div>
          {!durationValid && <p className="field-error" role="alert">{config.motion.mode === "loop"
            ? `The draft loop must produce whole frames at ${fps} fps. Choose another frame rate or change Loop duration in the Motion controls.`
            : `Use 1–20 seconds and a duration that produces whole frames at ${fps} fps.`}</p>}
          <p className="helper" id="video-timing-help">{config.motion.mode === "loop"
            ? "Duration matches your draft exactly. To change it, close this dialog and edit Loop duration in Motion. Preview, config, and video keep the same timing."
            : "Video starts at time zero. Frames are encoded individually, not screen-recorded."}</p>
        </> : <><Toggle label="Transparent WebP" checked={transparent} onChange={setTransparent} /><p className="helper">Still frame at {time.toFixed(2)}s. A plane fills the canvas; a sphere leaves transparent space around it.</p></>}
        {(format === "webm" || !transparent) && <div className="background-field export-background"><span>Solid background</span>
          <ColorField label="Export background" value={background} onChange={setBackground} onValidityChange={setBackgroundValid} /></div>}
      </fieldset>
      <div className="export-support" role="status">
        {capabilityError ? `Capability check failed: ${capabilityError}` : !dimensionsValid ? "Set valid dimensions to check export support."
          : !capabilities ? "Checking browser export support…"
            : supported ? `${format === "webm" ? capabilities.codec?.toUpperCase() : "WebP"} supported at this size.${format === "webm" ? " Maximum video area: 1920 × 1080 pixels." : ""}`
              : capabilities.reason || `${formatName} is not supported by this browser at these settings.`}
      </div>
      {working && <div className="export-progress" aria-live="polite">
        <div><span>{canceling ? "Canceling and releasing resources…" : format === "webp" ? "Rendering your still…" : percent === 100 ? "Finalizing video…" : "Rendering your video…"}</span><span>{format === "webm" ? `${percent}%` : ""}</span></div>
        <progress aria-label="Export progress" max={progress.totalFrames || 1} value={format === "webp" ? undefined : progress.completedFrames} />
        {format === "webm" && <small>{progress.completedFrames} / {progress.totalFrames} frames</small>}
      </div>}
      {error && <p className="error-message" role="alert">{error}</p>}
      <div className="modal-actions">
        <span className="helper">{working ? "Keep this tab open while exporting." : "Your original config stays unchanged."}</span>
        {working
          ? <button type="button" className="button secondary" disabled={canceling} onClick={cancel}>Cancel export</button>
          : <button type="button" className="button primary" disabled={!settingsValid || !supported} onClick={() => void startExport()}><Icon name="download" />Export {formatName}</button>}
      </div>
    </Modal>
  );
}
