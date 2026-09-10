import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { getPreset, presetNames, randomSeed, serializeConfig, type BlobConfig } from "blobnoise";
import { useStudioConfig, errorMessage } from "./hooks/useStudioConfig";
import { usePreview } from "./hooks/usePreview";
import { ConfigDialog } from "./components/ConfigDialog";
import { ExportDialog } from "./components/ExportDialog";
import { Icon } from "./components/Icon";
import { Inspector, changeSurface } from "./components/Inspector";
import { NumberField } from "./components/Controls";

function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomPalette(random: () => number, positions = [0, 1 / 3, 2 / 3, 1]): BlobConfig["material"]["palette"] {
  const hue = random() * 360;
  return positions.map((position, index) => {
    const lightness = 0.14 + position * 0.72;
    const h = (hue + index * (12 + random() * 18)) % 360 / 30;
    const saturation = 0.2 + random() * 0.4;
    const a = saturation * Math.min(lightness, 1 - lightness);
    const channel = (n: number) => {
      const k = (n + h) % 12;
      return Math.round(255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
        .toString(16).padStart(2, "0");
    };
    return { position, color: `#${channel(0)}${channel(8)}${channel(4)}` };
  });
}

export default function App() {
  const studio = useStudioConfig();
  const { config, edit } = studio;
  const preview = usePreview(config);
  const [paletteLocked, setPaletteLocked] = useState(false);
  const [shapeLocked, setShapeLocked] = useState(false);
  const [dialog, setDialog] = useState<"code" | "import" | "export" | null>(null);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");
  const notify = useCallback((message: string) => setNotice(message), []);
  const currentPreset = useMemo(() =>
    presetNames.find(name => serializeConfig(getPreset(name)) === serializeConfig(config)) ?? "Custom", [config]);
  const duration = config.motion.mode === "loop" ? config.motion.durationSeconds : 20;
  const playhead = config.motion.mode === "loop" ? preview.time % duration : Math.min(preview.time, duration);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || dialog) return;
      const element = event.target;
      if (element instanceof HTMLElement && (element.matches("input, textarea, select") || element.isContentEditable)) return;
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) studio.redo(); else studio.undo();
      } else if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        studio.redo();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [studio.undo, studio.redo, dialog]);

  const openDialog = (next: "code" | "import" | "export") => {
    preview.seek(preview.time);
    setDialog(next);
  };
  const shuffle = () => {
    try {
      const seed = randomSeed();
      const random = createRandom(seed);
      const rounded = (value: number) => Math.round(value * 100) / 100;
      edit(draft => {
        if (!shapeLocked) draft.seed = seed;
        if (!paletteLocked) draft.material.palette = randomPalette(random);
        if (!shapeLocked) draft.material.noise = {
          scale: rounded(1.2 + random() * 2.6),
          octaves: 3 + Math.floor(random() * 3),
          warp: rounded(0.2 + random() * 0.9),
          softness: rounded(0.6 + random() * 0.4),
          contrast: rounded(0.7 + random() * 0.8),
        };
      });
      setActionError("");
      notify("Variation randomized.");
    } catch (reason) { setActionError(errorMessage(reason)); }
  };
  const randomizeColors = () => {
    try {
      const random = createRandom(randomSeed());
      edit(draft => {
        draft.material.palette = randomPalette(random, draft.material.palette.map(stop => stop.position));
      });
      setActionError("");
      notify("Colors randomized.");
    } catch (reason) { setActionError(errorMessage(reason)); }
  };

  return (
    <div className="studio">
      <a className="skip-link" href="#inspector">Skip to texture controls</a>
      <header className="app-header">
        <div className="brand"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span><h1>blobnoise<span className="brand-dot">.</span></h1></div>
        <div className="header-actions">
          <span className={`save-state ${studio.saveStatus === "unsaved" ? "save-error" : ""}`} role="status">
            <span className="status-dot" />{studio.saveStatus === "saved" ? "Saved locally" : studio.saveStatus === "saving" ? "Saving…" : "Not saved"}
          </span>
          <button type="button" className="button text-button" aria-label="Import configuration" onClick={() => openDialog("import")}><Icon name="upload" /><span className="optional-label">Import</span></button>
          <button type="button" className="button secondary" onClick={() => openDialog("code")}><Icon name="code" /><span>Get code</span></button>
          <button type="button" className="button primary" onClick={() => openDialog("export")}><Icon name="download" /><span>Export</span></button>
        </div>
      </header>

      {studio.storageError && <div className="global-error" role="alert"><span>{studio.storageError}</span><button type="button" onClick={studio.retrySave}>Retry save</button><button type="button" onClick={() => openDialog("code")}>Download config</button></div>}
      {actionError && <div className="global-error" role="alert"><span>{actionError}</span><button type="button" onClick={() => setActionError("")}>Dismiss</button></div>}

      <main className="workspace">
        <section className="main-column" aria-label="Texture workspace">
          <a className="mobile-controls" href="#inspector">Controls <Icon name="chevron" /></a>
          <div className={`preview-stage ${config.background === "transparent" ? "checkerboard" : ""}`}
            style={config.background !== "transparent" ? { backgroundColor: config.background.color } : undefined}>
            <div className="preview-topbar">
              <div className="segmented surface-switch" role="group" aria-label="Preview surface">
                <button type="button" aria-pressed={config.surface.kind === "sphere"} onClick={() => edit(draft => changeSurface(draft, "sphere"))}><span className="surface-icon sphere-icon" aria-hidden="true" />Sphere</button>
                <button type="button" aria-pressed={config.surface.kind === "texture"} onClick={() => edit(draft => changeSurface(draft, "texture"))}><span className="surface-icon plane-icon" aria-hidden="true" />Plane</button>
              </div>
            </div>
            <div className="canvas-wrap"><canvas ref={preview.canvasRef} aria-label={`Procedural ${config.surface.kind === "sphere" ? "sphere" : "plane"} preview`} data-testid="preview-canvas" /></div>
            {!preview.ready && !preview.error && <p className="preview-loading">Loading preview…</p>}
            {preview.error && <div className="preview-error" role="alert"><strong>Preview unavailable</strong><p>{preview.error}</p><p>Requires WebGL 2. Your settings and config export are still available.</p><button type="button" className="button secondary" onClick={preview.retry}>Retry preview</button></div>}
            <span className="corner corner-tl" aria-hidden="true" /><span className="corner corner-tr" aria-hidden="true" /><span className="corner corner-bl" aria-hidden="true" /><span className="corner corner-br" aria-hidden="true" />
          </div>
          <div className="playback-bar">
            <button type="button" className="play-button" aria-label={preview.playing ? "Pause animation" : "Play animation"}
              disabled={!preview.ready || !!preview.error} onClick={preview.toggle}><Icon name={preview.playing ? "pause" : "play"} size={17} /></button>
            <div className="timeline">
              <div className="timeline-heading"><span>{config.motion.mode === "loop" ? "Seamless loop" : "Free motion"}{preview.reducedMotion && <span className="reduced-label"> · Reduced motion</span>}</span>
                <span className="timecode" data-testid="timecode">{playhead.toFixed(2)} <span>/ {duration.toFixed(2)}s</span></span></div>
              <input className="range timeline-range" type="range" aria-label="Scrub animation" min={0} max={duration} step={0.01}
                value={playhead} disabled={!preview.ready || !!preview.error}
                style={{ "--fill": `${playhead / duration * 100}%` } as CSSProperties}
                onChange={event => preview.seek(Number(event.target.value))} />
            </div>
            <span className="loop-symbol" title={config.motion.mode === "loop" ? "Looping timeline" : "Scrub the first 20 seconds"} aria-hidden="true">{config.motion.mode === "loop" ? "∞" : "↗"}</span>
          </div>
          <div className="presets-heading"><h3>Presets</h3><button type="button" className="shuffle-button"
            disabled={paletteLocked && shapeLocked} title={paletteLocked && shapeLocked ? "Unlock palette or shape to create a variation." : "Randomize the unlocked palette and formation"}
            onClick={shuffle}><Icon name="shuffle" />Shuffle variation</button></div>
          <div className="preset-grid" role="group" aria-label="Texture presets">
            {presetNames.map(name => <button type="button" className={`preset-card ${currentPreset === name ? "selected" : ""}`}
              key={name} aria-pressed={currentPreset === name} aria-label={`${name} preset`} onClick={() => {
                studio.commit(getPreset(name));
                preview.seek(0);
                notify(`${name} preset loaded. Undo to return to your previous settings.`);
              }}>
              <span className={`preset-art preset-art-${name.toLowerCase()}`} aria-hidden="true"><i /></span>
              <span className="preset-description"><strong>{name}</strong></span>
              {currentPreset === name && <span className="preset-number" aria-hidden="true"><Icon name="check" size={13} /></span>}
            </button>)}
          </div>
        </section>

        <aside className="inspector" id="inspector" aria-label="Texture inspector" tabIndex={-1}>
          <div className="inspector-heading"><h2>Settings</h2>
            <div className="history-actions">
              <button type="button" className="icon-button" aria-label="Undo" title="Undo (Ctrl/⌘ Z)" disabled={!studio.canUndo} onClick={studio.undo}><Icon name="undo" /></button>
              <button type="button" className="icon-button" aria-label="Redo" title="Redo (Ctrl/⌘ Shift Z)" disabled={!studio.canRedo} onClick={studio.redo}><Icon name="redo" /></button>
              <button type="button" className="icon-button" aria-label="Reset to Cloud" title="Reset to Cloud (undoable)" onClick={() => { studio.reset(); preview.seek(0); notify("Reset to Cloud. Undo is available."); }}><Icon name="reset" /></button>
            </div>
          </div>
          <div className="seed-row"><NumberField label="Seed" value={config.seed} min={0} max={4294967295} step={1} compact
            onChange={value => edit(draft => { draft.seed = value; })} />
            <button type="button" className="icon-button" aria-label="Randomize seed" title="Change the seed only" onClick={() => {
              try { edit(draft => { draft.seed = randomSeed(); }); setActionError(""); }
              catch (reason) { setActionError(errorMessage(reason)); }
            }}><Icon name="shuffle" size={15} /></button>
          </div>
          <Inspector config={config} edit={edit} paletteLocked={paletteLocked} shapeLocked={shapeLocked}
            togglePaletteLock={() => setPaletteLocked(value => !value)} toggleShapeLock={() => setShapeLocked(value => !value)}
            randomizeColors={randomizeColors} />
        </aside>
      </main>
      <div className={`toast ${notice ? "visible" : ""}`} role="status">{notice && <><Icon name="check" />{notice}</>}</div>
      {dialog === "export" && <ExportDialog config={config} time={preview.time} onClose={() => setDialog(null)} notify={notify} />}
      {(dialog === "code" || dialog === "import") && <ConfigDialog mode={dialog} config={config} onImport={studio.commit} onClose={() => setDialog(null)} notify={notify} />}
    </div>
  );
}
