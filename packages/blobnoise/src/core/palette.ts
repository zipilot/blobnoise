import type { ColorStop } from "./config";

const linear = (c: number) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const encoded = (c: number) => c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;

function toLab(hex: string) {
  const r = linear(parseInt(hex.slice(1, 3), 16) / 255);
  const g = linear(parseInt(hex.slice(3, 5), 16) / 255);
  const b = linear(parseInt(hex.slice(5, 7), 16) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromLab([L, a, b]: number[]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(c => Math.round(Math.min(1, Math.max(0, encoded(c))) * 255));
}

export function palettePixels(stops: ColorStop[]): Uint8Array {
  const pixels = new Uint8Array(256 * 4);
  const labs = stops.map(stop => toLab(stop.color));
  let segment = 0;
  for (let i = 0; i < 256; i++) {
    const x = i / 255;
    while (segment < stops.length - 2 && x > stops[segment + 1].position) segment++;
    const t = (x - stops[segment].position) / (stops[segment + 1].position - stops[segment].position);
    const lab = labs[segment].map((v, j) => v + (labs[segment + 1][j] - v) * t);
    pixels.set([...fromLab(lab), 255], i * 4);
  }
  return pixels;
}
