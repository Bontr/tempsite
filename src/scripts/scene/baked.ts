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
  if (mobile || constrained) return { morphCount: 60000, terrainCount: 32000, starCount: 36000 };
  return { morphCount: 135000, terrainCount: 70000, starCount: 90000 };
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

const createStaticGeometry = (
  data: Float32Array,
  stride: number,
  countLimit: number,
  positionOffset: number,
  colorOffset: number,
  sizeOffset: number,
  glyphOffset: number | null,
  seedOffset: number | null,
  seedSalt: number,
  sizeScale = 1,
) => {
  const total = Math.floor(data.length / stride);
  const count = Math.min(total, countLimit);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const glyphs = new Float32Array(count);
  const seeds = new Float32Array(count);

  for (let index = 0; index < count; index += 1) {
    const sourceIndex = sampledIndex(index, count, total);
    const source = sourceIndex * stride;
    const target = index * 3;
    positions[target] = data[source + positionOffset];
    positions[target + 1] = data[source + positionOffset + 1];
    positions[target + 2] = data[source + positionOffset + 2];
    colors[target] = data[source + colorOffset];
    colors[target + 1] = data[source + colorOffset + 1];
    colors[target + 2] = data[source + colorOffset + 2];
    sizes[index] = data[source + sizeOffset] * sizeScale;
    glyphs[index] = glyphOffset === null ? (hash01(sourceIndex, seedSalt + 17) < 0.008 ? 1 : 0) : data[source + glyphOffset];
    seeds[index] = seedOffset === null ? hash01(sourceIndex, seedSalt) : data[source + seedOffset];
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aGlyph', new THREE.BufferAttribute(glyphs, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.computeBoundingSphere();
  return geometry;
};

export const createFlowerGeometry = (data: Float32Array, count: number) =>
  createStaticGeometry(data, MORPH_STRIDE, count, 0, 6, 12, 14, null, 1906, 0.78);

export const createGalaxyGeometry = (data: Float32Array, count: number) =>
  createStaticGeometry(data, MORPH_STRIDE, count, 3, 9, 13, null, null, 31415);

export const createTerrainGeometry = (data: Float32Array, count: number) =>
  createStaticGeometry(data, TERRAIN_STRIDE, count, 0, 3, 6, null, null, 7741);

export const createStarGeometry = (data: Float32Array, count: number) =>
  createStaticGeometry(data, STAR_STRIDE, count, 0, 3, 6, 7, 8, 20260909);

export const terrainHeight = (x: number, z: number) =>
  -2.72 - x * 0.018 - x * x * 0.0027 +
  Math.sin((x - 0.7) * 0.21) * 0.42 +
  Math.cos(z * 0.29) * 0.17 +
  Math.sin((x + z) * 0.14) * 0.17 +
  Math.exp(-((z - 1.6) ** 2) / 8) * 0.22;
