import * as THREE from 'three';
import {
  FLOWER_CENTER,
  GALAXY_CENTER,
  createFlowerGeometry,
  createGalaxyGeometry,
  createTerrainGeometry,
  createStarGeometry,
  createFlowerBloomGeometry,
  createGalaxyBloomGeometry,
  getSceneQuality,
  loadBakedSceneData,
  makeRng,
  terrainHeight,
} from './baked';
import {
  createParticleMaterial,
  createTerrainMaterial,
  createDensityBloomMaterial,
} from './materials';

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
const setWebglLive = (live: boolean) => {
  if (sceneRoot) sceneRoot.dataset.webglLive = live ? 'true' : 'false';
};
const sceneParams = new URLSearchParams(window.location.search);
const testMode = sceneParams.has('scene-test');
const requestedTestProgress = Number(sceneParams.get('scene-progress'));
const quality = getSceneQuality();
const mobile = window.innerWidth < 720;
const worldGap = mobile ? 17.5 : 15.0;
const pixelRatioCap = mobile ? 1.30 : 1.55;
let sceneReady = false;
let sceneDisabled = false;

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
    const nativeGetParameter = context.getParameter.bind(context);
    Object.defineProperty(context, 'getParameter', {
      configurable: true,
      value: (parameter: GLenum) => parameter === context.MAX_VERTEX_ATTRIBS
        ? Math.max(16, Number(nativeGetParameter(parameter)) || 0)
        : nativeGetParameter(parameter),
    });
    renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
  } catch (error) {
    console.error('Bontr WebGL renderer failed to initialize.', error);
    setSceneState('failed');
    return;
  }
  const { morph, terrain } = await loadBakedSceneData().catch((error) => {
    console.error('Bontr scene data failed to load.', error);
    setSceneState('failed');
    throw error;
  });

  const initialPixelRatio = Math.min(window.devicePixelRatio || 1, pixelRatioCap);
  renderer.setClearColor(0x020202, 1);
  renderer.setPixelRatio(initialPixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020202);
  const camera = new THREE.PerspectiveCamera(
    mobile ? 52 : 44,
    window.innerWidth / window.innerHeight,
    0.1,
    70,
  );

  const flowerGeometry = createFlowerGeometry(morph, quality.morphCount);
  const galaxyGeometry = createGalaxyGeometry(morph, quality.morphCount);
  const terrainGeometry = createTerrainGeometry(terrain, quality.terrainCount);
  const starGeometry = createStarGeometry(quality.starCount, worldGap);
  const flowerBloomCount = mobile ? 1800 : 4200;
  const galaxyBloomCount = mobile ? 2200 : 5200;
  const flowerBloomGeometry = createFlowerBloomGeometry(morph, flowerBloomCount);
  const galaxyBloomGeometry = createGalaxyBloomGeometry(morph, galaxyBloomCount);
  const renderedStarCount = Math.round(quality.starCount * 2.8);
  const flowerMaterial = createParticleMaterial({
    opacity: 0.98,
    intensity: 1.02,
    sizeMultiplier: 1.68,
    minPixelSize: 1.05,
    maxPixelSize: 7.4,
  });
  const galaxyMaterial = createParticleMaterial({
    opacity: 0.98,
    intensity: 1.02,
    sizeMultiplier: 1.66,
    minPixelSize: 1.02,
    maxPixelSize: 7.8,
  });
  const starMaterial = createParticleMaterial({
    opacity: 0.54,
    intensity: 1.02,
    sizeMultiplier: 2.70,
    minPixelSize: 1.32,
    maxPixelSize: 10.5,
    twinkleStrength: 1.0,
    progressStrength: 1.0,
  });
  const terrainMaterial = createTerrainMaterial(0.98, 2.08, 1.30);
  const flowerBloomMaterial = createDensityBloomMaterial(0.060, 1.05, 2.55, 0.78);
  const galaxyBloomMaterial = createDensityBloomMaterial(0.055, 1.0, 2.40, 0.25);

  const flowerBloomPoints = new THREE.Mesh(flowerBloomGeometry, flowerBloomMaterial);
  flowerBloomPoints.frustumCulled = false;
  flowerBloomPoints.renderOrder = -2;
  scene.add(flowerBloomPoints);

  const flowerPoints = new THREE.Mesh(flowerGeometry, flowerMaterial);
  flowerPoints.frustumCulled = false;
  scene.add(flowerPoints);
  const galaxyBloomPoints = new THREE.Mesh(galaxyBloomGeometry, galaxyBloomMaterial);
  galaxyBloomPoints.position.y = -worldGap;
  galaxyBloomPoints.frustumCulled = false;
  galaxyBloomPoints.renderOrder = -2;
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
    color: 0x21150e,
    roughness: 0.78,
    metalness: 0,
    emissive: 0x020100,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    depthTest: false,
  });
  const person = new THREE.Group();
  const personX = -1.65;
  const personZ = 1.7;
  const personGround = terrainHeight(personX, personZ);
  const personScale = 0.58;
  person.position.set(personX, personGround + 0.14, personZ);
  person.scale.setScalar(personScale);
  person.rotation.y = -0.18;
  const addSegment = (
    start: THREE.Vector3,
    end: THREE.Vector3,
    topRadius: number,
    bottomRadius = topRadius,
  ) => {
    const geometry = new THREE.CylinderGeometry(topRadius, bottomRadius, start.distanceTo(end), 10);
    const mesh = new THREE.Mesh(geometry, personMaterial);
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
    person.add(mesh);
    return mesh;
  };

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.083, 18, 14), personMaterial);
  head.position.set(0, 0.78, -0.002);
  head.scale.set(0.91, 1.08, 0.92);
  person.add(head);
  addSegment(new THREE.Vector3(0, 0.655, 0), new THREE.Vector3(0, 0.708, 0), 0.035, 0.039);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.126, 0.083, 0.29, 12), personMaterial);
  torso.position.y = 0.505;
  torso.scale.z = 0.62;
  person.add(torso);
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), personMaterial);
  pelvis.position.y = 0.335;
  pelvis.scale.set(1.0, 0.55, 0.68);
  person.add(pelvis);

  addSegment(new THREE.Vector3(-0.108, 0.59, 0), new THREE.Vector3(-0.132, 0.46, 0.012), 0.028, 0.024);
  addSegment(new THREE.Vector3(-0.132, 0.46, 0.012), new THREE.Vector3(-0.112, 0.322, 0.032), 0.024, 0.020);
  addSegment(new THREE.Vector3(0.108, 0.59, 0), new THREE.Vector3(0.132, 0.455, -0.008), 0.028, 0.024);
  addSegment(new THREE.Vector3(0.132, 0.455, -0.008), new THREE.Vector3(0.108, 0.320, 0.020), 0.024, 0.020);
  addSegment(new THREE.Vector3(-0.052, 0.302, 0), new THREE.Vector3(-0.062, 0.158, 0.018), 0.041, 0.034);
  addSegment(new THREE.Vector3(-0.062, 0.158, 0.018), new THREE.Vector3(-0.074, 0.020, -0.004), 0.034, 0.027);
  addSegment(new THREE.Vector3(0.052, 0.302, 0), new THREE.Vector3(0.064, 0.155, -0.010), 0.041, 0.034);
  addSegment(new THREE.Vector3(0.064, 0.155, -0.010), new THREE.Vector3(0.078, 0.020, 0.004), 0.034, 0.027);
  const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), personMaterial);
  leftHand.position.set(-0.112, 0.304, 0.032);
  person.add(leftHand);
  const rightHand = leftHand.clone();
  rightHand.position.set(0.108, 0.302, 0.022);
  person.add(rightHand);

  const leftFoot = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.034, 0.13), personMaterial);
  leftFoot.position.set(-0.074, -0.004, -0.035);
  person.add(leftFoot);
  const rightFoot = leftFoot.clone();
  rightFoot.position.x = 0.078;
  person.add(rightFoot);
  person.traverse((object) => {
    if (object instanceof THREE.Mesh) object.renderOrder = 20;
  });
  foreground.add(person);

  const personAmbient = new THREE.AmbientLight(0x120d09, 0.08);
  const personKey = new THREE.DirectionalLight(0xffad68, 6.8);
  personKey.position.set(personX + 2.6, personGround + 2.4, personZ - 2.8);
  personKey.target.position.set(personX, personGround + 0.42, personZ);
  scene.add(personAmbient, personKey, personKey.target);

  const contactShadowMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: { uOpacity: { value: 0.18 } },
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform float uOpacity; varying vec2 vUv; void main(){vec2 p=(vUv-0.5)*vec2(1.0,1.65);float d=dot(p,p);float a=(1.0-smoothstep(0.02,0.23,d))*uOpacity;if(a<0.008)discard;gl_FragColor=vec4(0.0,0.0,0.0,a);}`,
  });
  const contactShadowGeometry = new THREE.PlaneGeometry(1, 1);
  contactShadowGeometry.rotateX(-Math.PI / 2);
  const contactShadow = new THREE.Mesh(contactShadowGeometry, contactShadowMaterial);
  contactShadow.position.set(personX, personGround + 0.025, personZ + 0.015);
  contactShadow.scale.set(0.34, 0.52, 1);
  foreground.add(contactShadow);
  const createOrbit = (
    center: THREE.Vector3,
    radiusX: number,
    radiusY: number,
    tiltX: number,
    rotationZ: number,
    opacity: number,
  ) => {
    const count = 2200;
    const offsets = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const params = new Float32Array(count * 3);
    const tilt = THREE.MathUtils.degToRad(tiltX);
    const spin = THREE.MathUtils.degToRad(rotationZ);
    for (let i = 0; i < count; i += 1) {
      const theta = (i / count) * Math.PI * 2;
      const x = Math.cos(theta) * radiusX;
      const y = Math.sin(theta) * radiusY;
      const yTilted = y * Math.cos(tilt);
      const zTilted = y * Math.sin(tilt);
      const xSpun = x * Math.cos(spin) - yTilted * Math.sin(spin);
      const ySpun = x * Math.sin(spin) + yTilted * Math.cos(spin);
      const seed = ((i * 16807 + 97) % 2147483647) / 2147483647;
      const o = i * 3;
      offsets.set([center.x + xSpun, center.y + ySpun, center.z + zTilted], o);
      colors.set([1.0, 0.48 + seed * 0.14, 0.20 + seed * 0.08], o);
      params.set([0.13 + seed * 0.055, seed, 1], o);
    }
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
    ], 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
    geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
    geometry.setAttribute('aParams', new THREE.InstancedBufferAttribute(params, 3));
    geometry.instanceCount = count;
    const material = createParticleMaterial({
      opacity,
      intensity: 1.0,
      sizeMultiplier: 1.0,
      minPixelSize: 0.22,
      maxPixelSize: 0.48,
      additive: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { mesh, material, count };
  };

  const flowerOrbitA = createOrbit(FLOWER_CENTER, 5.4, 1.3, 62, -6, 0.55);
  const flowerOrbitB = createOrbit(FLOWER_CENTER, 4.2, 1.02, -55, 22, 0.34);
  const galaxyWorldCenter = GALAXY_CENTER.clone().add(new THREE.Vector3(0, -worldGap, 0));
  const galaxyOrbitA = createOrbit(galaxyWorldCenter, 8.4, 2.5, 53, -7, 0.14);
  const galaxyOrbitB = createOrbit(galaxyWorldCenter, 6.35, 1.9, -48, 10, 0.07);

  const travelRandom = makeRng(7411);
  const travelCount = mobile ? 260 : 520;
  const travelPositions = new Float32Array(travelCount * 6);
  for (let i = 0; i < travelCount; i += 1) {
    const angle = travelRandom() * Math.PI * 2;
    const radius = 0.7 + Math.pow(travelRandom(), 0.75) * 7.4;
    const z = -4.2 - travelRandom() * 12.5;
    const x = 3.35 + Math.cos(angle) * radius;
    const y = -worldGap * travelRandom() + Math.sin(angle) * radius * 0.24;
    const length = 0.65 + travelRandom() * 1.45;
    travelPositions.set([
      x, y, z,
      x + Math.cos(angle) * length * 0.28,
      y + Math.sin(angle) * length * 0.15,
      z + length,
    ], i * 6);
  }
  const travelGeometry = new THREE.BufferGeometry();
  travelGeometry.setAttribute('position', new THREE.BufferAttribute(travelPositions, 3));
  const travelMaterial = new THREE.LineBasicMaterial({
    color: 0xdac5b5,
    transparent: true,
    opacity: 0.009,
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
  ].map((config) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      config.direction.clone().multiplyScalar(-0.55),
    ]);
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
      star.material.opacity = Math.sin(Math.PI * t) * 0.28;
    });
  };
  const cameraCurve = new THREE.CatmullRomCurve3(
    mobile
      ? [
          new THREE.Vector3(0, 0.1, 18.0),
          new THREE.Vector3(0.04, -worldGap * 0.2, 16.3),
          new THREE.Vector3(0.1, -worldGap * 0.48, 14.9),
          new THREE.Vector3(0.14, -worldGap * 0.76, 14.1),
          new THREE.Vector3(0.18, -worldGap + 0.02, 13.8),
        ]
      : [
          new THREE.Vector3(0, 0, 12.6),
          new THREE.Vector3(0.02, -worldGap * 0.2, 12.0),
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
          new THREE.Vector3(2.1, 0.12, -4.0),
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
      ? clamp01(requestedTestProgress)
      : 0,
  };
  const cameraTarget = new THREE.Vector3();

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

  const applyScene = (progress: number, time: number) => {
    const p = clamp01(progress);
    const travelPulse = Math.sin(p * Math.PI);
    // Keep the physical scene fully present. Camera travel alone moves the flower and
    // foreground out of view; no opacity cross-fade is used during scrolling.
    const flowerExit = 1;
    const landscapeExit = 1;
    const fieldSettleStart = mobile ? 0.66 : 0.70;
    const fieldSettle = THREE.MathUtils.smoothstep(p, fieldSettleStart, 1);
    const shortWide = window.innerWidth >= 1400 && window.innerHeight <= 780;
    const fieldOffsetVh = mobile ? 24 : shortWide ? 18.5 : 20;

    if (fieldCopy) {
      const offsetY = fieldSettle * window.innerHeight * fieldOffsetVh / 100;
      fieldCopy.style.transform = `translate3d(0, ${offsetY}px, 0)`;
    }
    cameraCurve.getPointAt(p, camera.position);
    targetCurve.getPointAt(p, cameraTarget);
    camera.lookAt(cameraTarget);

    flowerMaterial.uniforms.uTime.value = time;
    flowerMaterial.uniforms.uOpacity.value = 0.98 * flowerExit;
    flowerBloomMaterial.uniforms.uOpacity.value = 0.060 * flowerExit;
    flowerPoints.visible = flowerExit > 0.002;
    flowerBloomPoints.visible = flowerExit > 0.002;

    galaxyMaterial.uniforms.uTime.value = time;
    galaxyMaterial.uniforms.uOpacity.value = 0.98;
    galaxyBloomMaterial.uniforms.uOpacity.value = 0.055;

    foreground.visible = landscapeExit > 0.002;
    terrainMaterial.uniforms.uOpacity.value = 0.95 * landscapeExit;
    person.visible = landscapeExit > 0.002;
    personMaterial.opacity = landscapeExit;
    personKey.intensity = 6.8 * landscapeExit;
    personAmbient.intensity = 0.08 * landscapeExit;
    contactShadowMaterial.uniforms.uOpacity.value = 0.18 * landscapeExit;

    starMaterial.uniforms.uTime.value = time;
    starMaterial.uniforms.uProgress.value = 0.018 + travelPulse * 0.012;
    starMaterial.uniforms.uOpacity.value = 0.50;

    flowerOrbitA.material.uniforms.uOpacity.value = 0.18 * flowerExit;
    flowerOrbitB.material.uniforms.uOpacity.value = 0.08 * flowerExit;
    flowerOrbitA.mesh.visible = flowerExit > 0.002;
    flowerOrbitB.mesh.visible = flowerExit > 0.002;
    galaxyOrbitA.material.uniforms.uOpacity.value = 0.14;
    galaxyOrbitB.material.uniforms.uOpacity.value = 0.07;
    galaxyOrbitA.mesh.visible = true;
    galaxyOrbitB.mesh.visible = true;

    travelMaterial.opacity = 0.009;
    travelStreaks.rotation.z = time * 0.0025;
    updateShootingStars(time);
    setWebglLive(sceneReady && !sceneDisabled);
  };
  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const nextPixelRatio = Math.min(window.devicePixelRatio || 1, width < 720 ? 1.30 : 1.55);
    renderer.setPixelRatio(nextPixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    [
      flowerMaterial,
      galaxyMaterial,
      starMaterial,
      terrainMaterial,
      flowerBloomMaterial,
      galaxyBloomMaterial,
      flowerOrbitA.material,
      flowerOrbitB.material,
      galaxyOrbitA.material,
      galaxyOrbitB.material,
    ].forEach((material) => {
      material.uniforms.uViewport.value.set(width, height);
    });
    syncScroll();
  };
  window.addEventListener('resize', resize, { passive: true });
  resize();

  const startRendering = async () => {
    // Validate a canonical full scene, regardless of the page's initial scroll position.
    applyScene(0, 0);
    try {
      await renderer.compileAsync(scene, camera);
      renderer.render(scene, camera);
      renderer.getContext().finish();
      const expectedParticleTriangles = (
        quality.morphCount * 2 +
        quality.terrainCount +
        renderedStarCount +
        flowerBloomCount +
        galaxyBloomCount +
        flowerOrbitA.count +
        flowerOrbitB.count +
        galaxyOrbitA.count +
        galaxyOrbitB.count
      ) * 2;
      if (renderer.info.render.triangles < expectedParticleTriangles) {
        throw new Error(
          `Incomplete startup frame: ${renderer.info.render.triangles}/${expectedParticleTriangles} particle triangles rendered.`,
        );
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      syncScroll();
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
      syncScroll();
      const elapsed = Math.max(0, (timeMs - startedAt) * 0.001);
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
    window.removeEventListener('scroll', syncScroll);
    window.removeEventListener('resize', resize);
    [
      flowerGeometry,
      galaxyGeometry,
      terrainGeometry,
      starGeometry,
      flowerBloomGeometry,
      galaxyBloomGeometry,
      contactShadowGeometry,
      travelGeometry,
      flowerOrbitA.mesh.geometry,
      flowerOrbitB.mesh.geometry,
      galaxyOrbitA.mesh.geometry,
      galaxyOrbitB.mesh.geometry,
    ].forEach((geometry) => geometry.dispose());
    [
      flowerMaterial,
      galaxyMaterial,
      starMaterial,
      terrainMaterial,
      flowerBloomMaterial,
      galaxyBloomMaterial,
      personMaterial,
      contactShadowMaterial,
      travelMaterial,
      flowerOrbitA.material,
      flowerOrbitB.material,
      galaxyOrbitA.material,
      galaxyOrbitB.material,
    ].forEach((material) => material.dispose());
    person.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
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
  setWebglLive(false);
  setSceneState('failed');
});
