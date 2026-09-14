# Bontr Website

A static, immersive Bontr landing page built with Astro, Three.js, and GSAP.

## Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run check:scene
npm run check
npm run build:pages
```

## Scene architecture

The hero is a deterministic GPU point-cloud scene. Core artwork is generated ahead of time and shipped as validated binary particle buffers; visitors do not generate the flower, galaxy, terrain, or star field.

- `public/data/home-morph.f32` stores the flower and galaxy particle positions, colors, sizes, and glyph data.
- `public/data/home-terrain.f32` stores the landscape particle field.
- `public/data/home-stars.f32` stores the balanced ambient star field.
- `src/scripts/scene/baked.ts` validates and samples those fixed buffers into Three.js `BufferGeometry`.
- `src/scripts/scene/materials.ts` adds lightweight runtime effects such as star twinkle without changing the underlying composition.
- `src/scripts/scene/index.ts` owns the camera path, shooting stars, stable basic-line accents, renderer lifecycle, and context recovery.

The runtime renders directly with `WebGLRenderer`; the composition does not depend on runtime random generation, cursor displacement, or wide-line post-processing. `?scene-test=1` freezes ambient time for deterministic visual regression captures.

## Static deployment

```bash
npm run build
```

The same source can deploy to ordinary static hosting or GitHub Pages.
