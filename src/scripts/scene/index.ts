import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  FLOWER_CENTER,
  createStarGeometry,
  createFlowerGeometry,
  createGalaxyGeometry,
  createGalaxyFillGeometry,
  createFlowerBloomGeometry,
  createGalaxyBloomGeometry,
  createTerrainGeometry,
  getSceneQuality,
  loadBakedSceneData,
  terrainHeight,
} from './baked';
import {
  createParticleMaterial,
  createDensityBloomMaterial,
  createTerrainPointMaterial,
} from './materials';

gsap.registerPlugin(ScrollTrigger);

const canvas = document.querySelector<HTMLCanvasElement>('[data-scene-canvas]');
const home = document.querySelector<HTMLElement>('.home');
const fieldCopy = document.querySelector<HTMLElement>('.field__copy');
if (!canvas || !home) throw new Error('Bontr scene mount was not found.');
const sceneRoot = canvas.closest<HTMLElement>('[data-parallax-scene]');
const setSceneState = (state: 'loading' | 'ready' | 'lost' | 'failed') => {
  canvas.dataset.sceneState = state;
  canvas.style.opacity = state === 'ready' ? '1' : '0';
  if (sceneRoot) sceneRoot.dataset.sceneState = state;
};

const sceneParams = new URLSearchParams(window.location.search);
const testMode = sceneParams.has('scene-test');
const captureMode = sceneParams.has('scene-capture');
if (captureMode) document.documentElement.classList.add('scene-capture');
const requestedTestProgress = Number(sceneParams.get('scene-progress'));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const quality = getSceneQuality();
const mobile = window.innerWidth < 720;
const worldGap = mobile ? 17.5 : 15;
const initialPixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.1 : 1.25);

history.scrollRestoration = 'manual';
if (window.location.hash) {
  history.replaceState(null, '', window.location.pathname + window.location.search);
}
window.scrollTo(0, 0);
window.addEventListener('pageshow', () => window.scrollTo(0, 0), { once: true });

let sceneReady = false;
let sceneDisabled = false;

const setWebglLive = (live: boolean) => {
  if (sceneRoot) sceneRoot.dataset.webglLive = live ? 'true' : 'false';
};

const initializeScene = async () => {
  setWebglLive(false);
  setSceneState('loading');
  let renderer: THREE.WebGLRenderer;
try {
  const context = canvas.getContext('webgl2', {
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  if (!context) throw new Error('WebGL 2 is unavailable.');

  // WebGL2 guarantees at least 16 vertex attributes. Some privacy tools return
  // randomized, spec-invalid lower values; Three.js then leaves valid attributes disabled.
  const nativeGetParameter = context.getParameter.bind(context);
  Object.defineProperty(context, 'getParameter', {
    configurable: true,
    value: (parameter: GLenum) => parameter === context.MAX_VERTEX_ATTRIBS
      ? Math.max(16, Number(nativeGetParameter(parameter)) || 0)
      : nativeGetParameter(parameter),
  });
  renderer = new THREE.WebGLRenderer({ canvas, context });
} catch (error) {
  console.error('Bontr WebGL renderer failed to initialize.', error);
  setSceneState('failed');
  throw error;
}

const bakedSceneData = await loadBakedSceneData().catch((error) => {
  console.error('Bontr scene data failed to load.', error);
  setSceneState('failed');
  throw error;
});
const { morph, terrain, stars } = bakedSceneData;

renderer.setClearColor(0x020202, 1);
renderer.setPixelRatio(initialPixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.90;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020202);
const camera = new THREE.PerspectiveCamera(mobile ? 52 : 44, window.innerWidth / window.innerHeight, 0.1, 70);

const flowerGeometry = createFlowerGeometry(morph, quality.morphCount);
const galaxyGeometry = createGalaxyGeometry(morph, quality.morphCount);
const galaxyFillCount = mobile ? Math.min(28000, quality.morphCount) : Math.min(90000, quality.morphCount);
const galaxyFillGeometry = createGalaxyFillGeometry(morph, galaxyFillCount);
const flowerBloomCount = mobile ? 2600 : 6200;
const galaxyBloomCount = mobile ? 3200 : 7600;
const flowerBloomGeometry = createFlowerBloomGeometry(morph, flowerBloomCount);
const galaxyBloomGeometry = createGalaxyBloomGeometry(morph, galaxyBloomCount);
const terrainGeometry = createTerrainGeometry(terrain, quality.terrainCount);
const starGeometry = createStarGeometry(stars, quality.starCount);


const flowerMaterial = createParticleMaterial(initialPixelRatio, {
  opacity: 1.0,
  twinkleStrength: 0.0,
  twinkleRate: 0.0,
  intensity: 2.28,
  sizeMultiplier: 1.30,
  densityBloom: 0.58,
  densityWarmth: 0.46,
  minPixelSize: 0.70,
  maxPixelSize: 18.0,
  additive: true,
});
const galaxyMaterial = createParticleMaterial(initialPixelRatio, {
  opacity: 1.0,
  twinkleStrength: 0.0,
  twinkleRate: 0.0,
  intensity: 1.88,
  sizeMultiplier: 1.26,
  densityBloom: 0.66,
  densityWarmth: 0.14,
  minPixelSize: 0.70,
  maxPixelSize: 18.0,
  additive: true,
});
const galaxyFillMaterial = createParticleMaterial(initialPixelRatio, {
  opacity: 0.58,
  twinkleStrength: 0.0,
  twinkleRate: 0.0,
  intensity: 1.50,
  sizeMultiplier: 1.20,
  densityBloom: 0.20,
  densityWarmth: 0.10,
  minPixelSize: 0.62,
  maxPixelSize: 16.0,
  additive: true,
});
const starMaterial = createParticleMaterial(initialPixelRatio, {
  opacity: 0.90,
  twinkleStrength: 1.0,
  twinkleRate: 1.35,
  driftStrength: 0,
  intensity: 1.18,
  sizeMultiplier: 1.18,
  densityBloom: 0.0,
  densityWarmth: 0.0,
  minPixelSize: 0.66,
  maxPixelSize: 13.0,
});
const terrainMaterial = createTerrainPointMaterial(initialPixelRatio, 1.0, 1.30, 1.10);
const flowerBloomMaterial = createDensityBloomMaterial(0.045, 0.86, 2.2, 0.78);
const galaxyBloomMaterial = createDensityBloomMaterial(0.040, 0.82, 2.0, 0.22);

const flowerBloomPoints = new THREE.Mesh(flowerBloomGeometry, flowerBloomMaterial);
flowerBloomPoints.frustumCulled = false;
flowerBloomPoints.renderOrder = -4;
scene.add(flowerBloomPoints);

const flowerPoints = new THREE.Mesh(flowerGeometry, flowerMaterial);
flowerPoints.frustumCulled = false;
scene.add(flowerPoints);

const galaxyFillPoints = new THREE.Mesh(galaxyFillGeometry, galaxyFillMaterial);
galaxyFillPoints.position.y = -worldGap;
galaxyFillPoints.frustumCulled = false;
galaxyFillPoints.renderOrder = -3;
scene.add(galaxyFillPoints);

const galaxyBloomPoints = new THREE.Mesh(galaxyBloomGeometry, galaxyBloomMaterial);
galaxyBloomPoints.position.y = -worldGap;
galaxyBloomPoints.frustumCulled = false;
galaxyBloomPoints.renderOrder = -4;
scene.add(galaxyBloomPoints);

const galaxyPoints = new THREE.Mesh(galaxyGeometry, galaxyMaterial);
galaxyPoints.position.y = -worldGap;
galaxyPoints.frustumCulled = false;
scene.add(galaxyPoints);

const foreground = new THREE.Group();
const terrainPoints = new THREE.Mesh(terrainGeometry, terrainMaterial);
terrainPoints.frustumCulled = false;
foreground.add(terrainPoints);
scene.add(foreground);

const starPoints = new THREE.Mesh(starGeometry, starMaterial);
starPoints.frustumCulled = false;
starPoints.renderOrder = -20;
scene.add(starPoints);


const personMaterial = new THREE.MeshStandardMaterial({
  color: 0x24170f,
  roughness: 0.86,
  metalness: 0.0,
  transparent: true,
  opacity: 1,
  depthWrite: false,
  depthTest: false,
});
const person = new THREE.Group();
const personX = -1.65;
const personZ = 1.7;
const personBaseScale = 0.58;
const personGround = terrainHeight(personX, personZ);
person.position.set(personX, personGround + 0.14, personZ);
person.scale.setScalar(personBaseScale);

const addBodySegment = (start: THREE.Vector3, end: THREE.Vector3, topRadius: number, bottomRadius = topRadius) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(topRadius, bottomRadius, start.distanceTo(end), 10), personMaterial);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
  person.add(mesh);
  return mesh;
};
const head = new THREE.Mesh(new THREE.SphereGeometry(0.082, 16, 12), personMaterial);
head.position.set(0, 0.77, 0);
head.scale.set(0.90, 1.08, 0.90);
person.add(head);
addBodySegment(new THREE.Vector3(0, 0.655, 0), new THREE.Vector3(0, 0.705, 0), 0.034, 0.038);
const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.082, 0.285, 12), personMaterial);
torso.position.y = 0.505;
torso.scale.z = 0.62;
person.add(torso);
const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), personMaterial);
pelvis.position.y = 0.335;
pelvis.scale.set(1.0, 0.55, 0.68);
person.add(pelvis);
addBodySegment(new THREE.Vector3(-0.108, 0.585, 0), new THREE.Vector3(-0.125, 0.455, 0.012), 0.028, 0.024);
addBodySegment(new THREE.Vector3(-0.125, 0.455, 0.012), new THREE.Vector3(-0.108, 0.325, 0.030), 0.024, 0.020);
addBodySegment(new THREE.Vector3(0.108, 0.585, 0), new THREE.Vector3(0.125, 0.452, -0.008), 0.028, 0.024);
addBodySegment(new THREE.Vector3(0.125, 0.452, -0.008), new THREE.Vector3(0.102, 0.323, 0.020), 0.024, 0.020);
const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), personMaterial);
leftHand.position.set(-0.108, 0.306, 0.032);
person.add(leftHand);
const rightHand = leftHand.clone();
rightHand.position.set(0.102, 0.304, 0.022);
person.add(rightHand);
addBodySegment(new THREE.Vector3(-0.052, 0.302, 0), new THREE.Vector3(-0.060, 0.160, 0.018), 0.040, 0.034);
addBodySegment(new THREE.Vector3(-0.060, 0.160, 0.018), new THREE.Vector3(-0.072, 0.020, -0.004), 0.034, 0.027);
addBodySegment(new THREE.Vector3(0.052, 0.302, 0), new THREE.Vector3(0.064, 0.155, -0.010), 0.040, 0.034);
addBodySegment(new THREE.Vector3(0.064, 0.155, -0.010), new THREE.Vector3(0.078, 0.020, 0.004), 0.034, 0.027);
const leftFoot = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.035, 0.13), personMaterial);
leftFoot.position.set(-0.072, -0.004, -0.035);
person.add(leftFoot);
const rightFoot = leftFoot.clone();
rightFoot.position.x = 0.078;
person.add(rightFoot);
person.traverse((object) => { if (object instanceof THREE.Mesh) object.renderOrder = 20; });
foreground.add(person);

const personAmbient = new THREE.AmbientLight(0x1a1410, 0.24);
const personKeyLight = new THREE.DirectionalLight(0xffad62, 7.0);
personKeyLight.position.copy(FLOWER_CENTER).add(new THREE.Vector3(1.8, 2.6, -0.8));
personKeyLight.target.position.set(personX, personGround + 0.42, personZ);
scene.add(personAmbient, personKeyLight, personKeyLight.target);

const contactShadowMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  depthTest: false,
  uniforms: { uOpacity: { value: 0.36 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform float uOpacity; varying vec2 vUv; void main(){ vec2 p=(vUv-0.5)*vec2(1.0,1.65); float d=dot(p,p); float a=(1.0-smoothstep(0.018,0.24,d))*uOpacity; if(a<0.008) discard; gl_FragColor=vec4(0.0,0.0,0.0,a); }`,
});
const contactShadowGeometry = new THREE.PlaneGeometry(1, 1);
contactShadowGeometry.rotateX(-Math.PI / 2);
const contactShadow = new THREE.Mesh(contactShadowGeometry, contactShadowMaterial);
contactShadow.position.set(personX, personGround + 0.025, personZ + 0.015);
contactShadow.scale.set(0.28, 0.42, 1);
contactShadow.renderOrder = 5;
foreground.add(contactShadow);

const createOrbit = (
  center: THREE.Vector3,
  radiusX: number,
  radiusY: number,
  tiltX: number,
  rotationZ: number,
  opacity: number,
) => {
  const count = 1200;
  const offsets = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const params = new Float32Array(count * 3);
  const tilt = THREE.MathUtils.degToRad(tiltX);
  const spin = THREE.MathUtils.degToRad(rotationZ);
  for (let index = 0; index < count; index += 1) {
    const theta = (index / count) * Math.PI * 2;
    const x = Math.cos(theta) * radiusX;
    const y = Math.sin(theta) * radiusY;
    const yTilted = y * Math.cos(tilt);
    const zTilted = y * Math.sin(tilt);
    const xSpun = x * Math.cos(spin) - yTilted * Math.sin(spin);
    const ySpun = x * Math.sin(spin) + yTilted * Math.cos(spin);
    const seed = ((index * 16807 + 97) % 2147483647) / 2147483647;
    const target = index * 3;
    offsets.set([center.x + xSpun, center.y + ySpun, center.z + zTilted], target);
    colors.set([1.0, 0.48 + seed * 0.14, 0.20 + seed * 0.08], target);
    params.set([0.095 + seed * 0.045, seed, 1.0], target);
  }
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-0.5,-0.5,0, 0.5,-0.5,0, 0.5,0.5,0, -0.5,0.5,0], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0,0, 1,0, 1,1, 0,1], 2));
  geometry.setIndex([0,1,2, 0,2,3]);
  geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
  geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
  geometry.setAttribute('aParams', new THREE.InstancedBufferAttribute(params, 3));
  geometry.instanceCount = count;
  const material = createParticleMaterial(initialPixelRatio, {
    opacity, twinkleStrength: 0, twinkleRate: 0, intensity: 1.18,
    sizeMultiplier: 0.24, densityBloom: 0, densityWarmth: 0,
    minPixelSize: 0.18, maxPixelSize: 1.8, additive: true,
  });
  const line = new THREE.Mesh(geometry, material);
  line.frustumCulled = false;
  scene.add(line);
  return { line, material };
};

const flowerOrbitA = createOrbit(FLOWER_CENTER, 5.4, 1.3, 62, -6, 0.15);
const flowerOrbitB = createOrbit(FLOWER_CENTER, 4.2, 1.02, -55, 22, 0.055);

const makeRng = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
};
const travelRandom = makeRng(7411);
const travelCount = mobile ? 180 : 320;
const travelPositions = new Float32Array(travelCount * 6);
for (let index = 0; index < travelCount; index += 1) {
  const angle = travelRandom() * Math.PI * 2;
  const radius = 0.7 + Math.pow(travelRandom(), 0.75) * 7.4;
  const z = -4.2 - travelRandom() * 12.5;
  const x = 3.35 + Math.cos(angle) * radius;
  const y = -worldGap * travelRandom() + Math.sin(angle) * radius * 0.24;
  const length = 0.65 + travelRandom() * 1.45;
  const offset = index * 6;
  travelPositions.set([
    x, y, z,
    x + Math.cos(angle) * length * 0.28,
    y + Math.sin(angle) * length * 0.15,
    z + length,
  ], offset);
}
const travelGeometry = new THREE.BufferGeometry();
travelGeometry.setAttribute('position', new THREE.BufferAttribute(travelPositions, 3));
const travelMaterial = new THREE.LineBasicMaterial({
  color: 0xdac5b5,
  transparent: true,
  opacity: 0.008,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const travelStreaks = new THREE.LineSegments(travelGeometry, travelMaterial);
travelStreaks.frustumCulled = false;
scene.add(travelStreaks);

type ShootingStar = {
  line: THREE.Line;
  material: THREE.LineBasicMaterial;
  start: THREE.Vector3;
  direction: THREE.Vector3;
  period: number;
  duration: number;
  offset: number;
};
const shootingStars: ShootingStar[] = [
  { start: new THREE.Vector3(8.5, 5.2, -10), direction: new THREE.Vector3(-2.4, -0.7, 1.1), period: 13.5, duration: 0.9, offset: 2.4 },
  { start: new THREE.Vector3(12, -4.5, -13), direction: new THREE.Vector3(-3.1, -0.8, 1.4), period: 19, duration: 1.05, offset: 7.8 },
  { start: new THREE.Vector3(-1.5, -10.8, -14), direction: new THREE.Vector3(2.7, -0.55, 1.2), period: 23, duration: 1.15, offset: 12.6 },
].map((config) => {
  const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), config.direction.clone().multiplyScalar(-0.55)]);
  const material = new THREE.LineBasicMaterial({
    color: 0xf6d6bb,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const line = new THREE.Line(geometry, material);
  line.visible = false;
  line.frustumCulled = false;
  scene.add(line);
  return { ...config, line, material };
});

const updateShootingStars = (time: number) => {
  shootingStars.forEach((star) => {
    const phase = (time + star.offset) % star.period;
    const active = phase < star.duration;
    star.line.visible = active;
    if (!active) return;
    const t = phase / star.duration;
    star.line.position.copy(star.start).addScaledVector(star.direction, t * 3.8);
    star.material.opacity = Math.sin(Math.PI * t) * 0.32;
  });
};

const cameraCurve = new THREE.CatmullRomCurve3(
  mobile
    ? [
        new THREE.Vector3(0, 0.1, 18),
        new THREE.Vector3(0.04, -worldGap * 0.2, 16.3),
        new THREE.Vector3(0.1, -worldGap * 0.48, 14.9),
        new THREE.Vector3(0.14, -worldGap * 0.76, 14.1),
        new THREE.Vector3(0.18, -worldGap + 0.02, 13.8),
      ]
    : [
        new THREE.Vector3(0, 0, 12.6),
        new THREE.Vector3(0.02, -worldGap * 0.2, 12),
        new THREE.Vector3(0.08, -worldGap * 0.48, 11.45),
        new THREE.Vector3(0.05, -worldGap * 0.76, 11.05),
        new THREE.Vector3(0, -worldGap, 10.9),
      ],
  false,
  'catmullrom',
  0.5,
);
const targetCurve = new THREE.CatmullRomCurve3(
  mobile
    ? [
        new THREE.Vector3(2.1, 0.12, -4),
        new THREE.Vector3(2.5, -worldGap * 0.2, -4.9),
        new THREE.Vector3(3.15, -worldGap * 0.48, -6.2),
        new THREE.Vector3(3.9, -worldGap * 0.76, -7.55),
        new THREE.Vector3(4.5, -worldGap - 0.1, -8.6),
      ]
    : [
        new THREE.Vector3(0, 0, -6.2),
        new THREE.Vector3(0.04, -worldGap * 0.2, -6.6),
        new THREE.Vector3(0.12, -worldGap * 0.48, -7.45),
        new THREE.Vector3(0.08, -worldGap * 0.76, -8.65),
        new THREE.Vector3(0, -worldGap, -9.75),
      ],
  false,
  'catmullrom',
  0.5,
);

const clamp01 = (value: number) => THREE.MathUtils.clamp(value, 0, 1);
const scrollState = {
  progress: testMode && Number.isFinite(requestedTestProgress)
    ? THREE.MathUtils.clamp(requestedTestProgress, 0, 1)
    : 0,
};
const cameraTarget = new THREE.Vector3();

const applyScene = (progress: number, time: number) => {
  const sceneP = clamp01(progress);
  setWebglLive(sceneReady && !sceneDisabled);
  const travelPulse = Math.sin(sceneP * Math.PI);
  const flowerExit = 1 - THREE.MathUtils.smoothstep(sceneP, 0.18, 0.4);
  const landscapeExit = 1 - THREE.MathUtils.smoothstep(sceneP, 0.24, 0.43);
  const fieldSettleStart = mobile ? 0.66 : 0.7;
  const fieldSettle = THREE.MathUtils.smoothstep(sceneP, fieldSettleStart, 1);
  const shortWide = window.innerWidth >= 1400 && window.innerHeight <= 780;
  const fieldOffsetVh = mobile ? 24 : shortWide ? 18.5 : 20;

  if (fieldCopy) {
    fieldCopy.style.transform = `translate3d(0, ${fieldSettle * window.innerHeight * fieldOffsetVh / 100}px, 0)`;
  }

  cameraCurve.getPointAt(sceneP, camera.position);
  targetCurve.getPointAt(sceneP, cameraTarget);
  camera.lookAt(cameraTarget);

  flowerMaterial.uniforms.uTime.value = time;
  flowerMaterial.uniforms.uOpacity.value = 1.10 * flowerExit;
  flowerBloomMaterial.uniforms.uOpacity.value = 0.045 * flowerExit;
  flowerPoints.visible = flowerExit > 0.002;
  flowerBloomPoints.visible = flowerExit > 0.002;
  galaxyMaterial.uniforms.uTime.value = time;
  galaxyFillMaterial.uniforms.uTime.value = time;
  starMaterial.uniforms.uTime.value = time;
  terrainMaterial.uniforms.uOpacity.value = 0.94 * landscapeExit;
  foreground.visible = landscapeExit > 0.002;

  const shadowDirection = terrainMaterial.uniforms.uShadowDir.value as THREE.Vector2;
  shadowDirection.set((personX - FLOWER_CENTER.x) * 0.24, (personZ - FLOWER_CENTER.z) * 1.34).normalize();
  (terrainMaterial.uniforms.uShadowOrigin.value as THREE.Vector2).set(personX, personZ);
  terrainMaterial.uniforms.uShadowLength.value = 4.9;
  terrainMaterial.uniforms.uShadowOpacity.value = 0.38;

  personMaterial.opacity = landscapeExit;
  personKeyLight.intensity = 7.0 * landscapeExit;
  personAmbient.intensity = 0.24 * landscapeExit;
  contactShadowMaterial.uniforms.uOpacity.value = 0.06 * landscapeExit;

  flowerOrbitA.material.uniforms.uOpacity.value = 0.15 * flowerExit;
  flowerOrbitB.material.uniforms.uOpacity.value = 0.055 * flowerExit;
  flowerOrbitA.line.visible = flowerExit > 0.002;
  flowerOrbitB.line.visible = flowerExit > 0.002;
   travelMaterial.opacity = 0.005 + travelPulse * 0.009;
  travelStreaks.rotation.z = time * 0.0025;
  if (!testMode && !reduceMotion) updateShootingStars(time);
};

if (reduceMotion || testMode) {
  const syncScroll = () => {
    if (testMode && Number.isFinite(requestedTestProgress)) {
      scrollState.progress = clamp01(requestedTestProgress);
      return;
    }
    const maxScroll = Math.max(1, home.offsetHeight - window.innerHeight);
    scrollState.progress = clamp01((window.scrollY - home.offsetTop) / maxScroll);
  };
  window.addEventListener('scroll', syncScroll, { passive: true });
  window.addEventListener('resize', syncScroll, { passive: true });
  syncScroll();
} else {
  gsap.to(scrollState, {
    progress: 1,
    ease: 'none',
    scrollTrigger: {
      trigger: home,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      invalidateOnRefresh: true,
    },
  });
}

const resize = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const nextPixelRatio = Math.min(window.devicePixelRatio || 1, width < 720 ? 1.1 : 1.25);
  renderer.setPixelRatio(nextPixelRatio);
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
  [flowerMaterial, galaxyMaterial, galaxyFillMaterial, starMaterial, terrainMaterial,
    flowerBloomMaterial, galaxyBloomMaterial, flowerOrbitA.material, flowerOrbitB.material]
    .forEach((material) => material.uniforms.uViewport.value.set(width, height));
};
window.addEventListener('resize', resize, { passive: true });
resize();
ScrollTrigger.refresh();

const startRendering = async () => {
  applyScene(scrollState.progress, 0);
  try {
    await renderer.compileAsync(scene, camera);
    renderer.render(scene, camera);

    // Do not expose the canvas until every queued instanced-particle draw has completed.
    renderer.getContext().finish();
    const expectedParticleTriangles = (quality.morphCount * 2 + galaxyFillCount + quality.terrainCount + quality.starCount + flowerBloomCount + galaxyBloomCount) * 2;
    if (renderer.info.render.triangles < expectedParticleTriangles) {
      throw new Error(`Incomplete startup frame: ${renderer.info.render.triangles}/${expectedParticleTriangles} particle triangles rendered.`);
    }

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    applyScene(scrollState.progress, 0);
    renderer.render(scene, camera);
    renderer.getContext().finish();
    sceneReady = true;
    setSceneState('ready');
    setWebglLive(true);
  } catch (error) {
    console.error('Bontr scene shader preparation failed.', error);
    sceneDisabled = true;
    sceneReady = false;
    setWebglLive(false);
    setSceneState('failed');
    return;
  }

  if (testMode) return;

  const startedAt = performance.now();
  renderer.setAnimationLoop((timeMs) => {
    const elapsed = reduceMotion || testMode ? 0 : Math.max(0, (timeMs - startedAt) * 0.001);
    applyScene(scrollState.progress, elapsed);
    renderer.render(scene, camera);
  });
};
void startRendering();

canvas.addEventListener('webglcontextlost', () => {
  sceneDisabled = true;
  sceneReady = false;
  setWebglLive(false);
  setSceneState('failed');
  renderer.setAnimationLoop(null);
});

window.addEventListener('pagehide', (event) => {
  renderer.setAnimationLoop(null);
  if (event.persisted) return;
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  [flowerGeometry, galaxyGeometry, galaxyFillGeometry, flowerBloomGeometry, galaxyBloomGeometry, terrainGeometry, starGeometry, contactShadowGeometry, travelGeometry]
    .forEach((geometry) => geometry.dispose());
  [flowerMaterial, galaxyMaterial, galaxyFillMaterial, flowerBloomMaterial, galaxyBloomMaterial, terrainMaterial, starMaterial,
    personMaterial, contactShadowMaterial, travelMaterial]
    .forEach((material) => material.dispose());
  person.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.dispose();
  });
  [flowerOrbitA, flowerOrbitB].forEach(({ line, material }) => {
    line.geometry.dispose();
    material.dispose();
  });
  shootingStars.forEach(({ line, material }) => {
    line.geometry.dispose();
    material.dispose();
  });
  renderer.dispose();
});
};

void initializeScene().catch((error) => {
  console.error('Bontr scene initialization failed.', error);
  setSceneState('failed');
});
