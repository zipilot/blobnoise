# Rendering design

The pipeline is deliberately small: a seeded gradient field, material mapping,
a surface projection and a timeline. No user-supplied GLSL or JavaScript is
evaluated by configuration import.

## Perlin material

Integer hashing chooses one of twelve lattice gradients. Dot products at
eight cell corners are interpolated with the quintic Perlin fade curve.
Multiple weighted octaves add cloud detail. Lower-frequency vector fields
warp the sample domain instead of simulating fluid or physical clouds.

Time follows a smooth circular trajectory, with phase offsets across the
domain-warp components. In loop mode, both the value and derivative repeat.
There is no incremental simulation to rewind, so seeking and offline export
use the same rendering function as playback.

The field addresses a 256-texel palette LUT interpolated in OKLab. Material
colors are decoded to linear light before illumination and exposure, then
encoded to sRGB. Seeded design-space grain is added at the end. Optional
animated grain mixes two fixed grain fields periodically.

## Surfaces

A full-screen plane samples the field in aspect-correct planar coordinates.
A true sphere mesh samples its normalized local position. Rotating that mesh
changes both its surface orientation and the visible field while retaining
world-space illumination. The equirectangular projection maps UV coordinates
back to the same sphere direction, avoiding discontinuous texture wrapping.

The soft halo is an independent transparent plane behind the sphere. It is
not a promise of physically based bloom, volumetric scattering or refraction.
The background may be transparent for a still image. Video composites onto
an explicit opaque background.

## Versioning and output

The algorithm identifier is independent of the JSON schema version. Changing
shader behavior that changes saved designs requires an algorithm-compatibility
decision. Future configuration migrations must be explicit and reject unknown
versions rather than silently changing a design.

Loop export samples `i / fps` for `i = 0 ... N-1`; the frame at `T` is omitted.
Exact-time reproducibility is assessed within a particular rendering
environment. Different graphics drivers and encoders can produce small color
or binary differences.

## Operational boundaries

The package owns its GPU resources, observers and animation callbacks, not the
caller-owned canvas element. Disposing a live renderer permits immediate
canvas reuse. Dedicated temporary export canvases release their contexts.

Exports bound dimensions, duration and frame rate, honor backpressure and
release per-frame resources. The encoded output is retained for its Blob,
not all raw input frames. Export currently yields cooperatively on the main
thread; moving the renderer to a worker is future optimization, not a
different timeline or a license to skip frames.
