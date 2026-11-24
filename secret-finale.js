(() => {
  'use strict';

  const COLORS = [
    [255, 255, 255],
    [255, 230, 240],
    [245, 200, 220],
    [255, 210, 225],
    [235, 190, 215],
  ];

  const MESSAGE = 'Eu te amo muito.';

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
  }

  function easeInOutQuart(x) {
    return x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2;
  }

  let active = false;
  let elapsed = 0;
  let particles = [];
  let ambientStars = [];

  function initParticles() {
    const flat = window.COUPLE_POINTS || [];
    const count = Math.floor(flat.length / 2);
    particles = new Array(count);

    for (let i = 0; i < count; i++) {
      const tx = flat[i * 2];
      const ty = flat[i * 2 + 1];

      // Start scattered across the full viewport with slight swirl angle
      const sx = (Math.random() - 0.5) * 1.95;
      const sy = (Math.random() - 0.5) * 1.65;
      const col = COLORS[Math.floor(Math.random() * COLORS.length)];

      particles[i] = {
        sx,
        sy,
        tx,
        ty,
        // Stagger convergence slightly so it feels organic like stardust gathering
        delay: 0.7 + Math.random() * 1.6,
        dur: 4.4 + Math.random() * 2.2,
        swirl: (Math.random() - 0.5) * 0.42,
        phase: Math.random() * Math.PI * 2,
        twinkle: 2.0 + Math.random() * 3.5,
        size: Math.random() < 0.16 ? 2.1 : Math.random() < 0.55 ? 1.5 : 1.15,
        col,
      };
    }

    ambientStars = [];
    for (let i = 0; i < 110; i++) {
      ambientStars.push({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.004,
        vy: (Math.random() - 0.5) * 0.004,
        phase: Math.random() * Math.PI * 2,
        speed: 1.4 + Math.random() * 2.8,
        size: Math.random() < 0.25 ? 1.6 : 1.0,
      });
    }
  }

  function start() {
    initParticles();
    active = true;
    elapsed = 0;
  }

  function reset() {
    active = false;
    elapsed = 0;
    particles = [];
    ambientStars = [];
  }

  function isActive() {
    return active;
  }

  function update(dt) {
    if (!active) return;
    elapsed += dt;
  }

  function draw(ctx, w, h) {
    if (!active) return;

    const fadeIn = easeOutCubic(clamp(elapsed / 1.4, 0, 1));

    // Deep dark violet-black night sky matching video BG = (6, 4, 10)
    ctx.fillStyle = `rgba(6, 4, 10, ${fadeIn.toFixed(3)})`;
    ctx.fillRect(0, 0, w, h);

    // Subtle soft rose-lavender nebula glow behind the couple
    const minDim = Math.min(w, h);
    const neb = ctx.createRadialGradient(w * 0.5, h * 0.56, 10, w * 0.5, h * 0.56, minDim * 0.5);
    neb.addColorStop(0, `rgba(255, 195, 225, ${(0.06 * fadeIn).toFixed(3)})`);
    neb.addColorStop(1, 'rgba(6, 4, 10, 0)');
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, w, h);

    // Ambient twinkling background stars
    for (let i = 0; i < ambientStars.length; i++) {
      const st = ambientStars[i];
      const sx = (((st.x + st.vx * elapsed) % 1) + 1) % 1;
      const sy = (((st.y + st.vy * elapsed) % 1) + 1) % 1;
      const a = fadeIn * (0.14 + 0.36 * (0.5 + 0.5 * Math.sin(elapsed * st.speed + st.phase)));
      ctx.fillStyle = `rgba(245, 225, 240, ${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(sx * w, sy * h, st.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Converging stardust particles forming the couple line-art
    const isPortrait = w < h;
    const artSpan = isPortrait ? minDim * 0.96 : minDim * 0.68;
    const centerX = w * 0.5;
    const centerY = h * (isPortrait ? 0.54 : 0.57);
    const sizeScale = minDim < 500 ? 0.95 : 1.0;

    ctx.save();
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const raw = clamp((elapsed - p.delay) / p.dur, 0, 1);
      const u = easeInOutQuart(raw);

      // Gentle swirl offset that peaks mid-flight and settles to 0 at target
      const arc = Math.sin(u * Math.PI) * p.swirl;
      const dx = p.tx - p.sx;
      const dy = p.ty - p.sy;
      let nx = p.sx + dx * u - dy * arc;
      let ny = p.sy + dy * u + dx * arc;

      // Tiny living shimmer once settled
      const jitter = (1 - u) * 0.008 + 0.0014;
      nx += Math.sin(elapsed * 2.1 + p.phase) * jitter;
      ny += Math.cos(elapsed * 1.9 + p.phase) * jitter;

      const px = centerX + nx * artSpan;
      const py = centerY + ny * artSpan;

      const tw = 0.68 + 0.32 * Math.sin(elapsed * p.twinkle + p.phase);
      const alpha = fadeIn * (0.35 + 0.65 * u) * tw;
      const [r, g, b] = p.col;

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(px, py, p.size * sizeScale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Typewriter italic serif message above the couple: "Eu te amo muito."
    const textStart = 7.4;
    const textDur = 3.2;
    if (elapsed > textStart) {
      const pText = clamp((elapsed - textStart) / textDur, 0, 1);
      const chars = Math.floor(pText * MESSAGE.length + 0.001);
      const shown = MESSAGE.slice(0, chars);
      const fontSize = clamp(Math.round(minDim * (isPortrait ? 0.072 : 0.048)), 22, 46);
      const textY = Math.max(fontSize * 1.6, centerY - artSpan * 0.57);

      ctx.save();
      ctx.font = `italic 500 ${fontSize}px 'Playfair Display', Georgia, 'Times New Roman', serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(255, 200, 225, 0.55)';
      ctx.shadowBlur = 14;
      ctx.fillStyle = 'rgba(255, 232, 242, 0.96)';
      ctx.fillText(shown, w * 0.5, textY);
      ctx.restore();
    }
  }

  window.SecretFinale = { start, reset, isActive, update, draw };
})();
