import fs from 'node:fs';

const assets = [
  { path: 'src/assets/scene/home-morph.f32', stride: 15, rows: 90000 },
  { path: 'src/assets/scene/home-terrain.f32', stride: 7, rows: 46000 },
  { path: 'src/assets/scene/home-stars.f32', stride: 9, rows: 45000 },
];

for (const asset of assets) {
  const buffer = fs.readFileSync(asset.path);
  if (buffer.byteLength % 4 !== 0) throw new Error(`${asset.path}: invalid byte length`);
  const values = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
  if (values.length % asset.stride !== 0) throw new Error(`${asset.path}: invalid stride`);
  const rows = values.length / asset.stride;
  if (rows !== asset.rows) throw new Error(`${asset.path}: expected ${asset.rows} rows, got ${rows}`);
  for (let index = 0; index < values.length; index += 1) {
    if (!Number.isFinite(values[index])) throw new Error(`${asset.path}: non-finite value at ${index}`);
  }
  console.log(`${asset.path}: ${rows} rows OK`);
}
