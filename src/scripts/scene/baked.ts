import * as THREE from 'three';
import morphAssetUrl from '../../assets/scene/home-morph.f32?url';
import terrainAssetUrl from '../../assets/scene/home-terrain.f32?url';

const MORPH_STRIDE = 15;
const TERRAIN_STRIDE = 7;

export const FLOWER_CENTER = new THREE.Vector3(4.9, 0.55, -6.2);
export const GALAXY_CENTER = new THREE.Vector3(5.35, -0.15, -9.75);

export type SceneQuality = {
  morphCount: number;
  terrainCount: number;
  starCount: number;
};

export const getSceneQuality = (): SceneQuality => {
  const mobile = window.innerWidth < 720;
  const cores = navigator.hardwareConcurrency || 8;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const constrained = cores <= 4 || memory <= 4;
  if (mobile || constrained) return { morphCount: 60000, terrainCount: 30000, starCount: 3800 };
  return { morphCount: 135000, terrainCount: 70000, starCount: 6000 };
};
export const makeRng = (seed = 1337) => {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const validateFloats = (data: Float32Array, stride: number, label: string) => {
  if (data.length === 0 || data.length % stride !== 0) throw new Error(`${label} has an invalid particle stride.`);
  for (let i = 0; i < data.length; i += 1) {
    if (!Number.isFinite(data[i])) throw new Error(`${label} contains a non-finite value at ${i}.`);
  }
};

const loadFloatArray = async (path: string, stride: number, label: string) => {
  const response = await fetch(new URL(path, document.baseURI), { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Failed to load ${label}: ${response.status}`);
  const buffer = await response.arrayBuffer();
  const data = new Float32Array(buffer);
  validateFloats(data, stride, label);
  return data;
};

export const loadBakedSceneData = async () => {
  const [morph, terrain] = await Promise.all([
    loadFloatArray(morphAssetUrl, MORPH_STRIDE, 'home morph data'),
    loadFloatArray(terrainAssetUrl, TERRAIN_STRIDE, 'home terrain data'),
  ]);
  return { morph, terrain };
};
const hash01 = (index: number, salt: number) => {
  let value = (index + 1 + salt * 374761393) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177) >>> 0;
  value ^= value >>> 16;
  return value / 4294967296;
};

const sampledIndex = (index: number, count: number, total: number) =>
  count <= 1 ? 0 : Math.min(total - 1, Math.floor((index / (count - 1)) * (total - 1)));

const createQuadGeometry = (
  positions: Float32Array,
  colors: Float32Array,
  params: Float32Array,
) => {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
  ], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
  geometry.setAttribute('aParams', new THREE.InstancedBufferAttribute(params, 3));
  geometry.instanceCount = positions.length / 3;
  return geometry;
};
const createMorphSideGeometry = (
  data: Float32Array,
  countLimit: number,
  positionOffset: number,
  colorOffset: number,
  sizeOffset: number,
  seedSalt: number,
  flowerDither = false,
) => {
  const total = Math.floor(data.length / MORPH_STRIDE);
  const count = Math.min(total, countLimit);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const params = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const sourceIndex = sampledIndex(i, count, total);
    const o = sourceIndex * MORPH_STRIDE;
    const t = i * 3;
    const jitter = flowerDither ? 0.055 : 0;
    positions[t] = data[o + positionOffset] + (hash01(sourceIndex, seedSalt + 101) - 0.5) * jitter;
    positions[t + 1] = data[o + positionOffset + 1] + (hash01(sourceIndex, seedSalt + 211) - 0.5) * jitter;
    positions[t + 2] = data[o + positionOffset + 2] + (hash01(sourceIndex, seedSalt + 307) - 0.5) * jitter;
    colors[t] = data[o + colorOffset];
    colors[t + 1] = data[o + colorOffset + 1];
    colors[t + 2] = data[o + colorOffset + 2];
    params[t] = data[o + sizeOffset];
    params[t + 1] = hash01(sourceIndex, seedSalt);
    params[t + 2] = 1;
  }
  return createQuadGeometry(positions, colors, params);
};

export const createFlowerGeometry = (data: Float32Array, count: number) =>
  createMorphSideGeometry(data, count, 0, 6, 12, 1906, true);

export const createGalaxyGeometry = (data: Float32Array, count: number) =>
  createMorphSideGeometry(data, count, 3, 9, 13, 31415, false);
export const createTerrainGeometry = (data: Float32Array, countLimit: number) => {
  const total = Math.floor(data.length / TERRAIN_STRIDE);
  const count = Math.min(total, countLimit);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const params = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const sourceIndex = sampledIndex(i, count, total);
    const o = sourceIndex * TERRAIN_STRIDE;
    const t = i * 3;
    const x = data[o];
    const z = data[o + 2];
    const ridge = Math.exp(-((z - 1.5) ** 2) / 0.52) * Math.exp(-(x * x) / 85);
    const personLift = Math.exp(-(((x + 1.65) / 0.72) ** 2 + ((z - 1.7) / 0.52) ** 2));
    positions[t] = x;
    positions[t + 1] = data[o + 1];
    positions[t + 2] = z;
    colors[t] = data[o + 3];
    colors[t + 1] = data[o + 4];
    colors[t + 2] = data[o + 5];
    params[t] = data[o + 6];
    params[t + 1] = hash01(sourceIndex, 7741);
    params[t + 2] = 1 + ridge * 0.08 + personLift * 0.12;
  }
  return createQuadGeometry(positions, colors, params);
};

export const createStarGeometry = (baseCount: number, worldGap: number) => {
  const count = Math.round(baseCount * 2.8);
  const centerY = -worldGap * 0.5;
  const halfSpanY = worldGap * 0.5 + 13;
  const random = makeRng(20260909);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const params = new Float32Array(count * 3);
  const white = new THREE.Color(0.72, 0.78, 0.82);
  const amber = new THREE.Color(1.75, 0.69, 0.26);
  const temp = new THREE.Color();
  for (let i = 0; i < count; i += 1) {
    const t = i * 3;
    positions[t] = (random() * 2 - 1) * 18;
    positions[t + 1] = centerY + (random() * 2 - 1) * halfSpanY;
    positions[t + 2] = -7 - random() * 18;
    const warm = random() < 0.075 ? 0.65 + random() * 0.35 : 0;
    temp.copy(white).lerp(amber, warm).multiplyScalar(0.62 + random() * 0.48);
    colors[t] = temp.r;
    colors[t + 1] = temp.g;
    colors[t + 2] = temp.b;
    params[t] = 0.65 + random() * 1.05 + (random() < 0.025 ? 1.2 : 0);
    random(); // consume the reference glyph draw; our stable renderer stays circular.
    params[t + 1] = random();
    params[t + 2] = 1;
  }
  return createQuadGeometry(positions, colors, params);
};

const createCoreBloomGeometry = (
  data: Float32Array,
  countLimit: number,
  positionOffset: number,
  colorOffset: number,
  sizeOffset: number,
  center: THREE.Vector3,
  radii: THREE.Vector3,
  salt: number,
) => {
  const total = Math.floor(data.length / MORPH_STRIDE);
  const ranked: Array<{ index: number; weight: number }> = [];
  for (let i = 0; i < total; i += 1) {
    const o = i * MORPH_STRIDE;
    const dx = (data[o + positionOffset] - center.x) / radii.x;
    const dy = (data[o + positionOffset + 1] - center.y) / radii.y;
    const dz = (data[o + positionOffset + 2] - center.z) / radii.z;
    const weight = Math.exp(-(dx * dx + dy * dy + dz * dz));
    if (weight > 0.24 && hash01(i, salt) < 0.10 + weight * 0.20) ranked.push({ index: i, weight });
  }
  const count = Math.min(countLimit, ranked.length);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const params = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const picked = ranked[sampledIndex(i, count, ranked.length)];
    const o = picked.index * MORPH_STRIDE;
    const t = i * 3;
    const jitter = 0.045 + (1 - picked.weight) * 0.05;
    positions[t] = data[o + positionOffset] + (hash01(picked.index, salt + 101) - 0.5) * jitter;
    positions[t + 1] = data[o + positionOffset + 1] + (hash01(picked.index, salt + 211) - 0.5) * jitter;
    positions[t + 2] = data[o + positionOffset + 2] + (hash01(picked.index, salt + 307) - 0.5) * jitter;
    colors[t] = data[o + colorOffset];
    colors[t + 1] = data[o + colorOffset + 1];
    colors[t + 2] = data[o + colorOffset + 2];
    params[t] = data[o + sizeOffset] * (2.0 + picked.weight * 1.2);
    params[t + 1] = hash01(picked.index, salt + 401);
    params[t + 2] = 0.65 + picked.weight * 0.85;
  }
  return createQuadGeometry(positions, colors, params);
};

export const createFlowerBloomGeometry = (data: Float32Array, count: number) =>
  createCoreBloomGeometry(data, count, 0, 6, 12, FLOWER_CENTER, new THREE.Vector3(2.35, 1.65, 2.3), 4242);

export const createGalaxyBloomGeometry = (data: Float32Array, count: number) =>
  createCoreBloomGeometry(data, count, 3, 9, 13, GALAXY_CENTER, new THREE.Vector3(2.7, 0.95, 2.35), 5252);

export const terrainHeight = (x: number, z: number) =>
  -2.72 - x * 0.018 - x * x * 0.0027 +
  Math.sin((x - 0.7) * 0.21) * 0.42 +
  Math.cos(z * 0.29) * 0.17 +
  Math.sin((x + z) * 0.14) * 0.17 +
  Math.exp(-((z - 1.6) ** 2) / 8) * 0.22;
