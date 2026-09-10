import {
  Color, DataTexture, Euler, GLSL3, LinearFilter, Mesh, NoColorSpace,
  OrthographicCamera, PlaneGeometry, Quaternion, RGBAFormat, Scene,
  ShaderMaterial, SphereGeometry, SRGBColorSpace, UnsignedByteType,
  Vector3, WebGLRenderer, type BufferGeometry,
} from "three";
import { createConfig, type BlobConfig } from "../core/config";
import { BlobnoiseError } from "../core/errors";
import { palettePixels } from "../core/palette";
import { sampleTimeline } from "../core/timeline";
import { vertexShader, fragmentShader, haloFragment } from "./shaders";

export interface RendererOptions {
  pixelRatio?: number;
  autoResize?: boolean;
  releaseContext?: boolean;
  onError?: (error: Error) => void;
}

export interface BlobRenderer {
  readonly time: number;
  readonly playing: boolean;
  renderAt(seconds: number): void;
  play(): void;
  pause(): void;
  setConfig(config: unknown): void;
  resize(width: number, height: number, pixelRatio?: number): void;
  dispose(): void;
}

export function createRenderer(
  canvas: HTMLCanvasElement, input: unknown = {}, options: RendererOptions = {},
): BlobRenderer {
  let config = createConfig(input);
  if (typeof document === "undefined" || !canvas?.getContext) {
    throw new BlobnoiseError("WEBGL_UNAVAILABLE", "Rendering requires a browser canvas");
  }
  const context = canvas.getContext("webgl2", {
    alpha: true, antialias: true, premultipliedAlpha: true,
    preserveDrawingBuffer: true, powerPreference: "high-performance",
  });
  if (!context) throw new BlobnoiseError("WEBGL_UNAVAILABLE", "This device does not provide WebGL2");

  const renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true });
  renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
    throw new BlobnoiseError("RENDER_FAILED", [
      "The graphics driver could not compile the renderer.",
      gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(fragment),
    ].filter(Boolean).join("\n"));
  };
  renderer.outputColorSpace = SRGBColorSpace;
  const maxSize = Math.min(4096, renderer.capabilities.maxTextureSize,
    context.getParameter(context.MAX_RENDERBUFFER_SIZE));
  const scene = new Scene();
  const camera = new OrthographicCamera(-1.3, 1.3, 1.3, -1.3, 0.1, 10);
  camera.position.z = 4;
  const texture = new DataTexture(palettePixels(config.material.palette), 256, 1, RGBAFormat, UnsignedByteType);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.colorSpace = NoColorSpace;
  texture.needsUpdate = true;
  const uniforms = {
    uSeed: { value: config.seed }, uPalette: { value: texture },
    uSurface: { value: 1 }, uOctaves: { value: 4 }, uAspect: { value: 1 },
    uScale: { value: 2.4 }, uWarp: { value: 0.6 }, uSoftness: { value: 0.8 },
    uContrast: { value: 1 }, uEvolution: { value: 0.4 }, uAngle: { value: 0 },
    uGrain: { value: 0.04 }, uGrainSize: { value: 1 }, uGrainAnimated: { value: false },
    uGlow: { value: 0.15 }, uExposure: { value: 1 }, uGradient: { value: 0.15 },
    uGradientAngle: { value: 0 }, uLighting: { value: 0.35 }, uRim: { value: 0.3 },
  };
  const material = new ShaderMaterial({
    vertexShader, fragmentShader, uniforms, glslVersion: GLSL3,
  });
  const sphereGeometry = new SphereGeometry(1, 96, 64);
  const planeGeometry = new PlaneGeometry(2, 2);
  const mesh = new Mesh<BufferGeometry, ShaderMaterial>(sphereGeometry, material);
  const haloMaterial = new ShaderMaterial({
    vertexShader, fragmentShader: haloFragment, glslVersion: GLSL3,
    transparent: true, depthWrite: false,
    uniforms: { uGlow: { value: 0.15 }, uColor: { value: new Color(0.65, 0.7, 0.95) } },
  });
  const halo = new Mesh(planeGeometry, haloMaterial);
  halo.scale.setScalar(1.5);
  halo.position.z = -1.1;
  scene.add(halo, mesh);
  let disposed = false;
  let lost = false;
  let playing = false;
  let visible = true;
  let frame = 0;
  let time = 0;
  let previous: number | null = null;
  let aspect = 1;
  const axis = new Vector3();
  const rotation = new Quaternion();
  const orientation = new Quaternion();
  let resizeObserver: ResizeObserver | undefined;
  let intersectionObserver: IntersectionObserver | undefined;

  function assertReady() {
    if (disposed) throw new BlobnoiseError("DISPOSED", "This renderer has been disposed");
    if (lost) throw new BlobnoiseError("CONTEXT_LOST", "Graphics context was lost; waiting for restoration");
  }

  function applyConfig() {
    const m = config.material;
    uniforms.uSeed.value = config.seed;
    texture.image.data = palettePixels(m.palette);
    texture.needsUpdate = true;
    uniforms.uScale.value = m.noise.scale;
    uniforms.uOctaves.value = m.noise.octaves;
    uniforms.uWarp.value = m.noise.warp;
    uniforms.uSoftness.value = m.noise.softness;
    uniforms.uContrast.value = m.noise.contrast;
    uniforms.uEvolution.value = config.motion.evolution.amount;
    uniforms.uGrain.value = m.grain.amount;
    uniforms.uGrainSize.value = m.grain.size;
    uniforms.uGrainAnimated.value = m.grain.animated;
    uniforms.uGlow.value = m.glow.amount;
    uniforms.uExposure.value = m.exposure;
    uniforms.uGradient.value = m.gradient.strength;
    uniforms.uGradientAngle.value = m.gradient.angle * Math.PI / 180;
    const sphere = config.surface.kind === "sphere";
    mesh.geometry = sphere ? sphereGeometry : planeGeometry;
    uniforms.uSurface.value = sphere ? 1 : config.surface.kind === "texture" &&
      config.surface.projection === "equirectangular" ? 2 : 0;
    uniforms.uLighting.value = config.surface.kind === "sphere" ? config.surface.lighting.intensity : 0;
    uniforms.uRim.value = config.surface.kind === "sphere" ? config.surface.lighting.rim : 0;
    halo.visible = sphere && m.glow.amount > 0;
    haloMaterial.uniforms.uGlow.value = m.glow.amount;
    const midColor = m.palette[Math.floor(m.palette.length / 2)].color;
    haloMaterial.uniforms.uColor.value.set(midColor).convertLinearToSRGB();
    if (config.background === "transparent") renderer.setClearColor(0x000000, 0);
    else renderer.setClearColor(config.background.color, 1);
    layout();
  }

  function layout() {
    const x = 1.3 * Math.max(1, aspect);
    const y = 1.3 * Math.max(1, 1 / aspect);
    camera.left = -x; camera.right = x; camera.top = y; camera.bottom = -y;
    camera.updateProjectionMatrix();
    mesh.scale.set(config.surface.kind === "sphere" ? 1 : x,
      config.surface.kind === "sphere" ? 1 : y, 1);
    uniforms.uAspect.value = aspect;
  }

  function draw(seconds: number) {
    const state = sampleTimeline(config, seconds);
    uniforms.uAngle.value = state.evolutionAngle;
    if (config.surface.kind === "sphere") {
      axis.fromArray(config.surface.rotation.axis).normalize();
      rotation.setFromAxisAngle(axis, state.rotationRadians);
      const [x, y, z] = config.surface.orientation.map(v => v * Math.PI / 180);
      orientation.setFromEuler(new Euler(x, y, z, "XYZ"));
      mesh.quaternion.copy(rotation).multiply(orientation);
    } else {
      mesh.quaternion.identity();
    }
    renderer.render(scene, camera);
    time = seconds;
  }

  function report(error: Error) {
    if (options.onError) options.onError(error);
    else console.error("[blobnoise]", error);
  }

  function cancelFrame() {
    cancelAnimationFrame(frame);
    frame = 0;
    previous = null;
  }

  function schedule() {
    if (!frame && playing && visible && !document.hidden && !lost && !disposed) {
      frame = requestAnimationFrame(tick);
    }
  }

  function tick(now: number) {
    frame = 0;
    const elapsed = previous === null ? 0 : (now - previous) / 1000;
    previous = now;
    try {
      draw(time + elapsed);
    } catch (error) {
      playing = false;
      previous = null;
      report(error instanceof Error ? error : new BlobnoiseError("RENDER_FAILED", String(error)));
      return;
    }
    schedule();
  }

  function onVisibility() {
    cancelFrame();
    schedule();
  }

  function onLost(event: Event) {
    event.preventDefault();
    lost = true;
    cancelFrame();
    report(new BlobnoiseError("CONTEXT_LOST", "Graphics context lost. Playback will resume if restored."));
  }

  function onRestored() {
    if (disposed) return;
    lost = false;
    applyConfig();
    draw(time);
    schedule();
  }

  function resize(width: number, height: number, pixelRatio = options.pixelRatio ?? Math.min(devicePixelRatio || 1, 2)) {
    assertReady();
    if (![width, height, pixelRatio].every(Number.isFinite) || width < 1 || height < 1 ||
        pixelRatio <= 0 || Math.floor(width * pixelRatio) > maxSize ||
        Math.floor(height * pixelRatio) > maxSize) {
      throw new BlobnoiseError("LIMIT_EXCEEDED", `Render dimensions must be positive and at most ${maxSize} pixels per side`);
    }
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)), false);
    aspect = width / height;
    layout();
    draw(time);
  }

  function resizeToElement() {
    if (disposed || lost) return;
    const width = canvas.clientWidth || 512;
    const height = canvas.clientHeight || 512;
    const ratio = Math.min(options.pixelRatio ?? Math.min(devicePixelRatio || 1, 2),
      maxSize / width, maxSize / height);
    resize(width, height, ratio);
  }

  function dispose() {
    if (disposed) return;
    playing = false;
    cancelFrame();
    disposed = true;
    resizeObserver?.disconnect();
    intersectionObserver?.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("webglcontextlost", onLost);
    canvas.removeEventListener("webglcontextrestored", onRestored);
    texture.dispose();
    material.dispose();
    haloMaterial.dispose();
    sphereGeometry.dispose();
    planeGeometry.dispose();
    renderer.dispose();
    if (options.releaseContext) renderer.forceContextLoss();
  }

  try {
    applyConfig();
    if (options.autoResize !== false) {
      resizeToElement();
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(resizeToElement);
        resizeObserver.observe(canvas);
      }
      if (typeof IntersectionObserver !== "undefined") {
        intersectionObserver = new IntersectionObserver(entries => {
          visible = entries[0]?.isIntersecting ?? true;
          onVisibility();
        });
        intersectionObserver.observe(canvas);
      }
    } else {
      resize(canvas.width || 512, canvas.height || 512, options.pixelRatio ?? 1);
    }
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    document.addEventListener("visibilitychange", onVisibility);
  } catch (error) {
    dispose();
    throw error;
  }

  return {
    get time() { return time; },
    get playing() { return playing; },
    renderAt(seconds) { assertReady(); draw(seconds); previous = null; },
    play() { assertReady(); playing = true; schedule(); },
    pause() {
      if (disposed) throw new BlobnoiseError("DISPOSED", "This renderer has been disposed");
      playing = false;
      cancelFrame();
    },
    setConfig(value) { assertReady(); config = createConfig(value); applyConfig(); draw(time); },
    resize,
    dispose,
  };
}
