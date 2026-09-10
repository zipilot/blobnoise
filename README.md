# blobnoise

Original, organic Perlin-noise textures and animated 3D spheres for the browser.
Shape a cloudy material in the studio, save its configuration, and use the same
renderer in your own JavaScript application.

**Development status:** local implementation, not an npm publication or hosted
service. The intended project home is `zipilot/blobnoise`. See
[implementation status](docs/status.md) for supported paths and release gates.

## Run the studio

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Designs and exports stay in your browser.
The studio has no accounts, hosted rendering API, analytics or remote assets.

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

`npm run build` builds the package and static studio. The website output is
`apps/studio/dist`; it can be served by an ordinary static host. The browser
harness is development-only and is not a production build entry point.

## Embed

Build the package first. While unpublished, install a local package directory
or a tarball produced by `npm pack --workspace blobnoise`.

```js
import { createConfig } from "blobnoise";
import { createRenderer } from "blobnoise/browser";

const canvas = document.querySelector("canvas");
const config = createConfig({
  seed: 42,
  material: { palette: ["#14203E", "#8B91DB", "#F4D8CE"] },
});
const renderer = createRenderer(canvas, config);
renderer.play();

// Later, before removing the canvas:
renderer.dispose();
```

Give the canvas a CSS width and height. By default its drawing buffer follows
the element size at a capped pixel ratio. The core and browser modules can be
imported during SSR, but creating a renderer needs an actual browser.

## Create assets

```js
import { exportWebP, exportWebM } from "blobnoise/export";

const still = await exportWebP(config, {
  width: 2048, height: 2048, timeSeconds: 2, background: "transparent",
});
const video = await exportWebM(config, {
  width: 1920, height: 1080, fps: 30,
  background: "#10121A",
  onProgress: ({ completedFrames, totalFrames }) =>
    console.log(completedFrames, totalFrames),
});
```

Both functions return a `Blob`; the caller chooses how to download or use it.
Export runs separately from the preview. WebM encoder dependencies are loaded
only when needed. No frame is recorded from real-time screen playback.

WebP supports transparency. WebM uses an opaque background and a supported
VP9/VP8 browser encoder; unsupported devices receive an explicit error rather
than an incorrectly named or silently substituted file.

## Reproducible, not frozen

The configuration contains a seed, algorithm version, material, surface and
timeline. `renderAt(seconds)` derives a frame directly from those inputs,
without needing earlier frames. Rotation and material evolution are separate.

Loop mode joins both motion and position continuously. A sphere completes
integer turns over a loop: `RPM = 60 * turns / durationSeconds`. Free mode lets
you choose arbitrary RPM but does not promise a seamless export. Videos omit
the duplicate endpoint frame.

Per-device GPU rounding and codecs may differ. Reproducible inputs and
timelines do not mean byte-identical videos on every machine.

## Project layout

| Path | Purpose |
|---|---|
| `packages/blobnoise` | DOM-free configuration, browser renderer, exports, React adapter |
| `apps/studio` | Visual editor consuming the public package API |
| `tests` | Real-browser rendering, media and studio behavior |
| `docs/api.md` | Configuration, API and error contracts |
| `docs/status.md` | Implementation evidence, limitations and remaining release work |

See [contributing](CONTRIBUTING.md), [license](LICENSE) and
[dependency notices](NOTICE). The materials and presets are original. This
project is not affiliated with or endorsed by ElevenLabs.
