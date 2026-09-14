import fs from 'node:fs';
import sharp from 'sharp';

const WIDTH = 1648;
const HEIGHT = 924;
const ASPECT = WIDTH / HEIGHT;
const TAN_HALF_FOV = Math.tan((44 * Math.PI / 180) / 2);
const CAMERA_Z = 12.6;
const PIXEL_RATIO = 1.25;
const rgb = new Float32Array(WIDTH * HEIGHT * 3);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const readFloats = (path) => {
  const buffer = fs.readFileSync(path);
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
};
const project = (x, y, z) => {
  const depth = CAMERA_Z - z;
  if (depth <= 0.1) return null;
  const nx = x / (depth * TAN_HALF_FOV * ASPECT);
  const ny = y / (depth * TAN_HALF_FOV);
  if (Math.abs(nx) > 1.08 || Math.abs(ny) > 1.08) return null;
  return [(nx * 0.5 + 0.5) * WIDTH, (0.5 - ny * 0.5) * HEIGHT, depth];
};
const addPixel = (x, y, r, g, b, weight = 1) => {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= WIDTH || iy >= HEIGHT) return;
  const offset = (iy * WIDTH + ix) * 3;
  rgb[offset] += r * weight;
  rgb[offset + 1] += g * weight;
  rgb[offset + 2] += b * weight;
};

const addPoint = (x, y, z, r, g, b, size, intensity = 1) => {
  const p = project(x, y, z);
  if (!p) return;
  const [sx, sy, depth] = p;
  const distanceScale = clamp(10.8 / Math.max(1, depth), 0.46, 1.8);
  const pointSize = clamp(size * PIXEL_RATIO * distanceScale, 1, 10.5);
  const radius = pointSize > 4.2 ? 2 : pointSize > 1.7 ? 1 : 0;
  if (radius === 0) {
    addPixel(sx, sy, r, g, b, intensity);
    return;
  }
  const sigma = radius === 2 ? 1.18 : 0.78;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const weight = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
      addPixel(sx + dx, sy + dy, r, g, b, intensity * weight);
    }
  }
};
const morph = readFloats('src/assets/scene/home-morph.f32');
const terrain = readFloats('src/assets/scene/home-terrain.f32');
const stars = readFloats('src/assets/scene/home-stars.f32');

for (let i = 0; i < morph.length; i += 15) {
  addPoint(
    morph[i], morph[i + 1], morph[i + 2],
    morph[i + 6], morph[i + 7], morph[i + 8],
    morph[i + 12] * 0.78,
    2.55,
  );
}
for (let i = 0; i < terrain.length; i += 7) {
  addPoint(
    terrain[i], terrain[i + 1], terrain[i + 2],
    terrain[i + 3], terrain[i + 4], terrain[i + 5],
    terrain[i + 6],
    1.45,
  );
}
for (let i = 0; i < stars.length; i += 9) {
  addPoint(
    stars[i], stars[i + 1], stars[i + 2],
    stars[i + 3], stars[i + 4], stars[i + 5],
    stars[i + 6],
    1.25,
  );
}
const flowerCenter = project(4.9, 0.55, -6.2);
if (flowerCenter) {
  const [cx, cy] = flowerCenter;
  const radius = 118;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy) / radius;
      if (d >= 1) continue;
      const w = (1 - d) ** 3 * 0.32;
      addPixel(x, y, 1.15, 0.56, 0.24, w);
    }
  }
}

const coreCenter = project(4.92, -0.86, -6.12);
if (coreCenter) {
  const [cx, cy] = coreCenter;
  const rx = 52;
  const ry = 38;
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const d = Math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2);
      if (d >= 1) continue;
      const w = (1 - d) ** 2.6 * 0.16;
      addPixel(x, y, 1.22, 0.58, 0.26, w);
    }
  }
}

const orbit = (radiusX, radiusY, tiltDeg, spinDeg, intensity) => {
  const tilt = tiltDeg * Math.PI / 180;
  const spin = spinDeg * Math.PI / 180;
  let previous = null;
  for (let i = 0; i <= 640; i += 1) {
    const theta = (i / 640) * Math.PI * 2;
    const x = Math.cos(theta) * radiusX;
    const y = Math.sin(theta) * radiusY;
    const yt = y * Math.cos(tilt);
    const zt = y * Math.sin(tilt);
    const xs = x * Math.cos(spin) - yt * Math.sin(spin);
    const ys = x * Math.sin(spin) + yt * Math.cos(spin);
    const p = project(4.9 + xs, 0.55 + ys, -6.2 + zt);
    if (p && previous) {
      const steps = Math.max(1, Math.ceil(Math.hypot(p[0] - previous[0], p[1] - previous[1])));
      for (let s = 0; s <= steps; s += 1) {
        const t = s / steps;
        addPixel(previous[0] + (p[0] - previous[0]) * t, previous[1] + (p[1] - previous[1]) * t, 1.25, 0.55, 0.22, intensity);
      }
    }
    previous = p;
  }
};
orbit(5.4, 1.3, 62, -6, 0.28);
orbit(4.2, 1.02, -55, 22, 0.13);
const pixels = Buffer.alloc(WIDTH * HEIGHT * 3);
const exposure = 1.55;
for (let i = 0; i < WIDTH * HEIGHT; i += 1) {
  const src = i * 3;
  for (let c = 0; c < 3; c += 1) {
    const linear = Math.max(0, rgb[src + c]);
    const mapped = 1 - Math.exp(-linear * exposure);
    const gamma = mapped ** (1 / 2.2);
    pixels[src + c] = Math.round(clamp(gamma, 0, 1) * 255);
  }
}

const terrainHeight = (x, z) =>
  -2.72 - x * 0.018 - x * x * 0.0027 +
  Math.sin((x - 0.7) * 0.21) * 0.42 +
  Math.cos(z * 0.29) * 0.17 +
  Math.sin((x + z) * 0.14) * 0.17 +
  Math.exp(-((z - 1.6) ** 2) / 8) * 0.22;
const person = project(-1.65, terrainHeight(-1.65, 1.7) + 0.14, 1.7);
const personSvg = person ? Buffer.from(`
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <g fill="#020202" transform="translate(${person[0]} ${person[1]})">
    <ellipse cx="0" cy="-19" rx="4.2" ry="4.8"/>
    <path d="M-4 -14 L4 -14 L6 3 L3 3 L2 18 L-1 18 L-2 4 L-5 18 L-8 18 L-5 1 Z"/>
  </g>
</svg>`) : null;
const basePng = await sharp(pixels, {
  raw: { width: WIDTH, height: HEIGHT, channels: 3 },
}).png().toBuffer();
const glowNear = await sharp(basePng)
  .linear(0.52, 0)
  .blur(1.25)
  .png()
  .toBuffer();
const glowWide = await sharp(basePng)
  .linear(0.20, 0)
  .blur(4.0)
  .png()
  .toBuffer();

const composites = [
  { input: glowNear, blend: 'screen' },
  { input: glowWide, blend: 'screen' },
];
if (personSvg) composites.push({ input: personSvg, blend: 'over' });
await sharp(basePng)
  .composite(composites)
  .modulate({ brightness: 1.08, saturation: 1.03 })
  .png({ compressionLevel: 9 })
  .toFile('src/assets/scene/hero-fallback.png');
console.log('src/assets/scene/hero-fallback.png: deterministic hero rendered');
