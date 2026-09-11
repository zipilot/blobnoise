# Implementation status

Updated: 2026-09-11. The source and studio are public; browser support
and physical-device performance remain subject to the limits below.

- Source: [alejo-valencia/blobnoise](https://github.com/alejo-valencia/blobnoise).
- Studio: [public CloudFront website](https://d16acm1lzz4dn2.cloudfront.net/).
- Hosting: `blobnoise-studio` CloudFormation stack and S3 origin in us-east-2;
  CloudFront delivery is global.
- npm-format package: `@alejo-valencia/blobnoise@0.1.0`, published under the
  personal account with public visibility. Registry authentication is required.
  The legacy `@zipilot/blobnoise@0.1.0` package has not been deleted.

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

The 2026-09-10 interface refinement removes decorative slogans, counters and
version badges. A dedicated **Randomize colors** action preserves seed,
shape, motion, color-stop count/positions and other settings, and participates
in palette locking and undo/redo. The code dialog links to registry/authentication setup and uses the scoped
package name rather than assuming an unscoped npmjs.org publication.

## Initial implementation evidence recorded on this host

| Area | Observation |
|---|---|
| Core/export/React unit behavior | 84 passing tests |
| Renderer and media browser integration | 10 passing Chromium tests, including decoded WebM frames, cancellation, image alpha, repeatability, context recovery and canvas reuse |
| Studio integration | 11 passing Chromium tests, including unchanged draft loop timing, actual downloads and mobile layout |
| Full local checkpoint | `npm run check` passed: typecheck, 84 unit tests, package/studio builds and all 21 browser tests |
| Production studio | Built static assets loaded without runtime errors; actual WebP download worked; desktop/mobile layouts inspected |
| Public CloudFront release | HTTPS studio rendered and downloaded WebP plus a decodable 128 x 128, one-second WebM; no runtime errors; HTTP redirected to HTTPS |
| Origin access | S3 origin confirmed in us-east-2 with all public-access blocks enabled; direct unauthenticated object access returned 403 |
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

## Release status

### Personal ownership and discoverability, 2026-09-11

The transferred source and SEO changes are live. The editor links to the
personal GitHub repository. Initial HTML contains a useful visible description,
canonical/title/description metadata, Open Graph and Twitter cards, and
accurate WebApplication structured data. Robots, sitemap, original social
images and a real HTTP 404 page are served through the existing CloudFront
URL. The page's information remains available without JavaScript.

The [personal release workflow](https://github.com/alejo-valencia/blobnoise/actions/runs/34548634845)
published `@alejo-valencia/blobnoise@0.1.0`, verified an actual registry install
and reported **public** package visibility. The
[transferred-repository CI run](https://github.com/alejo-valencia/blobnoise/actions/runs/34548625146)
passed all 84 unit tests, package/studio builds and 26 browser tests. The
public smoke flow exercised source links, scoped snippets, no-JavaScript
content, robots/sitemap/social assets, HTTP 404 and WebP/WebM downloads
without runtime errors. Desktop and 320-pixel mobile layouts were inspected.

Search-engine crawling/indexing timing and rankings remain outside the
application's control. No Search Console submission or indexing result is
claimed. See [search metadata](seo.md).

### Legacy organization version, 2026-09-10

The legacy GitHub Packages publication succeeded on 2026-09-10 through the repository's
Actions token. The release workflow installed version 0.1.0 from the actual
registry in a clean temporary project, imported all four entry points,
exercised the configuration/snippet contract and typechecked a consuming
project against the shipped declarations. This was not a workspace symlink
or local tarball installation.

Release run:
<https://github.com/alejo-valencia/blobnoise/actions/runs/34540877755>.
Registry authentication is required; see [package distribution](packages.md).
The verification-only run confirmed actual package visibility is private
despite requesting public access at publication. Source/studio visibility is
unchanged. A package administrator can change visibility in GitHub's package
settings; that setting was not claimed to be public.

Source is committed and pushed to its own public GitHub repository. A distributable
package archive and `apps/studio/dist` are generated artifacts,
not tracked source or evidence of external publication.

The repository moved from `zipilot/blobnoise` to `alejo-valencia/blobnoise`
on 2026-09-11. Git history and the live CloudFront URL are preserved. Current
imports/publishing use `@alejo-valencia/blobnoise`; old registry scopes do not
redirect with repository URLs. No package version was deleted or overwritten.
MIT was selected as the implementation default for original project code.
Mediabunny 1.56.1 is MPL-2.0, not MIT; its source availability and notices are
documented in the project NOTICE and generated third-party license output.

The owner authorized public GitHub/AWS delivery on 2026-09-10. The static
studio is deployed behind CloudFront with a private, encrypted, versioned
S3 origin, HTTPS redirection and scoped read-only origin access. The
repository CI completed successfully after the initial push.

GitHub Packages publication was requested separately on 2026-09-10; see
[package distribution](packages.md) for installation and authentication.
No npmjs.org publication or custom domain was configured. See
[hosting](hosting.md) for deployment, cost and teardown details. Physical
device testing and broader browser evidence remain release-quality follow-ups,
not established guarantees.

TypeScript is pinned to 5.9.3 because the selected tsup declaration worker did
not support TypeScript 7. The build-only esbuild override selects 0.28.2 to
avoid a vulnerable transitive version; both JavaScript and declarations build
with that combination.
