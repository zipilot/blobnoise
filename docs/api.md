# API

The package is ESM with TypeScript declarations. Imports do not initialize
graphics contexts or start timers. Import the feature you need:
`@alejo-valencia/blobnoise`, `@alejo-valencia/blobnoise/browser`,
`@alejo-valencia/blobnoise/export`, or `@alejo-valencia/blobnoise/react`.

## Configuration

`createConfig(input?)` validates unknown input, fills defaults and returns a
fresh normalized `BlobConfig`. `configSchema` exposes the same Zod schema.
Unknown keys, versions and invalid numeric/color values are rejected.

| Field | Contract |
|---|---|
| `schemaVersion` | `1` |
| `algorithmVersion` | `"perlin-v1"` |
| `seed` | Unsigned 32-bit integer |
| `material.palette` | 2-8 hex colors or strictly increasing `{color, position}` stops from 0 to 1; normalized to stops |
| `material.noise` | Scale 0.1-10, integer octaves 1-6, warp 0-2, softness 0.05-1, contrast 0.2-3 |
| `material.grain` | Amount 0-0.3, size 0.5-8, animated boolean |
| `material.glow.amount` | 0-1, emissive enhancement and soft sphere halo |
| `material.gradient` | Strength 0-1 and angle 0-360 degrees |
| `material.exposure` | 0.25-2 |
| `background` | `{color: "#rrggbb"}` or `"transparent"` |
| `surface` | Sphere or texture, as below |
| `motion` | Loop or free, as below |

Colors are six-digit hex. Palette interpolation uses OKLab, with shading in
linear RGB and sRGB output. Grain uses design/object-space coordinates rather
than physical export pixels. Sphere glow is not a volumetric simulation or
general-purpose bloom pipeline.

```js
// Flat designs:
surface: { kind: "texture", projection: "planar" }
// A sphere's material as a 2:1 UV image:
surface: { kind: "texture", projection: "equirectangular" }
// A real sphere with rotation in its shared loop:
surface: {
  kind: "sphere",
  rotation: { mode: "loop", axis: [0, 1, 0], turns: 1 },
  orientation: [0, 0, 0],
  lighting: { intensity: 0.35, rim: 0.3 }
}
```

The axis is a nonzero vector normalized by the renderer. Orientation is XYZ
Euler degrees. Sphere noise is sampled in object space; lighting remains in
world space. Planar and spherical projections share a material, not identical
pixels. Grain is part of the material; sphere lighting/halo are presentation.

```js
motion: {
  mode: "loop",
  durationSeconds: 8,
  evolution: { amount: 0.45, cycles: 1 }
}
// Free motion, requiring sphere.rotation.mode = "free" when using a sphere:
motion: { mode: "free", speed: 0.08, evolution: { amount: 0.45 } }
// Its independent rotation:
rotation: { mode: "free", axis: [0, 1, 0], rpm: 4 }
```

Loop duration is 1-20 seconds; cycles are integer 0-8 and turns integer -8 to 8.
Free evolution speed is 0-2 cycles/second, rotation -60 to 60 RPM, and evolution
amount 0-2. Free evolution follows a periodic path at the chosen rate but has
no synchronized seamless-clip promise. Zero evolution amount fixes the
material shape. Zero turns/RPM stops rotation independently.

`serializeConfig(config)` includes normalized defaults.
`parseConfig(json)` rejects text longer than 65,536 code units, invalid JSON
and unsupported configurations. Importing executable code is not supported.
`createSnippet(config)` produces JavaScript for a bundler-based embedding.
`getPreset("Cloud" | "Mist" | "Nebula")` returns an independent configuration.
`randomSeed()` uses the browser's cryptographic random source.

## Renderer

`createRenderer(canvas, config?, options?)` returns:

| Member | Behavior |
|---|---|
| `renderAt(seconds)` | Draw immediately at any finite explicit time; rebase subsequent playback |
| `play()` / `pause()` | Start or stop live playback |
| `setConfig(config)` | Replace the full configuration after validation; preserve current time |
| `resize(width, height, pixelRatio?)` | Set logical dimensions and drawing-buffer ratio |
| `time` / `playing` | Read-only playback state |
| `dispose()` | Idempotent GPU, observer, event and animation cleanup |

Options: `pixelRatio`, `autoResize` (default true), `onError(error)` and
`releaseContext` (default false). Disposing releases owned GPU resources but
retains the canvas context by default so framework remounts can reuse it.
Dedicated export canvases opt into releasing the context too.
The default pixel ratio is capped at 2 and automatic dimensions obey the
device limit. Explicit render dimensions are bounded to 4096 pixels per side
and the device's actual texture/renderbuffer limit.

Live playback pauses while hidden or offscreen and resumes without charging
hidden time. Reduced-motion policy belongs to the embedding; the studio and
React adapter honor it. Rendering errors during animation stop playback and
reach `onError`, or the console when no callback is supplied. Context loss is
reported; playback can resume if the browser restores the context.

## Exports

Both helpers use independent canvases, validate requested dimensions and
support `AbortSignal`. They do not resize or seek an existing live renderer.

`exportWebP(config, {width, height, timeSeconds?, background?, signal?})`
supports dimensions up to 4096 per side. `background` is a hex string or
`"transparent"`. The actual MIME must be `image/webp`.

`exportWebM(config, {width, height, fps?, durationSeconds?, background?,
signal?, onProgress?})` renders exact frame timestamps before muxing WebM.
FPS is 24, 30 or 60; duration is 1-20 seconds and must give an integral frame
count. Loop exports use the configured loop duration, not an unrelated
override. Free-mode clips may select their own duration.

Video limits are 1920 pixels per side and 1920 * 1080 total pixels, allowing
portrait output. Browser-specific codec limits can be lower. A supported
VP9 encoder is preferred, with VP8 as the explicit alternative. Alpha video
and audio are not supported.

`onProgress({completedFrames,totalFrames})` counts submitted frames; the final
file is ready only when the promise resolves. Cancellation rejects with
`BlobnoiseError` and code `CANCELLED`. Encoders, sources and renderer resources
are released. Export cooperatively yields on the main thread; there is no
worker/offscreen-rendering claim in this release.

`getExportCapabilities({width,height,fps?})` asynchronously reports WebP and
WebM capability, chosen codec or null, and an explanatory reason when available.
Encoding support is configuration-dependent and does not guarantee an export
will succeed after GPU or memory exhaustion.

## Errors

`BlobnoiseError` has a stable `code` plus a human-readable message. Codes:
`INVALID_CONFIG`, `WEBGL_UNAVAILABLE`, `CONTEXT_LOST`, `RENDER_FAILED`,
`DISPOSED`, `UNSUPPORTED_FORMAT`, `EXPORT_FAILED`, `LIMIT_EXCEEDED`, `CANCELLED`.
Catch errors at the integration boundary and present them to the user.
Do not treat a rejected export as a completed download.

## React

```tsx
import { BlobNoise } from "@alejo-valencia/blobnoise/react";

<BlobNoise
  config={config}
  playing
  onError={error => console.error(error)}
  aria-label="An animated cloudy sphere"
  style={{ width: "100%", height: 480 }}
/>;
```

`playing` defaults to true; a reduced-motion preference pauses the adapter.
Canvas attributes and a forwarded canvas ref are supported. Configuration
changes update the existing renderer; unmounting releases it. React is not
required by the core, browser or export entry points.
