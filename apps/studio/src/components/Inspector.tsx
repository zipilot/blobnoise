import { type BlobConfig, type ColorStop } from "blobnoise";
import { ColorField, LockButton, NumberField, Section, Toggle } from "./Controls";

type Edit = (change: (draft: BlobConfig) => void) => void;
const axes = ["X", "Y", "Z"] as const;

export function changeMotion(draft: BlobConfig, mode: "loop" | "free") {
  if (draft.motion.mode === mode) return;
  const amount = draft.motion.evolution.amount;
  draft.motion = mode === "loop"
    ? { mode, durationSeconds: 8, evolution: { amount, cycles: 1 } }
    : { mode, speed: 0.08, evolution: { amount } };
  if (draft.surface.kind === "sphere") {
    const axis = draft.surface.rotation.axis;
    draft.surface.rotation = mode === "loop" ? { mode, axis, turns: 1 } : { mode, axis, rpm: 4 };
  }
}

export function changeSurface(draft: BlobConfig, kind: "sphere" | "texture") {
  if (draft.surface.kind === kind) return;
  draft.surface = kind === "texture" ? { kind, projection: "planar" } : {
    kind, orientation: [0, 0, 0], lighting: { intensity: 0.35, rim: 0.3 },
    rotation: draft.motion.mode === "loop"
      ? { mode: "loop", axis: [0, 1, 0], turns: 1 }
      : { mode: "free", axis: [0, 1, 0], rpm: 4 },
  };
}

function midpointColor(a: string, b: string) {
  return `#${[1, 3, 5].map(start => Math.round(
    (parseInt(a.slice(start, start + 2), 16) + parseInt(b.slice(start, start + 2), 16)) / 2,
  ).toString(16).padStart(2, "0")).join("")}`;
}

function addStop(stops: ColorStop[]) {
  let index = 0;
  for (let i = 1; i < stops.length - 1; i++) {
    if (stops[i + 1].position - stops[i].position > stops[index + 1].position - stops[index].position) index = i;
  }
  const left = stops[index];
  const right = stops[index + 1];
  stops.splice(index + 1, 0, { position: (left.position + right.position) / 2, color: midpointColor(left.color, right.color) });
}

export function Inspector({ config, edit, paletteLocked, shapeLocked, togglePaletteLock, toggleShapeLock }: {
  config: BlobConfig; edit: Edit; paletteLocked: boolean; shapeLocked: boolean;
  togglePaletteLock: () => void; toggleShapeLock: () => void;
}) {
  const { material, surface, motion } = config;
  const noiseField = (key: keyof typeof material.noise, label: string, min: number, max: number, step = 0.01) =>
    <NumberField key={key} label={label} value={material.noise[key]} min={min} max={max} step={step}
      onChange={value => edit(draft => { draft.material.noise[key] = value; })} />;

  return (
    <>
      <Section title="Palette" trailing={<span className="section-count">{material.palette.length} colors</span>}>
        <div className="section-subheading"><span>From shadow to light</span><LockButton name="Palette" locked={paletteLocked} onChange={togglePaletteLock} /></div>
        <div className="palette-ribbon" role="img" aria-label="Current color gradient"
          style={{ background: `linear-gradient(90deg, ${material.palette.map(stop => `${stop.color} ${stop.position * 100}%`).join(", ")})` }} />
        <div className="stop-heading"><span>Color</span><span>Position</span></div>
        <div className="palette-stops">
          {material.palette.map((stop, index) => {
            const endpoint = index === 0 || index === material.palette.length - 1;
            return <div className="palette-stop" key={index}>
              <ColorField label={`Color stop ${index + 1}`} value={stop.color}
                onChange={color => edit(draft => { draft.material.palette[index].color = color; })} />
              <NumberField label={`Stop ${index + 1} position`} value={stop.position * 100}
                min={0} max={100} step={0.1} compact disabled={endpoint} suffix="%"
                onChange={value => edit(draft => { draft.material.palette[index].position = value / 100; })} />
              <button type="button" className="remove-stop" aria-label={`Remove color stop ${index + 1}`}
                disabled={endpoint} title={endpoint ? "The first and last stops anchor the palette." : "Remove color stop"}
                onClick={() => edit(draft => { draft.material.palette.splice(index, 1); })}>−</button>
            </div>;
          })}
        </div>
        <button className="add-stop" type="button" disabled={material.palette.length >= 8}
          onClick={() => edit(draft => addStop(draft.material.palette))}>+ Add color stop <span>{material.palette.length}/8</span></button>
      </Section>

      <Section title="Shape">
        <div className="section-subheading"><span>Find your formation</span><LockButton name="Shape" locked={shapeLocked} onChange={toggleShapeLock} /></div>
        {noiseField("scale", "Scale", 0.1, 10)}
        {noiseField("octaves", "Octaves", 1, 6, 1)}
        {noiseField("warp", "Warp", 0, 2)}
        {noiseField("softness", "Softness", 0.05, 1)}
        {noiseField("contrast", "Contrast", 0.2, 3)}
        {shapeLocked && <p className="helper">Shuffle keeps these settings and the seed. Direct edits still work.</p>}
      </Section>

      <Section title="Finish" defaultOpen={false}>
        <NumberField label="Grain amount" value={material.grain.amount} min={0} max={0.3} step={0.005}
          onChange={value => edit(draft => { draft.material.grain.amount = value; })} />
        <NumberField label="Grain size" value={material.grain.size} min={0.5} max={8} step={0.1} suffix="×"
          onChange={value => edit(draft => { draft.material.grain.size = value; })} />
        <Toggle label="Animated grain" checked={material.grain.animated}
          onChange={value => edit(draft => { draft.material.grain.animated = value; })} />
        <NumberField label="Glow" value={material.glow.amount} min={0} max={1}
          onChange={value => edit(draft => { draft.material.glow.amount = value; })} />
        <NumberField label="Exposure" value={material.exposure} min={0.25} max={2}
          onChange={value => edit(draft => { draft.material.exposure = value; })} />
        <NumberField label="Gradient strength" value={material.gradient.strength} min={0} max={1}
          onChange={value => edit(draft => { draft.material.gradient.strength = value; })} />
        <NumberField label="Gradient angle" value={material.gradient.angle} min={0} max={360} step={1} suffix="°"
          onChange={value => edit(draft => { draft.material.gradient.angle = value; })} />
      </Section>

      <Section title={surface.kind === "sphere" ? "Sphere" : "Projection"} defaultOpen={false}>
        {surface.kind === "sphere" ? <>
          <NumberField label="Lighting" value={surface.lighting.intensity} min={0} max={1}
            onChange={value => edit(draft => { if (draft.surface.kind === "sphere") draft.surface.lighting.intensity = value; })} />
          <NumberField label="Rim light" value={surface.lighting.rim} min={0} max={1}
            onChange={value => edit(draft => { if (draft.surface.kind === "sphere") draft.surface.lighting.rim = value; })} />
          <p className="control-caption">Orientation · degrees</p>
          <div className="vector-fields">{axes.map((axis, index) =>
            <NumberField key={axis} label={`Orientation ${axis}`} value={surface.orientation[index]} min={-360} max={360} step={1} compact
              onChange={value => edit(draft => { if (draft.surface.kind === "sphere") draft.surface.orientation[index] = value; })} />)}</div>
          <p className="control-caption">Rotation axis · at least one nonzero</p>
          <div className="vector-fields">{axes.map((axis, index) =>
            <NumberField key={axis} label={`Axis ${axis}`} value={surface.rotation.axis[index]} min={-1e6} max={1e6} step={0.1} compact
              onChange={value => edit(draft => { if (draft.surface.kind === "sphere") draft.surface.rotation.axis[index] = value; })} />)}</div>
          {surface.rotation.mode === "loop"
            ? <NumberField label="Rotation turns" value={surface.rotation.turns} min={-8} max={8} step={1}
              onChange={value => edit(draft => { if (draft.surface.kind === "sphere" && draft.surface.rotation.mode === "loop") draft.surface.rotation.turns = value; })} />
            : <NumberField label="Rotation speed" value={surface.rotation.rpm} min={-60} max={60} step={0.1} suffix="rpm"
              onChange={value => edit(draft => { if (draft.surface.kind === "sphere" && draft.surface.rotation.mode === "free") draft.surface.rotation.rpm = value; })} />}
          <p className="helper">Rotation follows the motion mode below. Whole turns keep loop endpoints aligned.</p>
          {surface.rotation.mode === "loop" && motion.mode === "loop" &&
            <p className="helper">Effective rotation: {(60 * surface.rotation.turns / motion.durationSeconds).toFixed(2)} RPM.</p>}
        </> : <label className="select-field">Texture projection
          <select value={surface.projection} onChange={event => edit(draft => {
            if (draft.surface.kind === "texture") draft.surface.projection = event.target.value as "planar" | "equirectangular";
          })}><option value="planar">Planar</option><option value="equirectangular">Equirectangular</option></select>
          <span className="helper">Equirectangular wraps the texture for use on a sphere.</span>
        </label>}
      </Section>

      <Section title="Motion">
        <div className="segmented" role="group" aria-label="Motion mode">
          <button type="button" aria-pressed={motion.mode === "loop"} onClick={() => edit(draft => changeMotion(draft, "loop"))}>Loop</button>
          <button type="button" aria-pressed={motion.mode === "free"} onClick={() => edit(draft => changeMotion(draft, "free"))}>Free</button>
        </div>
        {motion.mode === "loop" ? <>
          <NumberField label="Loop duration" value={motion.durationSeconds} min={1} max={20} step={0.1} suffix="s"
            onChange={value => edit(draft => { if (draft.motion.mode === "loop") draft.motion.durationSeconds = value; })} />
          <NumberField label="Evolution cycles" value={motion.evolution.cycles} min={0} max={8} step={1}
            onChange={value => edit(draft => { if (draft.motion.mode === "loop") draft.motion.evolution.cycles = value; })} />
        </> : <NumberField label="Evolution speed" value={motion.speed} min={0} max={2} step={0.01}
          onChange={value => edit(draft => { if (draft.motion.mode === "free") draft.motion.speed = value; })} />}
        <NumberField label="Evolution amount" value={motion.evolution.amount} min={0} max={2}
          onChange={value => edit(draft => { draft.motion.evolution.amount = value; })} />
        <p className="helper">{motion.mode === "loop" ? "A complete cycle, designed to meet where it began." : "Independent motion, not locked to a shared loop."}</p>
      </Section>

      <Section title="Canvas" defaultOpen={false}>
        <Toggle label="Transparent background" checked={config.background === "transparent"}
          onChange={checked => edit(draft => { draft.background = checked ? "transparent" : { color: "#10121A" }; })} />
        {config.background !== "transparent" && <div className="background-field">
          <span>Background</span><ColorField label="Canvas background" value={config.background.color}
            onChange={color => edit(draft => { draft.background = { color }; })} />
        </div>}
        <p className="helper">Transparency is available for stills. Video uses a solid background you choose at export.</p>
      </Section>
    </>
  );
}
