import * as THREE from 'three';

export type ParticleMaterialOptions = {
  opacity?: number;
  intensity?: number;
  sizeMultiplier?: number;
  minPixelSize?: number;
  maxPixelSize?: number;
  twinkleStrength?: number;
  progressStrength?: number;
  swirlCenter?: THREE.Vector2;
  swirlSpeed?: number;
  swirlAmount?: number;
  additive?: boolean;
};

const particleVertex = `
uniform float uTime;
uniform float uProgress;
uniform float uProgressStrength;
uniform vec2 uSwirlCenter;
uniform float uSwirlSpeed;
uniform float uSwirlAmount;
uniform vec2 uViewport;
uniform float uSizeMultiplier;
uniform float uMinPixelSize;
uniform float uMaxPixelSize;
uniform float uTwinkleStrength;
attribute vec3 aOffset;
attribute vec3 aColor;
attribute vec3 aParams;
varying vec2 vUv;
varying vec3 vColor;
varying float vTwinkle;
varying float vFlash;
void main() {
  float particleSize = aParams.x;
  float seed = aParams.y;
  vec3 center = aOffset;
  center.y -= uProgress * uProgressStrength * (0.44 + seed * 0.025);
  center.z += uProgress * uProgressStrength * (0.82 + seed * 0.04);

  vec2 swirlOffset = center.xy - uSwirlCenter;
  float swirlRadius = length(swirlOffset);
  float swirlPhase = atan(swirlOffset.y, swirlOffset.x) * 2.0 - swirlRadius * 0.72 + uTime * uSwirlSpeed;
  float swirlFalloff = exp(-swirlRadius * 0.32);
  float innerSafeRadius = 1.85;
  float swirlRamp = smoothstep(innerSafeRadius, innerSafeRadius + 2.4, swirlRadius);
  float swirlAngle = sin(swirlPhase) * uSwirlAmount * swirlFalloff * swirlRamp;
  float swirlCos = cos(swirlAngle);
  float swirlSin = sin(swirlAngle);
  center.xy = uSwirlCenter + mat2(swirlCos, swirlSin, -swirlSin, swirlCos) * swirlOffset;

  float eligible = step(0.18, fract(seed * 11.97));
  float speed = 1.15 + fract(seed * 29.17) * 2.10;
  float wave = 0.5 + 0.5 * sin(seed * 53.71 + uTime * speed);
  float secondary = 0.5 + 0.5 * sin(seed * 91.13 + uTime * (0.55 + fract(seed * 7.11) * 0.65));
  float sparkle = pow(wave, 7.0) * (0.55 + secondary * 0.45);
  float twinkleBrightness = 0.72 + wave * 0.48 + sparkle * 0.80;
  float swirlPresence = step(0.0001, abs(uSwirlAmount));
  float swirlWave = 0.5 + 0.5 * sin(swirlPhase);
  float swirlPulse = smoothstep(0.18, 0.92, swirlWave);
  float swirlMix = swirlPresence * swirlRamp;
  float swirlShimmer = mix(1.0, 0.86 + swirlPulse * 0.34, swirlMix);
  vFlash = eligible * sparkle * uTwinkleStrength;
  vTwinkle = mix(1.0, mix(1.0, twinkleBrightness, eligible), uTwinkleStrength) * swirlShimmer;

  vec4 mv = modelViewMatrix * vec4(center, 1.0);
  float distanceScale = clamp(11.5 / max(1.0, -mv.z), 0.48, 1.85);
  float sizeLift = (1.0 + vFlash * 0.95) * mix(1.0, 0.93 + swirlPulse * 0.18, swirlMix);
  float px = clamp(particleSize * uSizeMultiplier * distanceScale * sizeLift, uMinPixelSize, uMaxPixelSize);
  vec4 clip = projectionMatrix * mv;
  clip.xy += position.xy * px * 2.0 / max(uViewport, vec2(1.0)) * clip.w;
  gl_Position = clip;
  vUv = uv;
  vColor = aColor;
}
`;
const particleFragment = `
uniform float uOpacity;
uniform float uIntensity;
varying vec2 vUv;
varying vec3 vColor;
varying float vTwinkle;
varying float vFlash;

void main() {
  vec2 p = vUv - 0.5;
  float radius = length(p);
  float circle = 1.0 - smoothstep(0.34, 0.50, radius);
  if (circle < 0.01) discard;
  float glow = 1.0 - smoothstep(0.08, 0.50, radius);
  vec3 color = mix(vColor, vec3(1.0), clamp(vFlash * 0.90, 0.0, 0.90));
  float brightness = max(0.08, vTwinkle);
  float sourceLum = dot(vColor, vec3(0.2126, 0.7152, 0.0722));
  float sourceVisibility = smoothstep(0.006, 0.040, sourceLum);
  float alpha = circle * uOpacity * clamp(0.45 + brightness * 0.55, 0.42, 1.0) * sourceVisibility;
  gl_FragColor = vec4(color * uIntensity * brightness * (1.0 + glow * 0.16), alpha);
}
`;

export const createParticleMaterial = (
  options: ParticleMaterialOptions = {},
) => new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uProgressStrength: { value: options.progressStrength ?? 0 },
    uSwirlCenter: { value: options.swirlCenter?.clone() ?? new THREE.Vector2() },
    uSwirlSpeed: { value: options.swirlSpeed ?? 0 },
    uSwirlAmount: { value: options.swirlAmount ?? 0 },
    uViewport: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uOpacity: { value: options.opacity ?? 1 },
    uIntensity: { value: options.intensity ?? 1 },
    uSizeMultiplier: { value: options.sizeMultiplier ?? 1 },
    uMinPixelSize: { value: options.minPixelSize ?? 0.85 },
    uMaxPixelSize: { value: options.maxPixelSize ?? 10 },
    uTwinkleStrength: { value: options.twinkleStrength ?? 0 },
  },
  vertexShader: particleVertex,
  fragmentShader: particleFragment,
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: options.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
});

const terrainVertex = `
uniform vec2 uViewport;
uniform float uSizeMultiplier;
attribute vec3 aOffset;
attribute vec3 aColor;
attribute vec3 aParams;
varying vec2 vUv;
varying vec3 vColor;
varying float vVisibility;
void main() {
  vec4 mv = modelViewMatrix * vec4(aOffset, 1.0);
  float distanceScale = clamp(9.8 / max(1.0, -mv.z), 0.46, 1.75);
  float px = clamp(aParams.x * uSizeMultiplier * distanceScale, 0.90, 8.5);
  vec4 clip = projectionMatrix * mv;
  clip.xy += position.xy * px * 2.0 / max(uViewport, vec2(1.0)) * clip.w;
  gl_Position = clip;
  vUv = uv;
  vColor = aColor;
  vVisibility = clamp(aParams.z, 0.0, 1.0);
}
`;

const terrainFragment = `
uniform float uOpacity;
uniform float uIntensity;
varying vec2 vUv;
varying vec3 vColor;
varying float vVisibility;
void main() {
  vec2 p = vUv - 0.5;
  float radius = length(p);
  float circle = 1.0 - smoothstep(0.34, 0.50, radius);
  if (circle < 0.01) discard;
  float glow = 1.0 - smoothstep(0.08, 0.50, radius);
  float alpha = circle * uOpacity * vVisibility;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(vColor * uIntensity * (1.0 + glow * 0.10), alpha);
}
`;
export const createTerrainMaterial = (
  opacity = 0.95,
  sizeMultiplier = 1.45,
  intensity = 1,
) => new THREE.ShaderMaterial({
  uniforms: {
    uViewport: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uOpacity: { value: opacity },
    uSizeMultiplier: { value: sizeMultiplier },
    uIntensity: { value: intensity },
  },
  vertexShader: terrainVertex,
  fragmentShader: terrainFragment,
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: THREE.NormalBlending,
});

export const createDensityBloomMaterial = (
  opacity: number,
  intensity: number,
  sizeMultiplier: number,
  warmth: number,
  swirlCenter = new THREE.Vector2(),
  swirlSpeed = 0,
  swirlAmount = 0,
) => new THREE.ShaderMaterial({
  uniforms: {
    uViewport: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uOpacity: { value: opacity },
    uIntensity: { value: intensity },
    uSizeMultiplier: { value: sizeMultiplier },
    uWarmth: { value: warmth },
    uTime: { value: 0 },
    uSwirlCenter: { value: swirlCenter.clone() },
    uSwirlSpeed: { value: swirlSpeed },
    uSwirlAmount: { value: swirlAmount },
  },
  vertexShader: `
uniform vec2 uViewport;
uniform float uSizeMultiplier;
uniform float uTime;
uniform vec2 uSwirlCenter;
uniform float uSwirlSpeed;
uniform float uSwirlAmount;
attribute vec3 aOffset;
attribute vec3 aColor;
attribute vec3 aParams;
varying vec2 vUv;
varying vec3 vColor;
varying float vWeight;
void main() {
  vec3 center = aOffset;
  vec2 swirlOffset = center.xy - uSwirlCenter;
  float swirlRadius = length(swirlOffset);
  float swirlPhase = atan(swirlOffset.y, swirlOffset.x) * 2.0 - swirlRadius * 0.72 + uTime * uSwirlSpeed;
  float swirlFalloff = exp(-swirlRadius * 0.32);
  float innerSafeRadius = 1.85;
  float swirlRamp = smoothstep(innerSafeRadius, innerSafeRadius + 2.4, swirlRadius);
  float swirlAngle = sin(swirlPhase) * uSwirlAmount * swirlFalloff * swirlRamp;
  float swirlCos = cos(swirlAngle);
  float swirlSin = sin(swirlAngle);
  center.xy = uSwirlCenter + mat2(swirlCos, swirlSin, -swirlSin, swirlCos) * swirlOffset;
  float swirlPresence = step(0.0001, abs(uSwirlAmount));
  float swirlWave = 0.5 + 0.5 * sin(swirlPhase);
  float swirlPulse = smoothstep(0.18, 0.92, swirlWave);
  float swirlMix = swirlPresence * swirlRamp;
  vec4 mv = modelViewMatrix * vec4(center, 1.0);
  float distanceScale = clamp(11.0 / max(1.0, -mv.z), 0.48, 1.85);
  float pulseSize = mix(1.0, 0.94 + swirlPulse * 0.16, swirlMix);
  float px = clamp(aParams.x * uSizeMultiplier * distanceScale * pulseSize, 1.2, 24.0);
  vec4 clip = projectionMatrix * mv;
  clip.xy += position.xy * px * 2.0 / max(uViewport, vec2(1.0)) * clip.w;
  gl_Position = clip;
  vUv = uv;
  vColor = aColor;
  vWeight = aParams.z * mix(1.0, 0.90 + swirlPulse * 0.24, swirlMix);
}
`,
  fragmentShader: `
uniform float uOpacity;
uniform float uIntensity;
uniform float uWarmth;
varying vec2 vUv;
varying vec3 vColor;
varying float vWeight;
void main() {
  vec2 p = vUv - 0.5;
  float r2 = dot(p, p);
  float halo = exp(-5.4 * r2) * (1.0 - smoothstep(0.44, 0.515, length(p)));
  float alpha = halo * uOpacity * clamp(vWeight, 0.55, 1.5);
  if (alpha < 0.0015) discard;
  vec3 warm = vec3(1.0, 0.76, 0.54);
  vec3 color = mix(vColor, warm, uWarmth);
  gl_FragColor = vec4(color * uIntensity, alpha);
}
`,
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: THREE.AdditiveBlending,
});
