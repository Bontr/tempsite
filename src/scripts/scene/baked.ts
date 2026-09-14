import * as THREE from 'three';

import morphAssetUrl from '../../assets/scene/home-morph.f32?url';
import terrainAssetUrl from '../../assets/scene/home-terrain.f32?url';
import starAssetUrl from '../../assets/scene/home-stars.f32?url';

const MORPH_STRIDE = 15;
const TERRAIN_STRIDE = 7;
const STAR_STRIDE = 9;

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
  if (mobile || constrained) return { morphCount: 60000, terrainCount: 32000, starCount: 26000 };
  return { morphCount: 135000, terrainCount: 70000, starCount: 60000 };
};

const validateFloats = (data: Float32Array, stride: number, label: string) => {
  if (data.length === 0 || data.length % stride !== 0) {
    throw new Error(`${label} has an invalid particle stride.`);
  }
  for (let index = 0; index < data.length; index += 1) {
    if (!Number.isFinite(data[index])) throw new Error(`${label} contains a non-finite value at ${index}.`);
  }
};

const loadFloatArray = async (path: string, stride: number, label: string) => {
  const url = new URL(path, document.baseURI);
  const response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Failed to load ${label}: ${response.status}`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength % Float32Array.BYTES_PER_ELEMENT !== 0) {
    throw new Error(`${label} has an invalid byte length.`);
  }
  const data = new Float32Array(buffer);
  validateFloats(data, stride, label);
  return data;
};

export const loadBakedSceneData = async () => {
  const [morph, terrain, stars] = await Promise.all([
    loadFloatArray(morphAssetUrl, MORPH_STRIDE, 'home morph data'),
    loadFloatArray(terrainAssetUrl, TERRAIN_STRIDE, 'home terrain data'),
    loadFloatArray(starAssetUrl, STAR_STRIDE, 'home star data'),
  ]);
  return { morph, terrain, stars };
};

const hash01 = (index: number, salt: number) => {
  let value = (index + 1 + salt * 374761393) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177) >>> 0;
  value ^= value >>> 16;
  return value / 4294967296;
};

const sampledIndex = (index: number, count: number, total: number) =>
  count <= 1 ? 0 : Math.min(total - 1, Math.floor((index / (count - 1)) * (total - 1)));

type ParticleProfile = (x: number, y: number, z: number) => {
  sizeScale: number;
  intensity: number;
  jitter?: number;
};

const createStaticGeometry = (
  data: Float32Array,
  stride: number,
  countLimit: number,
  positionOffset: number,
  colorOffset: number,
  sizeOffset: number,
  seedOffset: number | null,
  seedSalt: number,
  sizeScale = 1,
  profile?: ParticleProfile,
) => {
  const total = Math.floor(data.length / stride);
  const count = Math.min(total, countLimit);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const params = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const sourceIndex = sampledIndex(index, count, total);
    const source = sourceIndex * stride;
    const target = index * 3;
    const x = data[source + positionOffset];
    const y = data[source + positionOffset + 1];
    const z = data[source + positionOffset + 2];
    const local = profile?.(x, y, z) ?? { sizeScale: 1, intensity: 1, jitter: 0 };
    const jitter = local.jitter ?? 0;
    positions[target] = x + (hash01(sourceIndex, seedSalt + 101) - 0.5) * jitter;
    positions[target + 1] = y + (hash01(sourceIndex, seedSalt + 211) - 0.5) * jitter;
    positions[target + 2] = z + (hash01(sourceIndex, seedSalt + 307) - 0.5) * jitter;
    colors[target] = data[source + colorOffset];
    colors[target + 1] = data[source + colorOffset + 1];
    colors[target + 2] = data[source + colorOffset + 2];
    params[target] = data[source + sizeOffset] * sizeScale * local.sizeScale;
    params[target + 1] = seedOffset === null ? hash01(sourceIndex, seedSalt) : data[source + seedOffset];
    params[target + 2] = local.intensity;
  }

  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.5, -0.5, 0,
     0.5, -0.5, 0,
     0.5,  0.5, 0,
    -0.5,  0.5, 0,
  ], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
  geometry.setAttribute('aParams', new THREE.InstancedBufferAttribute(params, 3));
  geometry.instanceCount = count;
  return geometry;
};

const flowerProfile: ParticleProfile = (x, y, z) => {
  const dx = (x - FLOWER_CENTER.x) / 2.8;
  const dy = (y - FLOWER_CENTER.y) / 2.1;
  const dz = (z - FLOWER_CENTER.z) / 2.8;
  const core = Math.exp(-(dx * dx + dy * dy + dz * dz) * 1.35);
  return {
    sizeScale: 1.16 - core * 0.24,
    intensity: 1.0 + core * 0.72,
    jitter: 0.10 + core * 0.04,
  };
};

const galaxyProfile: ParticleProfile = (x, y, z) => {
  const dx = (x - GALAXY_CENTER.x) / 3.1;
  const dy = (y - GALAXY_CENTER.y) / 1.05;
  const dz = (z - GALAXY_CENTER.z) / 2.5;
  const core = Math.exp(-(dx * dx + dy * dy + dz * dz) * 1.2);
  return {
    sizeScale: 1.10 - core * 0.20,
    intensity: 1.0 + core * 0.95,
    jitter: 0.028 + core * 0.012,
  };
};

const terrainProfile: ParticleProfile = (x, y, z) => {
  const ridge = Math.max(0, Math.min(1, (y + 3.15) / 1.25));
  const backlight = Math.exp(-(((x + 1.65) / 1.10) ** 2 + ((z - 1.08) / 0.82) ** 2));
  const footPocket = Math.exp(-(((x + 1.65) / 0.30) ** 2 + ((z - 1.70) / 0.25) ** 2));
  const sizeScale = Math.max(1.0, 1.20 + ridge * 0.36 + backlight * 0.14 - footPocket * 0.08);
  const intensity = Math.max(0.92, 1.05 + ridge * 0.58 + backlight * 0.72 - footPocket * 0.18);
  return { sizeScale, intensity };
};

export const createFlowerGeometry = (data: Float32Array, count: number) =>
  createStaticGeometry(data, MORPH_STRIDE, count, 0, 6, 12, null, 1906, 1.02, flowerProfile);

export const createGalaxyGeometry = (data: Float32Array, count: number) =>
  createStaticGeometry(data, MORPH_STRIDE, count, 3, 9, 13, null, 31415, 1.04, galaxyProfile);

export const createTerrainGeometry = (data: Float32Array, count: number) =>
  createStaticGeometry(data, TERRAIN_STRIDE, count, 0, 3, 6, null, 7741, 1.0, terrainProfile);

export const createStarGeometry = (data: Float32Array, count: number) =>
  createStaticGeometry(data, STAR_STRIDE, count, 0, 3, 6, 8, 20260909, 0.96);

export const terrainHeight = (x: number, z: number) =>
  -2.72 - x * 0.018 - x * x * 0.0027 +
  Math.sin((x - 0.7) * 0.21) * 0.42 +
  Math.cos(z * 0.29) * 0.17 +
  Math.sin((x + z) * 0.14) * 0.17 +
  Math.exp(-((z - 1.6) ** 2) / 8) * 0.22;
