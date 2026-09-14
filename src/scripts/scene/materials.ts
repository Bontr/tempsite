import * as THREE from 'three';

export type ParticleMaterialOptions = {
  opacity?: number;
  twinkleStrength?: number;
  twinkleRate?: number;
  driftStrength?: number;
  intensity?: number;
  sizeMultiplier?: number;
  additive?: boolean;
};

const pointFragment = `
uniform float uOpacity;
uniform float uIntensity;
varying vec2 vUv;
varying vec3 vColor;
varying float vTwinkle;
varying float vIntensity;

void main() {
  vec2 p = vUv - 0.5;
  float radius = length(p);
  float r2 = dot(p, p);
  float core = exp(-18.0 * r2);
  float density = smoothstep(1.08, 1.72, vIntensity);
  float halo = exp(-4.0 * r2) * density;
  float shape = (core * 0.90 + halo * 0.34) * (1.0 - smoothstep(0.46, 0.51, radius));
  float alpha = shape * uOpacity * vTwinkle;
  if (alpha < 0.004) discard;
  float luminance = 1.0 + max(0.0, vIntensity - 1.0) * 0.28;
  gl_FragColor = vec4(vColor * uIntensity * luminance * (0.92 + core * 0.42) * vTwinkle, alpha);
}
`;

const particleVertex = `
uniform float uTime;
uniform vec2 uViewport;
uniform float uSizeMultiplier;
uniform float uTwinkleStrength;
uniform float uTwinkleRate;
uniform float uDriftStrength;
attribute vec3 aOffset;
attribute vec3 aColor;
attribute vec3 aParams;
varying vec2 vUv;
varying vec3 vColor;
varying float vTwinkle;
varying float vIntensity;

void main() {
  float particleSize = aParams.x;
  float seed = aParams.y;
  vIntensity = aParams.z;
  vec3 center = aOffset;
  if (uDriftStrength > 0.0) {
    center += vec3(
      sin(seed * 71.3 + uTime * 0.17),
      cos(seed * 53.7 + uTime * 0.13),
      sin(seed * 37.9 + uTime * 0.11)
    ) * uDriftStrength;
  }
  vec4 mvCenter = modelViewMatrix * vec4(center, 1.0);
  float distanceScale = clamp(10.8 / max(1.0, -mvCenter.z), 0.46, 1.8);
  float pixelSize = clamp(particleSize * uSizeMultiplier * distanceScale, 0.8, 12.0);
  vec4 clip = projectionMatrix * mvCenter;
  clip.xy += position.xy * pixelSize * 2.0 / max(uViewport, vec2(1.0)) * clip.w;
  gl_Position = clip;
  float twinkleSpeed = 0.035 + fract(seed * 29.17) * 0.045;
  float twinkleCycle = fract(seed * 53.71 + uTime * uTwinkleRate * twinkleSpeed);
  float twinkleEdge = min(twinkleCycle, 1.0 - twinkleCycle);
  float twinkleMask = step(0.30, fract(seed * 11.97));
  float blink = 1.0 - smoothstep(0.0, 0.06, twinkleEdge);
  vTwinkle = 1.0 - twinkleMask * uTwinkleStrength * blink;
  vColor = aColor;
  vUv = uv;
}
`;

const terrainVertex = `
uniform vec2 uViewport;
uniform float uSizeMultiplier;
uniform float uIntensity;
uniform vec2 uShadowOrigin;
uniform vec2 uShadowDir;
uniform float uShadowLength;
uniform float uShadowOpacity;
attribute vec3 aOffset;
attribute vec3 aColor;
attribute vec3 aParams;
varying vec2 vUv;
varying vec3 vColor;
varying float vShadow;

void main() {
  float particleSize = aParams.x;
  float particleIntensity = aParams.z;
  vec2 rel = aOffset.xz - uShadowOrigin;
  float along = dot(rel, uShadowDir);
  float safeLength = max(0.001, uShadowLength);
  float t = clamp((along + 0.08) / safeLength, 0.0, 1.0);
  float lateral = abs(rel.x * uShadowDir.y - rel.y * uShadowDir.x);
  float width = mix(0.18, 0.62, t);
  float longitudinal = smoothstep(-0.14, 0.05, along) *
    (1.0 - smoothstep(safeLength * 0.76, safeLength, along));
  float lateralMask = 1.0 - smoothstep(width * 0.26, width, lateral);
  float contact = 1.0 - smoothstep(0.03, 0.42, length(rel / vec2(0.86, 0.56)));
  vShadow = clamp(max(longitudinal * lateralMask, contact * 0.9) * uShadowOpacity, 0.0, 1.0);

  vec4 mvCenter = modelViewMatrix * vec4(aOffset, 1.0);
  float distanceScale = clamp(9.8 / max(1.0, -mvCenter.z), 0.46, 1.75);
  float pixelSize = clamp(particleSize * uSizeMultiplier * distanceScale, 0.8, 11.0);
  vec4 clip = projectionMatrix * mvCenter;
  clip.xy += position.xy * pixelSize * 2.0 / max(uViewport, vec2(1.0)) * clip.w;
  gl_Position = clip;
  vColor = aColor * uIntensity * particleIntensity * (1.0 - vShadow * 0.78);
  vUv = uv;
}
`;

const terrainFragment = `
uniform float uOpacity;
varying vec2 vUv;
varying vec3 vColor;
varying float vShadow;

void main() {
  vec2 p = vUv - 0.5;
  float radius = length(p);
  float r2 = dot(p, p);
  float core = exp(-16.0 * r2);
  float halo = exp(-4.2 * r2);
  float shape = (core * 0.82 + halo * 0.18) * (1.0 - smoothstep(0.46, 0.51, radius));
  float alpha = shape * uOpacity * (1.0 - vShadow * 0.24);
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(vColor * (0.96 + core * 0.42), alpha);
}
`;

export const createParticleMaterial = (
  _pixelRatio: number,
  options: ParticleMaterialOptions = {},
) => new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uViewport: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uOpacity: { value: options.opacity ?? 1 },
    uIntensity: { value: options.intensity ?? 1 },
    uSizeMultiplier: { value: options.sizeMultiplier ?? 1 },
    uTwinkleStrength: { value: options.twinkleStrength ?? 0.08 },
    uTwinkleRate: { value: options.twinkleRate ?? 0.7 },
    uDriftStrength: { value: options.driftStrength ?? 0 },
  },
  vertexShader: particleVertex,
  fragmentShader: pointFragment,
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: options.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
});

export const createTerrainPointMaterial = (
  _pixelRatio: number,
  opacity = 1,
  sizeMultiplier = 1,
  intensity = 1,
) => new THREE.ShaderMaterial({
  uniforms: {
    uViewport: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uOpacity: { value: opacity },
    uSizeMultiplier: { value: sizeMultiplier },
    uIntensity: { value: intensity },
    uShadowOrigin: { value: new THREE.Vector2(0, 0) },
    uShadowDir: { value: new THREE.Vector2(-0.6, 0.8).normalize() },
    uShadowLength: { value: 4.8 },
    uShadowOpacity: { value: 0.86 },
  },
  vertexShader: terrainVertex,
  fragmentShader: terrainFragment,
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: THREE.AdditiveBlending,
});
