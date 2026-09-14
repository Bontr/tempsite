import fs from 'node:fs';

const sampleRows = (sourcePath, outputPath, stride, count) => {
  const buffer = fs.readFileSync(sourcePath);
  const source = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
  const total = source.length / stride;
  if (!Number.isInteger(total) || total < count) throw new Error(`${sourcePath}: insufficient source rows`);
  const output = new Float32Array(count * stride);
  for (let index = 0; index < count; index += 1) {
    const sourceIndex = count <= 1 ? 0 : Math.min(total - 1, Math.floor((index / (count - 1)) * (total - 1)));
    output.set(source.subarray(sourceIndex * stride, sourceIndex * stride + stride), index * stride);
  }
  fs.writeFileSync(outputPath, Buffer.from(output.buffer));
  console.log(`${outputPath}: ${count} baked rows`);
};

const hash01 = (index, salt) => {
  let value = (index + 1 + salt * 374761393) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177) >>> 0;
  value ^= value >>> 16;
  return value / 4294967296;
};
const halton = (index, base) => {
  let result = 0;
  let fraction = 1 / base;
  let value = index;
  while (value > 0) {
    result += fraction * (value % base);
    value = Math.floor(value / base);
    fraction /= base;
  }
  return result;
};
const lerp = (a, b, t) => a + (b - a) * t;

sampleRows('source-data/home-morph.source.f32', 'public/data/home-morph.f32', 15, 90000);
sampleRows('source-data/home-terrain.source.f32', 'public/data/home-terrain.f32', 7, 46000);

const starCount = 12000;
const stride = 9;
const stars = new Float32Array(starCount * stride);
const cool = [0.72, 0.78, 0.84];
const warm = [1.58, 0.72, 0.34];
for (let index = 0; index < starCount; index += 1) {
  const sequence = index + 1;
  const jitterX = (hash01(index, 11) - 0.5) * 0.16;
  const jitterY = (hash01(index, 12) - 0.5) * 0.16;
  const jitterZ = (hash01(index, 13) - 0.5) * 0.16;
  const offset = index * stride;
  stars[offset] = ((halton(sequence, 2) + jitterX + 1) % 1 * 2 - 1) * 18;
  stars[offset + 1] = -7.5 + (((halton(sequence, 3) + jitterY + 1) % 1) * 2 - 1) * 20.5;
  stars[offset + 2] = -7 - ((halton(sequence, 5) + jitterZ + 1) % 1) * 18;
  const seed = hash01(index, 20260909);
  const warmth = seed < 0.08 ? 0.55 + hash01(index, 21) * 0.45 : 0;
  const brightness = 0.52 + hash01(index, 22) * 0.5;
  stars[offset + 3] = lerp(cool[0], warm[0], warmth) * brightness;
  stars[offset + 4] = lerp(cool[1], warm[1], warmth) * brightness;
  stars[offset + 5] = lerp(cool[2], warm[2], warmth) * brightness;
  stars[offset + 6] = 0.55 + hash01(index, 23) * 0.9 + (hash01(index, 24) < 0.018 ? 1.2 : 0);
  stars[offset + 7] = hash01(index, 25) < 0.012 ? 1 : 0;
  stars[offset + 8] = seed;
}
fs.writeFileSync('public/data/home-stars.f32', Buffer.from(stars.buffer));
console.log(`public/data/home-stars.f32: ${starCount} baked rows`);
