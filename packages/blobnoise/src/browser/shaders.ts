export const vertexShader = `
out vec3 vLocal;
out vec3 vNormal;
out vec2 vUv;
void main() {
  vLocal = position;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const fragmentShader = `
precision highp float;
precision highp int;
in vec3 vLocal;
in vec3 vNormal;
in vec2 vUv;
out vec4 fragColor;
uniform uint uSeed;
uniform sampler2D uPalette;
uniform int uSurface;
uniform int uOctaves;
uniform float uAspect;
uniform float uScale;
uniform float uWarp;
uniform float uSoftness;
uniform float uContrast;
uniform float uEvolution;
uniform float uAngle;
uniform float uGrain;
uniform float uGrainSize;
uniform bool uGrainAnimated;
uniform float uGlow;
uniform float uExposure;
uniform float uGradient;
uniform float uGradientAngle;
uniform float uLighting;
uniform float uRim;

uint hashCell(ivec3 cell, uint seed) {
  uvec3 q = uvec3(cell);
  uint h = seed ^ (q.x * 374761393u) ^ (q.y * 668265263u) ^ (q.z * 2246822519u);
  h = (h ^ (h >> 13u)) * 1274126177u;
  return h ^ (h >> 16u);
}
vec3 gradient(ivec3 cell) {
  uint h = hashCell(cell, uSeed) % 12u;
  float a = (h & 1u) == 0u ? 1.0 : -1.0;
  float b = (h & 2u) == 0u ? 1.0 : -1.0;
  if (h < 4u) return vec3(a, b, 0.0);
  if (h < 8u) return vec3(a, 0.0, b);
  return vec3(0.0, a, b);
}
float perlin(vec3 p) {
  ivec3 cell = ivec3(floor(p));
  vec3 f = fract(p);
  vec3 w = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(gradient(cell), f);
  float b = dot(gradient(cell + ivec3(1,0,0)), f - vec3(1,0,0));
  float c = dot(gradient(cell + ivec3(0,1,0)), f - vec3(0,1,0));
  float d = dot(gradient(cell + ivec3(1,1,0)), f - vec3(1,1,0));
  float e = dot(gradient(cell + ivec3(0,0,1)), f - vec3(0,0,1));
  float g = dot(gradient(cell + ivec3(1,0,1)), f - vec3(1,0,1));
  float h = dot(gradient(cell + ivec3(0,1,1)), f - vec3(0,1,1));
  float j = dot(gradient(cell + ivec3(1,1,1)), f - vec3(1,1,1));
  return mix(mix(mix(a,b,w.x), mix(c,d,w.x), w.y),
             mix(mix(e,g,w.x), mix(h,j,w.x), w.y), w.z);
}
float fbm(vec3 p) {
  float result = 0.0;
  float weight = 0.5;
  float total = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= uOctaves) break;
    result += weight * perlin(p);
    total += weight;
    p = p * 2.03 + vec3(7.3, 13.1, 3.7);
    weight *= mix(0.55, 0.25, uSoftness);
  }
  return result / total;
}
vec3 decodeColor(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}
vec3 encodeColor(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(vec3(0.0031308), c));
}
void main() {
  vec3 point;
  if (uSurface == 1) {
    point = normalize(vLocal);
  } else if (uSurface == 2) {
    float longitude = vUv.x * 6.28318530718;
    float latitude = (1.0 - vUv.y) * 3.14159265359;
    point = vec3(-cos(longitude) * sin(latitude), cos(latitude), sin(longitude) * sin(latitude));
  } else {
    point = vec3((vUv.x - 0.5) * 2.0 * uAspect, (vUv.y - 0.5) * 2.0, 0.3);
  }
  vec3 p = point * uScale + vec3(4.17, 9.31, 2.83);
  // Periodic, phase-offset domain warps preserve both position and velocity at a loop boundary.
  vec3 orbit = vec3(cos(uAngle), sin(uAngle), cos(uAngle + 1.7)) * uEvolution;
  vec3 warp = vec3(
    perlin(p * 0.7 + orbit),
    perlin(p * 0.7 + orbit.yzx + vec3(13.5, 2.8, 7.1)),
    perlin(p * 0.7 + orbit.zxy + vec3(3.2, 17.6, 9.4))
  );
  float field = fbm(p + warp * uWarp * 3.0 + orbit * 0.35);
  float value = 0.5 + field * uContrast * (2.4 - uSoftness);
  vec3 direction = vec3(cos(uGradientAngle), sin(uGradientAngle), 0.35);
  value = mix(value, 0.5 + dot(point, normalize(direction)) * 0.4, uGradient);
  vec3 c = decodeColor(texture(uPalette, vec2(clamp(value, 0.0, 1.0), 0.5)).rgb);
  if (uSurface == 1) {
    vec3 n = normalize(vNormal);
    float light = max(0.0, dot(n, normalize(vec3(-0.5, 0.7, 1.2))));
    c *= mix(1.0, 0.45 + 0.65 * light, uLighting);
    c += uRim * 0.16 * pow(1.0 - max(n.z, 0.0), 2.5) * vec3(0.65,0.73,1.0);
  }
  c += uGlow * 0.35 * c * c;
  c = encodeColor(c * uExposure);
  ivec3 grainCell = ivec3(floor(point * (450.0 / uGrainSize)));
  float grain = float(hashCell(grainCell, uSeed ^ 92837111u) & 65535u) / 65535.0 - 0.5;
  if (uGrainAnimated) {
    float other = float(hashCell(grainCell, uSeed ^ 192831u) & 65535u) / 65535.0 - 0.5;
    grain = grain * cos(uAngle) + other * sin(uAngle);
  }
  fragColor = vec4(clamp(c + grain * uGrain, 0.0, 1.0), 1.0);
}
`;

export const haloFragment = `
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform float uGlow;
uniform vec3 uColor;
void main() {
  float radius = length(vUv - 0.5) * 2.0;
  float alpha = exp(-pow((radius - 0.67) * 7.0, 2.0)) * uGlow * 0.16;
  alpha *= 1.0 - smoothstep(0.85, 1.0, radius);
  fragColor = vec4(uColor, alpha);
}
`;
