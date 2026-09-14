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
varying vec3 vColor;
varying float vGlyph;
varying float vTwinkle;
varying float vIntensity;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float radius = length(uv);
  float core = exp(-18.0 * radius * radius);
  float halo = exp(-4.8 * radius * radius);
  float softDisc = (core * 0.80 + halo * 0.20) * (1.0 - smoothstep(0.46, 0.52, radius));
  float shape = softDisc;
  float alpha = shape * uOpacity * vTwinkle;
  if (alpha < 0.006) discard;
  float crispIntensity = 1.0 + max(0.0, vIntensity - 1.0) * 0.34;
  gl_FragColor = vec4(vColor * uIntensity * crispIntensity * (0.92 + core * 0.50) * vTwinkle, alpha);
}
`;

const particleVertex = `
uniform float uTime;
uniform float uPixelRatio;
uniform float uSizeMultiplier;
uniform float uTwinkleStrength;
uniform float uTwinkleRate;
uniform float uDriftStrength;
attribute vec3 aColor;
attribute float aSize;
attribute float aGlyph;
attribute float aSeed;
attribute float aIntensity;
varying vec3 vColor;
varying float vGlyph;
varying float vTwinkle;
varying float vIntensity;

void main() {
  vec3 localPosition = position;
  if (uDriftStrength > 0.0) {
    localPosition += vec3(
      sin(aSeed * 71.3 + uTime * 0.17),
      cos(aSeed * 53.7 + uTime * 0.13),
      sin(aSeed * 37.9 + uTime * 0.11)
    ) * uDriftStrength;
  }
  vec4 mvPosition = modelViewMatrix * vec4(localPosition, 1.0);
  float distanceScale = clamp(10.8 / max(1.0, -mvPosition.z), 0.46, 1.8);
  gl_PointSize = clamp(aSize * uSizeMultiplier * uPixelRatio * distanceScale, 1.0, 10.5 * uPixelRatio);
  gl_Position = projectionMatrix * mvPosition;
  float twinkleSpeed = 0.18 + fract(aSeed * 29.17) * 0.14;
  float twinklePhase = aSeed * 125.7 + uTime * uTwinkleRate * twinkleSpeed;
  float twinkleWave = 0.5 + 0.5 * sin(twinklePhase);
  float twinkleMask = step(0.55, fract(aSeed * 11.97));
  float blink = smoothstep(0.985, 0.9995, twinkleWave);
  vTwinkle = 1.0 - twinkleMask * uTwinkleStrength * blink;
  vColor = aColor;
  vGlyph = aGlyph;
  vIntensity = aIntensity;
}
`;

const terrainVertex = `
uniform float uTime;
uniform float uPixelRatio;
uniform float uSizeMultiplier;
uniform float uIntensity;
uniform vec2 uShadowOrigin;
uniform vec2 uShadowDir;
uniform float uShadowLength;
uniform float uShadowOpacity;
attribute vec3 aColor;
attribute float aSize;
attribute float aGlyph;
attribute float aSeed;
attribute float aIntensity;
varying vec3 vColor;
varying float vGlyph;
varying float vTwinkle;
varying float vIntensity;
varying float vShadow;

void main() {
  vec3 localPosition = position;
  vec2 rel = localPosition.xz - uShadowOrigin;
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

  vec4 mvPosition = modelViewMatrix * vec4(localPosition, 1.0);
  float distanceScale = clamp(9.8 / max(1.0, -mvPosition.z), 0.46, 1.75);
  gl_PointSize = clamp(aSize * uSizeMultiplier * uPixelRatio * distanceScale, 1.0, 9.5 * uPixelRatio);
  gl_Position = projectionMatrix * mvPosition;
  vTwinkle = 1.0;
  vColor = aColor * uIntensity * aIntensity * (1.0 - vShadow * 0.78);
  vGlyph = aGlyph;
  vIntensity = aIntensity;
}
`;

const terrainFragment = `
uniform float uOpacity;
varying vec3 vColor;
varying float vGlyph;
varying float vTwinkle;
varying float vShadow;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float radius = length(uv);
  float core = exp(-16.0 * radius * radius);
  float halo = exp(-4.2 * radius * radius);
  float softDisc = (core * 0.78 + halo * 0.22) * (1.0 - smoothstep(0.46, 0.52, radius));
  float alpha = softDisc * uOpacity * (1.0 - vShadow * 0.24);
  if (alpha < 0.006) discard;
  gl_FragColor = vec4(vColor * (0.96 + core * 0.42), alpha);
}
`;

export const createParticleMaterial = (
  pixelRatio: number,
  options: ParticleMaterialOptions = {},
) => new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uPixelRatio: { value: pixelRatio },
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
  pixelRatio: number,
  opacity = 1,
  sizeMultiplier = 1,
  intensity = 1,
) => new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uPixelRatio: { value: pixelRatio },
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


export const createDensityCarrierMaterial = (
  pixelRatio: number,
  sizeMultiplier: number,
  opacity: number,
  intensity: number,
) => new THREE.ShaderMaterial({
  uniforms: {
    uPixelRatio: { value: pixelRatio },
    uSizeMultiplier: { value: sizeMultiplier },
    uOpacity: { value: opacity },
    uIntensity: { value: intensity },
  },
  vertexShader: `
    uniform float uPixelRatio;
    uniform float uSizeMultiplier;
    attribute vec3 aColor;
    attribute float aSize;
    attribute float aIntensity;
    attribute float aSeed;
    varying vec3 vColor;
    varying float vDensity;
    void main() {
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      float distanceScale = clamp(10.8 / max(1.0, -mvPosition.z), 0.46, 1.8);
      float carrierMask = step(0.90, fract(aSeed * 31.17));
      vDensity = smoothstep(1.12, 1.76, aIntensity) * carrierMask;
      float spread = 1.0 + vDensity * 1.35;
      gl_PointSize = clamp(aSize * uSizeMultiplier * spread * uPixelRatio * distanceScale, 1.0, 18.0 * uPixelRatio);
      gl_Position = projectionMatrix * mvPosition;
      vColor = aColor;
    }
  `,
  fragmentShader: `
    uniform float uOpacity;
    uniform float uIntensity;
    varying vec3 vColor;
    varying float vDensity;
    void main() {
      if (vDensity < 0.002) discard;
      vec2 uv = gl_PointCoord - 0.5;
      float r2 = dot(uv, uv);
      float halo = exp(-5.2 * r2);
      float alpha = halo * uOpacity * vDensity;
      if (alpha < 0.004) discard;
      gl_FragColor = vec4(vColor * uIntensity, alpha);
    }
  `,
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: THREE.AdditiveBlending,
});
