# Implementation status

Updated: 2026-09-10. This is a local implementation record, not a claim of
public availability or universal browser support.

## Package

Implemented: validated/versioned configuration, original Perlin/fBm material,
periodic domain warping, OKLab palettes, gradients, grain, glow, plane and true
sphere rendering, equirectangular texture maps, independent rotation/evolution,
explicit-time seeking, resize/visibility lifecycle, context recovery, WebP,
frame-driven WebM and optional React bindings.

The package emits ESM, source maps and TypeScript declarations for four public
entry points. All built entries import in Node without browser globals.
Rendering itself remains browser-only.

## Studio

Implemented: responsive live preview, original preset choices, flat/sphere
switching, palette stops, material/lighting/vector controls, both motion
modes, playback/scrubbing, shuffle locks, undo/redo/reset, validated JSON/file
import, resilient local autosave, complete JavaScript/config downloads and
cancellable media downloads.

Loop exports use the draft's exact duration; they do not secretly retime a
clone. Only free-mode export has independent clip duration. The studio uses
the same public package API and generates `THIRD-PARTY-LICENSES.md` with
production builds.

## Evidence recorded on this host

| Area | Observation |
|---|---|
| Core/export/React unit behavior | 84 passing tests |
| Renderer and media browser integration | 10 passing Chromium tests, including decoded WebM frames, cancellation, image alpha, repeatability, context recovery and canvas reuse |
| Studio integration | 11 passing Chromium tests, including unchanged draft loop timing, actual downloads and mobile layout |
| Full local checkpoint | `npm run check` passed: typecheck, 84 unit tests, package/studio builds and all 21 browser tests |
| Production studio | Built static assets loaded without runtime errors; actual WebP download worked; desktop/mobile layouts inspected |
| 4K WebP | Actual 4096 x 4096 transparent image, 2,001,822 bytes |
| 1080p WebM | Actual 1920 x 1080 VP9 export, 30 frames at 30 FPS, 593,011 bytes |
| Visual inspection | Original cloudy sphere and Mist texture rendered and inspected; not an owner approval or an ElevenLabs equivalence claim |

Resolution probes used the default material and a one-second loop in
Chromium 153.0.8010.12 on Linux, with **software SwiftShader**, not a reference
consumer GPU. The 4K still took approximately 50 seconds; the one-second 1080p
clip took approximately 74 seconds. These are environment-specific
observations, not performance promises or real-time video rendering.

A worst-case namespace-import bundle probe excluded React and Mediabunny
from both core and browser entry points. Including dependencies, the core
probe was approximately 94 KB gzip and browser probe 232 KB gzip; this is not
a claim of a tiny, zero-dependency renderer. Actual consumer imports may differ.

## Limits

The 60-FPS desktop/30-FPS mobile preview goals have not been established on
named physical reference hardware. Firefox, Safari, iOS and Android do not
have a measured compatibility guarantee here. Runtime feature detection and
clear errors remain necessary.

Video output is opaque, has no audio and depends on a supported VP9/VP8
WebCodecs encoder. Exports run cooperatively on the main thread; compressed
output is retained in memory. Cancellation during finalization waits for
encoder cleanup. No worker/offscreen renderer, server renderer, HTTP service,
AI image service, cloud save or telemetry is implemented.

## Release boundary

Local source is maintained in its own Git repository. A distributable
`blobnoise-0.1.0.tgz` archive and `apps/studio/dist` are generated artifacts,
not tracked source or evidence of external publication.

The intended repository is `zipilot/blobnoise`; the npm name `blobnoise`
returned registry 404 on 2026-09-10 and is not reserved by this lookup.
MIT was selected as the implementation default for original project code.
Mediabunny 1.56.1 is MPL-2.0, not MIT; its source availability and notices are
documented in the project NOTICE and generated third-party license output.

No public repository creation, npm publication, hosting deployment or domain
configuration was performed. Before release, confirm organization/package
publishing rights, name availability, license/notice distribution and the
intended hosting destination. Public release remains a separate action.

TypeScript is pinned to 5.9.3 because the selected tsup declaration worker did
not support TypeScript 7. The build-only esbuild override selects 0.28.2 to
avoid a vulnerable transitive version; both JavaScript and declarations build
with that combination.
