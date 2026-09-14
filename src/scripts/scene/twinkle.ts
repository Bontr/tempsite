const canvas = document.querySelector<HTMLCanvasElement>('[data-twinkle-canvas]');

if (canvas) {
  const context = canvas.getContext('2d', { alpha: true });
  if (context) {
    type Sparkle = {
      x: number;
      y: number;
      size: number;
      phase: number;
      rate: number;
      base: number;
      amplitude: number;
      warm: number;
      cross: boolean;
    };

    const makeRng = (seed: number) => {
      let state = seed >>> 0;
      return () => {
        state = (Math.imul(1664525, state) + 1013904223) >>> 0;
        return state / 4294967296;
      };
    };
    const rng = makeRng(0xB07A2026);
    const mobile = window.innerWidth < 720;
    const sparkles: Sparkle[] = [];
    const ambientCount = mobile ? 150 : 300;
    const flowerCount = mobile ? 55 : 105;

    const addSparkle = (x: number, y: number, flower = false) => {
      const rare = rng() > 0.91;
      sparkles.push({
        x,
        y,
        size: (flower ? 0.34 : 0.42) + rng() * (rare ? 1.05 : 0.55),
        phase: rng() * Math.PI * 2,
        rate: 0.42 + rng() * 0.72,
        base: 0.07 + rng() * 0.12,
        amplitude: (rare ? 0.58 : 0.30) + rng() * 0.16,
        warm: rng() < 0.15 ? 1 : 0,
        cross: rare || rng() < 0.035,
      });
    };

    for (let index = 0; index < ambientCount; index += 1) {
      let x = 0.02 + rng() * 0.96;
      const y = 0.025 + rng() * 0.84;
      if (x < 0.35 && y > 0.18 && y < 0.72 && rng() < 0.72) x = 0.40 + rng() * 0.56;
      addSparkle(x, y);
    }
    for (let index = 0; index < flowerCount; index += 1) {
      const angle = rng() * Math.PI * 2;
      const radius = Math.sqrt(rng());
      const x = 0.685 + Math.cos(angle) * radius * 0.205;
      const y = 0.415 + Math.sin(angle) * radius * 0.255;
      addSparkle(x, y, true);
    }

    let cssWidth = 1;
    let cssHeight = 1;
    const resize = () => {
      cssWidth = Math.max(1, window.innerWidth);
      cssHeight = Math.max(1, window.innerHeight);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(cssWidth * pixelRatio);
      canvas.height = Math.round(cssHeight * pixelRatio);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
    };

    const draw = (seconds: number) => {
      const pixelRatio = canvas.width / cssWidth;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.globalCompositeOperation = 'lighter';
      const glowRadius = Math.max(100, cssWidth * 0.11);
      const glow = context.createRadialGradient(
        cssWidth * 0.685, cssHeight * 0.415, 0,
        cssWidth * 0.685, cssHeight * 0.415, glowRadius,
      );
      glow.addColorStop(0, 'rgba(255, 222, 184, 0.085)');
      glow.addColorStop(0.22, 'rgba(239, 154, 79, 0.050)');
      glow.addColorStop(1, 'rgba(239, 154, 79, 0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, cssWidth, cssHeight);

      for (const sparkle of sparkles) {
        const wave = 0.5 + 0.5 * Math.sin(sparkle.phase + seconds * sparkle.rate * Math.PI * 2);
        const flareWave = Math.max(0, Math.sin(sparkle.phase * 1.73 + seconds * sparkle.rate * 1.37));
        const flare = flareWave ** 14;
        const alpha = Math.min(0.92, sparkle.base + sparkle.amplitude * (wave * 0.22 + flare * 0.78));
        const x = sparkle.x * cssWidth;
        const y = sparkle.y * cssHeight;
        const size = sparkle.size * (1 + flare * 0.85);
        context.fillStyle = sparkle.warm
          ? `rgba(255, 185, 112, ${alpha})`
          : `rgba(238, 244, 255, ${alpha})`;
        context.beginPath();
        context.arc(x, y, size, 0, Math.PI * 2);
        context.fill();
        if (sparkle.cross && flare > 0.34) {
          const ray = size * (2.7 + flare * 2.1);
          context.globalAlpha = Math.min(0.68, alpha * flare);
          context.fillRect(x - ray, y - 0.28, ray * 2, 0.56);
          context.fillRect(x - 0.28, y - ray, 0.56, ray * 2);
          context.globalAlpha = 1;
        }
      }
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startedAt = performance.now();
    const animate = (time: number) => {
      draw(reduceMotion ? 0 : Math.max(0, (time - startedAt) * 0.001));
      if (!reduceMotion) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }
}
