# blobnoise

Organic Perlin textures and animated 3D spheres, generated in your browser.
Use the same seeded configuration in the visual studio and your application.

```js
import { createConfig } from "blobnoise";
import { createRenderer } from "blobnoise/browser";

const config = createConfig({
  seed: 42,
  material: { palette: ["#14203E", "#8B91DB", "#F4D8CE"] },
});
const renderer = createRenderer(document.querySelector("canvas"), config);
renderer.play();
// On unmount: renderer.dispose();
```

Give the canvas a CSS width and height. `renderAt(seconds)` renders an explicit
time; `setConfig(config)` updates a design, and `resize(width,height,ratio?)`
sets dimensions. Automatic resizing and hidden/offscreen pausing are included.

`blobnoise/export` exposes `exportWebP`, `exportWebM` and
`getExportCapabilities`. Exports return Blobs, run separately from a live
preview, support AbortSignal and do not upload designs. WebP supports alpha;
WebM uses a solid background with a supported VP9/VP8 encoder.

Use `createConfig`, `parseConfig`, `serializeConfig`, `createSnippet` and
`getPreset("Cloud" | "Mist" | "Nebula")` from the core. Configuration is validated
and versioned. `blobnoise/react` is an optional React adapter.

Browser/WebGL2 required for rendering. Core imports are SSR-safe; Node.js image
generation is not supported. Reproducible seeds/times do not guarantee
byte-identical output across GPUs or video encoders.

MIT project license; see `dist/LICENSE` and `dist/NOTICE` for dependency notices.
