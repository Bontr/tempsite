import * as THREE from 'three';

export type ParticleMaterialOptions = {
  opacity?: number;
  twinkleStrength?: number;
  twinkleRate?: number;
  driftStrength?: number;
};

const pointFragment = `
uniform float uOpacity;
varying vec3 vColor;
varying float vGlyph;
varying float vTwinkle;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float radius = length(uv);
  float circle = 1.0 - smoothstep(0.34, 0.5, radius);
  float horizontal = (1.0 - smoothstep(0.065, 0.13, abs(uv.y))) *
    (1.0 - smoothstep(0.34, 0.48, abs(uv.x)));
  float vertical = (1.0 - smoothstep(0.065, 0.13, abs(uv.x))) *
    (1.0 - smoothstep(0.34, 0.48, abs(uv.y)));
  float shape = mix(circle, max(horizontal, vertical), step(0.5, vGlyph));
  float glow = 1.0 - smoothstep(0.08, 0.5, radius);
  float alpha = shape * uOpacity * vTwinkle;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(vColor * (1.08 + glow * 0.42) * vTwinkle, alpha);
}
`;

const particleVertex = `
uniform float uTime;
uniform float uPixelRatio;
uniform float uTwinkleStrength;
uniform float uTwinkleRate;
uniform float uDriftStrength;
attribute vec3 aColor;
attribute float aSize;
attribute float aGlyph;
attribute float aSeed;
varying vec3 vColor;
varying float vGlyph;
varying float vTwinkle;

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
  gl_PointSize = clamp(aSize * uPixelRatio * distanceScale, 1.0, 8.5 * uPixelRatio);
  gl_Position = projectionMatrix * mvPosition;
  float wave = 0.5 + 0.5 * sin(aSeed * 91.7 + uTime * uTwinkleRate);
  float flare = pow(max(0.0, sin(aSeed * 47.1 + uTime * uTwinkleRate * 0.37)), 14.0);
  vTwinkle = 1.0 + uTwinkleStrength * ((wave - 0.5) * 0.55 + flare * 0.9);
  vColor = aColor;
  vGlyph = aGlyph;
}
`;

const terrainVertex = `
uniform float uTime;
uniform float uPixelRatio;
uniform vec2 uShadowOrigin;
uniform vec2 uShadowDir;
uniform float uShadowLength;
uniform float uShadowOpacity;
attribute vec3 aColor;
attribute float aSize;
attribute float aGlyph;
attribute float aSeed;
varying vec3 vColor;
varying float vGlyph;
varying float vTwinkle;
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
  gl_PointSize = clamp(aSize * uPixelRatio * distanceScale, 1.0, 7.0 * uPixelRatio);
  gl_Position = projectionMatrix * mvPosition;
  vTwinkle = 1.0;
  vColor = aColor * (1.0 - vShadow * 0.78);
  vGlyph = aGlyph;
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
  float circle = 1.0 - smoothstep(0.34, 0.5, radius);
  float horizontal = (1.0 - smoothstep(0.065, 0.13, abs(uv.y))) *
    (1.0 - smoothstep(0.34, 0.48, abs(uv.x)));
  float vertical = (1.0 - smoothstep(0.065, 0.13, abs(uv.x))) *
    (1.0 - smoothstep(0.34, 0.48, abs(uv.y)));
  float shape = mix(circle, max(horizontal, vertical), step(0.5, vGlyph));
  float glow = 1.0 - smoothstep(0.08, 0.5, radius);
  float alpha = shape * uOpacity * vTwinkle * (1.0 - vShadow * 0.28);
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(vColor * (0.96 + glow * 0.18), alpha);
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
    uTwinkleStrength: { value: options.twinkleStrength ?? 0.08 },
    uTwinkleRate: { value: options.twinkleRate ?? 0.7 },
    uDriftStrength: { value: options.driftStrength ?? 0 },
  },
  vertexShader: particleVertex,
  fragmentShader: pointFragment,
  transparent: true,
  depthWrite: false,
  depthTest: true,
  blending: THREE.NormalBlending,
});

export const createTerrainPointMaterial = (
  pixelRatio: number,
  opacity = 1,
) => new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uPixelRatio: { value: pixelRatio },
    uOpacity: { value: opacity },
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
  blending: THREE.NormalBlending,
});

export const createGlowMaterial = () => new THREE.ShaderMaterial({
  uniforms: {
    uOpacity: { value: 1 },
    uColor: { value: new THREE.Color(1.35, 0.82, 0.52) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uOpacity;
    uniform vec3 uColor;
    varying vec2 vUv;
    void main() {
      vec2 p = vUv - 0.5;
      float d = length(p);
      float halo = 1.0 - smoothstep(0.02, 0.5, d);
      halo *= halo;
      gl_FragColor = vec4(uColor, halo * uOpacity * 0.52);
    }
  `,
  transparent: true,
  depthWrite: false,
  depthTest: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
});
