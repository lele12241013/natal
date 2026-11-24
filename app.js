(() => {
  'use strict';

  // --- Timeline (seconds) ---
  const T_GROUND = [0.0, 1.0];
  const T_TRUNK = [0.6, 1.3];
  const T_TREE = [1.2, 6.0];
  const T_LIGHTS = [6.0, 10.0];
  const T_ORN = [6.6, 10.4];
  const T_STAR = [10.2, 11.0];
  const T_GIFT = [10.6, 12.6];
  const T_TEXT = [12.6, 15.6];

  const WORD = 'EUTEAMO';

  // Deterministic PRNG (Mulberry32)
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function ramp(t, a, b) {
    return clamp((t - a) / (b - a), 0, 1);
  }

  function ease(x) {
    return 1 - Math.pow(1 - x, 3);
  }

  // --- Exact 3-tier Tree Geometry ---
  const TIER_SPANS = [
    [0.0, 0.4, 0.0],
    [0.26, 0.7, 0.32],
    [0.55, 1.0, 0.3],
  ];
  const TIER_RMAX = [0.34, 0.49, 0.67];

  function tierR(k, u) {
    const r0 = TIER_SPANS[k][2];
    return TIER_RMAX[k] * (r0 + (1 - r0) * Math.pow(u, k === 0 ? 1.15 : 1.0));
  }

  function treeRadius(hq) {
    let out = 0;
    for (let k = 0; k < 3; k++) {
      const [top, bot] = TIER_SPANS[k];
      const u = (hq - top) / (bot - top);
      if (u >= 0 && u <= 1) {
        const rk = tierR(k, u);
        if (rk > out) out = rk;
      }
    }
    return out;
  }

  const rng = mulberry32(7);

  // 1. Rich Starry Snowfield
  const snowParticles = [];
  for (let i = 0; i < 460; i++) {
    const roll = rng();
    snowParticles.push({
      x: rng(),
      y: rng(),
      vy: 0.008 + rng() * 0.022,
      vx: (rng() - 0.5) * 0.003,
      phase: rng() * Math.PI * 2,
      twinkle: 1.2 + rng() * 3.2,
      ch: roll < 0.16 ? '+' : roll < 0.32 ? '*' : roll < 0.6 ? '.' : '·',
      bright: 0.35 + rng() * 0.65,
      isBig: roll < 0.14,
    });
  }

  // 2. Ground Plane
  const N_GROUND = 4600;
  const gndX = new Float32Array(N_GROUND);
  const gndY = new Float32Array(N_GROUND);
  const gndZ = new Float32Array(N_GROUND);
  const gndFade = new Float32Array(N_GROUND);
  const gndPhase = new Float32Array(N_GROUND);
  const gndCh = new Array(N_GROUND);
  for (let i = 0; i < N_GROUND; i++) {
    const r = Math.sqrt(rng()) * 1.45;
    const a = rng() * Math.PI * 2;
    gndX[i] = Math.cos(a) * r;
    gndY[i] = -0.17 + (rng() - 0.5) * 0.008;
    gndZ[i] = Math.sin(a) * r;
    gndFade[i] = clamp(1 - r / 1.5, 0.12, 0.95);
    gndPhase[i] = rng() * 6.28;
    gndCh[i] = rng() < 0.15 ? '.' : WORD[Math.floor(rng() * WORD.length)];
  }

  // 3. Trunk
  const N_TRUNK = 1100;
  const trkX = new Float32Array(N_TRUNK);
  const trkY = new Float32Array(N_TRUNK);
  const trkZ = new Float32Array(N_TRUNK);
  const trkH = new Float32Array(N_TRUNK);
  const trkCh = new Array(N_TRUNK);
  for (let i = 0; i < N_TRUNK; i++) {
    const h = rng();
    const a = rng() * Math.PI * 2;
    const r = 0.072 * (0.85 + 0.25 * rng()) * (1 - h * 0.15);
    trkX[i] = Math.cos(a) * r;
    trkY[i] = -0.17 + h * 0.24;
    trkZ[i] = Math.sin(a) * r;
    trkH[i] = h;
    trkCh[i] = WORD[Math.floor(rng() * WORD.length)];
  }

  // 4. Tree Foliage (33,000 points)
  const tierCounts = [7000, 11000, 15000];
  const N_TREE = tierCounts[0] + tierCounts[1] + tierCounts[2];
  const treeX = new Float32Array(N_TREE);
  const treeY = new Float32Array(N_TREE);
  const treeZ = new Float32Array(N_TREE);
  const treeGrow = new Float32Array(N_TREE);
  const treeShade = new Float32Array(N_TREE);
  const treeTip = new Float32Array(N_TREE);
  const treeCh = new Array(N_TREE);

  let ti = 0;
  for (let k = 0; k < 3; k++) {
    const [top, bot] = TIER_SPANS[k];
    const n = tierCounts[k];
    for (let i = 0; i < n; i++) {
      const u = Math.pow(rng(), k === 0 ? 0.75 : 0.85);
      const a = rng() * Math.PI * 2;
      const hb = top + (bot - top) * u;

      const lobeWave = Math.sin(a * 9 + k * 1.7);
      const lobe = 1 + 0.095 * lobeWave * u * u;
      const shell = Math.sqrt(0.55 + 0.45 * rng());
      const r = tierR(k, u) * lobe * shell;

      const droop = 0.036 * u * u * (0.4 + 0.6 * lobeWave) * shell;
      const y = 1.0 - hb - droop;

      let skirtShadow = 1.0;
      if (k > 0) {
        if (u < 0.38) {
          skirtShadow = 0.1;
        } else if (u < 0.6) {
          const s = (u - 0.38) / 0.22;
          skirtShadow = 0.1 + 0.9 * (s * s);
        }
      }

      const skirtRimBoost = u > 0.76 ? 1.0 + 0.38 * ((u - 0.76) / 0.24) : 1.0;
      const ridgeShade = 0.42 + 0.58 * (0.5 + 0.5 * lobeWave);
      const branchClump = 0.72 + 0.28 * Math.sin(a * 11 + hb * 26 + k * 2.1);
      const isOuterTip = shell > 0.92 && (lobeWave > 0.25 || u > 0.8);

      treeX[ti] = Math.cos(a) * r;
      treeY[ti] = y;
      treeZ[ti] = Math.sin(a) * r;
      treeGrow[ti] = clamp(1.0 - hb, 0, 1);
      treeShade[ti] = skirtShadow * skirtRimBoost * ridgeShade * branchClump * (0.42 + 0.58 * shell);
      treeTip[ti] = isOuterTip ? 1 : 0;

      if (isOuterTip && rng() < 0.22) {
        treeCh[ti] = rng() < 0.5 ? '+' : rng() < 0.8 ? '*' : '.';
      } else {
        treeCh[ti] = WORD[Math.floor(rng() * WORD.length)];
      }
      ti++;
    }
  }

  // 5. Spiral Garland Lights
  const TOTAL_LIGHTS = 176;
  const lightPts = [];
  for (let i = 0; i < TOTAL_LIGHTS; i++) {
    const frac = i / (TOTAL_LIGHTS - 1);
    const hb = 0.95 - frac * 0.9;
    const turns = 5.6;
    const a = frac * Math.PI * 2 * turns;
    const lobe = 1 + 0.07 * Math.sin(a * 9);
    const r = treeRadius(hb) * lobe * 1.025;
    const y = 1.0 - hb;
    const warm = rng() < 0.75;
    lightPts.push({
      x: Math.cos(a) * r,
      y,
      z: Math.sin(a) * r,
      frac,
      phase: rng() * Math.PI * 2,
      speed: 2.6 + rng() * 3.2,
      color: warm ? [255, 222, 105] : [255, 250, 215],
    });
  }

  // 6. Ornaments
  const ORN_PALETTE = [
    [255, 62, 82],
    [255, 208, 60],
    [68, 204, 255],
    [255, 96, 200],
    [255, 142, 48],
  ];
  const ornamentPts = [];
  for (let i = 0; i < 62; i++) {
    const frac = 0.08 + rng() * 0.82;
    const hb = 0.94 - frac * 0.86;
    const a = rng() * Math.PI * 2;
    const r = treeRadius(hb) * 1.03;
    const y = 1.0 - hb;
    const col = ORN_PALETTE[Math.floor(rng() * ORN_PALETTE.length)];
    ornamentPts.push({
      x: Math.cos(a) * r,
      y,
      z: Math.sin(a) * r,
      popAt: rng(),
      col,
    });
  }

  // 7. Seven Interactive Gift Boxes (1 for each 3D BT21 plushie!)
  const BT21_GIFTS = [
    {
      key: 'tata',
      name: 'TATA',
      member: 'BT21 · V (Taehyung)',
      accent: '#ff4b63',
      glow: 'rgba(255, 75, 99, 0.34)',
      body: [242, 52, 72],
      rib: [255, 224, 96],
    },
    {
      key: 'koya',
      name: 'KOYA',
      member: 'BT21 · RM',
      accent: '#60b8ff',
      glow: 'rgba(96, 184, 255, 0.34)',
      body: [64, 158, 255],
      rib: [245, 250, 255],
    },
    {
      key: 'chimmy',
      name: 'CHIMMY',
      member: 'BT21 · Jimin',
      accent: '#ffd447',
      glow: 'rgba(255, 212, 71, 0.34)',
      body: [250, 196, 48],
      rib: [238, 54, 76],
    },
    {
      key: 'cooky',
      name: 'COOKY',
      member: 'BT21 · Jungkook',
      accent: '#ff8ec7',
      glow: 'rgba(255, 142, 199, 0.34)',
      body: [248, 126, 186],
      rib: [255, 245, 250],
    },
    {
      key: 'rj',
      name: 'RJ',
      member: 'BT21 · Jin',
      accent: '#ff9b54',
      glow: 'rgba(255, 155, 84, 0.32)',
      body: [236, 240, 248],
      rib: [255, 126, 54],
    },
    {
      key: 'shooky',
      name: 'SHOOKY',
      member: 'BT21 · Suga',
      accent: '#d99352',
      glow: 'rgba(217, 147, 82, 0.34)',
      body: [196, 122, 62],
      rib: [255, 226, 118],
    },
    {
      key: 'mang',
      name: 'MANG',
      member: 'BT21 · J-Hope',
      accent: '#b482ff',
      glow: 'rgba(180, 130, 255, 0.34)',
      body: [170, 96, 255],
      rib: [110, 226, 255],
    },
  ];

  // Arrange the 7 gift boxes in a neat ring around the base of the tree
  const GIFT_SPECS = BT21_GIFTS.map((bt, idx) => {
    const angle = (idx / BT21_GIFTS.length) * Math.PI * 2 + 0.35;
    const dist = 0.46 + (idx % 2) * 0.05;
    // Where the 3D ASCII BT21 plushie stands right beside the tree once the gift disappears
    const plushDist = 0.55;
    return {
      ...bt,
      id: idx,
      angle,
      cx: Math.cos(angle) * dist,
      cz: Math.sin(angle) * dist,
      px: Math.cos(angle) * plushDist,
      pz: Math.sin(angle) * plushDist,
      w: 0.15,
      h: 0.115,
      d: 0.145,
      rot: angle * 0.6,
      popAt: idx / BT21_GIFTS.length,
      opened: false,
      openAnim: 0, // 0 = closed, 1 = opened & plushie standing beside tree
    };
  });

  // Generate ultra-dense solid faces for each gift (marking lid vs base so lid pops up!)
  const giftPts = [];
  GIFT_SPECS.forEach((g) => {
    const cosR = Math.cos(g.rot);
    const sinR = Math.sin(g.rot);
    const steps = 18;
    const addPoint = (lx, ly, lz, isLid) => {
      const isRibbon =
        Math.abs(lx) < g.w * 0.16 ||
        Math.abs(lz) < g.d * 0.16 ||
        Math.abs(ly - g.h * 0.85) < 0.016;
      const wx = g.cx + lx * cosR - lz * sinR;
      const wz = g.cz + lx * sinR + lz * cosR;
      const wy = -0.17 + ly;
      giftPts.push({
        giftId: g.id,
        x: wx,
        y: wy,
        z: wz,
        isLid,
        col: isRibbon ? g.rib : g.body,
        ch: isRibbon ? '#' : WORD[Math.floor(rng() * WORD.length)],
      });
    };

    for (let a = 0; a <= steps; a++) {
      const u = a / steps - 0.5;
      for (let b = 0; b <= steps; b++) {
        const v = b / steps;
        const vCentered = v - 0.5;
        const isLid = v > 0.8;
        addPoint(u * g.w, v * g.h, g.d * 0.5, isLid);
        addPoint(u * g.w, v * g.h, -g.d * 0.5, isLid);
        addPoint(g.w * 0.5, v * g.h, u * g.d, isLid);
        addPoint(-g.w * 0.5, v * g.h, u * g.d, isLid);
        addPoint(u * g.w, g.h, vCentered * g.d, true);
      }
    }
  });

  // 7b. Secret Gift Box (unlocks right in front of the tree after all 7 BT21 gifts are opened)
  const SECRET_GIFT = {
    unlocked: false,
    opened: false,
    appearAnim: 0,
    cx: 0,
    cz: 0.34,
    w: 0.19,
    h: 0.145,
    d: 0.18,
    body: [255, 206, 64],
    rib: [255, 250, 235],
    accent: '#ffd85a',
  };

  const secretGiftPts = [];
  {
    const steps = 20;
    const addPt = (lx, ly, lz) => {
      const isRibbon =
        Math.abs(lx) < SECRET_GIFT.w * 0.17 ||
        Math.abs(lz) < SECRET_GIFT.d * 0.17 ||
        Math.abs(ly - SECRET_GIFT.h * 0.85) < 0.018;
      secretGiftPts.push({
        lx,
        ly,
        lz,
        isRibbon,
        ch: isRibbon ? '♥' : WORD[Math.floor(rng() * WORD.length)],
      });
    };
    for (let a = 0; a <= steps; a++) {
      const u = a / steps - 0.5;
      for (let b = 0; b <= steps; b++) {
        const v = b / steps;
        const vC = v - 0.5;
        addPt(u * SECRET_GIFT.w, v * SECRET_GIFT.h, SECRET_GIFT.d * 0.5);
        addPt(u * SECRET_GIFT.w, v * SECRET_GIFT.h, -SECRET_GIFT.d * 0.5);
        addPt(SECRET_GIFT.w * 0.5, v * SECRET_GIFT.h, u * SECRET_GIFT.d);
        addPt(-SECRET_GIFT.w * 0.5, v * SECRET_GIFT.h, u * SECRET_GIFT.d);
        addPt(u * SECRET_GIFT.w, SECRET_GIFT.h, vC * SECRET_GIFT.d);
      }
    }
  }

  // Sparkle burst particles when a gift is opened
  const burstParticles = [];
  function spawnGiftBurst(cx, cy, cz, accentRgb) {
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.18 + Math.random() * 0.34;
      burstParticles.push({
        x: cx,
        y: cy + 0.1,
        z: cz,
        vx: Math.cos(a) * sp,
        vy: 0.28 + Math.random() * 0.42,
        vz: Math.sin(a) * sp,
        life: 1.0,
        ch: Math.random() < 0.35 ? '♥' : Math.random() < 0.7 ? '*' : '+',
        col: Math.random() < 0.5 ? [255, 232, 120] : accentRgb,
      });
    }
  }

  // --- DOM & Offscreen Canvases ---
  const canvas = document.getElementById('asciiCanvas');
  const ctx = canvas.getContext('2d');
  const crispCanvas = document.createElement('canvas');
  const crispCtx = crispCanvas.getContext('2d');
  const bloomCanvas = document.createElement('canvas');
  const bloomCtx = bloomCanvas.getContext('2d');

  const btnPlayPause = document.getElementById('btnPlayPause');
  const btnRestart = document.getElementById('btnRestart');
  const giftToast = document.getElementById('giftToast');
  const treePrompt = document.getElementById('treePrompt');
  let toastTimer = 0;

  // --- High-Density Monospace Grid ---
  let canvasW = window.innerWidth;
  let canvasH = window.innerHeight;
  let dpr = 1;
  let COLS = 160;
  let ROWS = 96;
  let cellW = 6;
  let cellH = 10;
  let zBuf, chBuf, rBuf, gBuf, bBuf;

  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.parentElement.getBoundingClientRect();
    canvasW = Math.max(260, Math.round(rect.width || window.innerWidth));
    canvasH = Math.max(260, Math.round(rect.height || window.innerHeight));

    canvas.width = Math.floor(canvasW * dpr);
    canvas.height = Math.floor(canvasH * dpr);
    crispCanvas.width = Math.floor(canvasW * dpr);
    crispCanvas.height = Math.floor(canvasH * dpr);
    bloomCanvas.width = Math.max(140, Math.floor(canvasW * 0.35));
    bloomCanvas.height = Math.max(140, Math.floor(canvasH * 0.35));

    // Scale ASCII cell size proportionally to minDim so mobile portrait stays crisp and never squished
    const minDim = Math.min(canvasW, canvasH);
    const idealCellH = clamp(minDim / 78, 6.2, 11.2);
    ROWS = Math.max(58, Math.round(canvasH / idealCellH));
    cellH = canvasH / ROWS;
    const idealCellW = cellH * 0.6;
    COLS = Math.max(58, Math.round(canvasW / idealCellW));
    cellW = canvasW / COLS;

    const count = COLS * ROWS;
    zBuf = new Float32Array(count);
    chBuf = new Array(count);
    rBuf = new Uint8Array(count);
    gBuf = new Uint8Array(count);
    bBuf = new Uint8Array(count);
  }

  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 120));
  resizeCanvas();

  function clearBuffers() {
    zBuf.fill(-1e9);
    chBuf.fill('');
  }

  // --- 3D Projection ---
  function project(x, y, z, cosA, sinA) {
    const rx = x * cosA - z * sinA;
    const rz = x * sinA + z * cosA;

    const tilt = -0.22;
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);
    const yc = y - 0.44;
    const ty = yc * cosT - rz * sinT;
    const tz = yc * sinT + rz * cosT;

    const camDist = 2.6;
    const depth = camDist - tz;
    if (depth <= 0.3) return null;

    const minDim = Math.min(canvasW, canvasH);
    const isPortrait = canvasW < canvasH;
    const pxScaleX = (minDim * (isPortrait ? 1.58 : 1.48)) / depth;
    const pxScaleY = isPortrait ? pxScaleX * 1.24 : pxScaleX;
    const px = canvasW * 0.5 + rx * pxScaleX;
    const py = canvasH * (isPortrait ? 0.52 : 0.48) - ty * pxScaleY;

    const col = Math.floor(px / cellW);
    const row = Math.floor(py / cellH);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
    return { col, row, z: tz, rx, px, py };
  }

  function plot(col, row, z, ch, r, g, b) {
    const idx = row * COLS + col;
    if (z > zBuf[idx]) {
      zBuf[idx] = z;
      chBuf[idx] = ch;
      rBuf[idx] = r;
      gBuf[idx] = g;
      bBuf[idx] = b;
    }
  }

  // --- Hit-Testing State for Clickable Gift Boxes ---
  const giftHitBoxes = GIFT_SPECS.map(() => ({
    visible: false,
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    maxZ: -Infinity,
  }));
  const secretHitBox = {
    visible: false,
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    maxZ: -Infinity,
  };
  let hoveredGiftId = -1;
  let hoveredSecret = false;

  const isTouchDevice = () => window.matchMedia('(pointer: coarse)').matches;

  function isSecretAt(clientX, clientY) {
    if (!secretHitBox.visible) return false;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const pad = isTouchDevice() ? 22 : 12;
    return (
      x >= secretHitBox.minX - pad &&
      x <= secretHitBox.maxX + pad &&
      y >= secretHitBox.minY - pad &&
      y <= secretHitBox.maxY + pad
    );
  }

  function findGiftAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let bestId = -1;
    let bestZ = -Infinity;
    const pad = isTouchDevice() ? 20 : 10;
    for (let i = 0; i < giftHitBoxes.length; i++) {
      const hb = giftHitBoxes[i];
      if (!hb.visible) continue;
      if (x >= hb.minX - pad && x <= hb.maxX + pad && y >= hb.minY - pad && y <= hb.maxY + pad) {
        if (hb.maxZ > bestZ) {
          bestZ = hb.maxZ;
          bestId = i;
        }
      }
    }
    return bestId;
  }

  function showToast(text, accent, duration = 2800) {
    giftToast.style.setProperty('--toast-accent', accent);
    giftToast.textContent = text;
    giftToast.classList.add('visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      giftToast.classList.remove('visible');
    }, duration);
  }

  function openSecretGift() {
    if (SECRET_GIFT.opened) return;
    SECRET_GIFT.opened = true;
    hoveredSecret = false;
    hoveredGiftId = -1;
    canvas.classList.remove('clickable');
    giftToast.classList.remove('visible');
    if (treePrompt) treePrompt.classList.remove('visible');
    spawnGiftBurst(SECRET_GIFT.cx, -0.1, SECRET_GIFT.cz, [255, 224, 96]);
    spawnGiftBurst(SECRET_GIFT.cx, -0.04, SECRET_GIFT.cz, [255, 110, 180]);
    if (window.SecretFinale) {
      window.SecretFinale.start();
    }
  }

  function openGift(gift) {
    const firstTime = !gift.opened;
    gift.opened = true;
    spawnGiftBurst(gift.px, -0.12, gift.pz, gift.body);

    const openedCount = GIFT_SPECS.filter((g) => g.opened).length;
    if (openedCount === GIFT_SPECS.length && !SECRET_GIFT.unlocked) {
      SECRET_GIFT.unlocked = true;
      SECRET_GIFT.appearAnim = 0;
      if (treePrompt) treePrompt.textContent = 'Abra seu presente secreto ✦';
      spawnGiftBurst(SECRET_GIFT.cx, -0.12, SECRET_GIFT.cz, [255, 224, 96]);
      showToast('✦ Todos os 7 BT21 abertos! Um presente secreto apareceu!', SECRET_GIFT.accent, 4200);
    } else {
      showToast(
        `♥ ${gift.name} (${gift.member.replace('BT21 · ', '')}) · ${openedCount}/${GIFT_SPECS.length}`,
        gift.accent,
        firstTime ? 3000 : 2200
      );
    }
  }

  canvas.addEventListener('mousemove', (e) => {
    hoveredSecret = isSecretAt(e.clientX, e.clientY);
    hoveredGiftId = hoveredSecret ? -1 : findGiftAt(e.clientX, e.clientY);
    canvas.classList.toggle('clickable', hoveredSecret || hoveredGiftId !== -1);
  });

  canvas.addEventListener('mouseleave', () => {
    hoveredGiftId = -1;
    hoveredSecret = false;
    canvas.classList.remove('clickable');
  });

  canvas.addEventListener('click', (e) => {
    if (isSecretAt(e.clientX, e.clientY)) {
      openSecretGift();
      return;
    }
    const hitId = findGiftAt(e.clientX, e.clientY);
    if (hitId !== -1) {
      openGift(GIFT_SPECS[hitId]);
    }
  });

  // --- Playback State ---
  let playing = true;
  let simTime = 0;
  let lastNow = performance.now();

  function togglePlay() {
    playing = !playing;
    btnPlayPause.textContent = playing ? 'Pause' : 'Play';
  }

  function restartLoop() {
    simTime = 0;
    giftToast.classList.remove('visible');
    GIFT_SPECS.forEach((g) => {
      g.opened = false;
      g.openAnim = 0;
    });
    SECRET_GIFT.unlocked = false;
    SECRET_GIFT.opened = false;
    SECRET_GIFT.appearAnim = 0;
    if (treePrompt) {
      treePrompt.textContent = 'Abra seus presentes';
      treePrompt.classList.remove('visible');
    }
    burstParticles.length = 0;
    if (window.SecretFinale) {
      window.SecretFinale.reset();
    }
    if (!playing) togglePlay();
  }

  btnPlayPause.addEventListener('click', togglePlay);
  btnRestart.addEventListener('click', restartLoop);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'r' || e.key === 'R') {
      restartLoop();
    }
  });

  // --- Main Render Frame ---
  function renderFrame(t, dt) {
    clearBuffers();

    // Reset gift hit boxes for this frame
    for (let i = 0; i < giftHitBoxes.length; i++) {
      const hb = giftHitBoxes[i];
      hb.visible = false;
      hb.minX = Infinity;
      hb.maxX = -Infinity;
      hb.minY = Infinity;
      hb.maxY = -Infinity;
      hb.maxZ = -Infinity;
    }

    secretHitBox.visible = false;
    secretHitBox.minX = Infinity;
    secretHitBox.maxX = -Infinity;
    secretHitBox.minY = Infinity;
    secretHitBox.maxY = -Infinity;
    secretHitBox.maxZ = -Infinity;

    // Animate opened gift lids & secret gift reveal smoothly
    for (let i = 0; i < GIFT_SPECS.length; i++) {
      const g = GIFT_SPECS[i];
      if (g.opened && g.openAnim < 1) {
        g.openAnim = Math.min(1, g.openAnim + dt * 3.2);
      }
    }
    if (SECRET_GIFT.unlocked && !SECRET_GIFT.opened && SECRET_GIFT.appearAnim < 1) {
      SECRET_GIFT.appearAnim = Math.min(1, SECRET_GIFT.appearAnim + dt * 2.2);
    }

    const rotDegTotal = (t * 29.2 + 24.5) % 360;
    const rotRad = (rotDegTotal * Math.PI) / 180;
    const cosA = Math.cos(rotRad);
    const sinA = Math.sin(rotRad);

    const pGround = ease(ramp(t, T_GROUND[0], T_GROUND[1]));
    const pTrunk = ease(ramp(t, T_TRUNK[0], T_TRUNK[1]));
    const pTree = ease(ramp(t, T_TREE[0], T_TREE[1]));
    const pLights = ramp(t, T_LIGHTS[0], T_LIGHTS[1]);
    const pOrn = ramp(t, T_ORN[0], T_ORN[1]);
    const pStar = ease(ramp(t, T_STAR[0], T_STAR[1]));
    const pGift = ramp(t, T_GIFT[0], T_GIFT[1]);

    // Show "Abra seus presentes" cleanly above the tree once the gifts appear
    if (treePrompt && !SECRET_GIFT.opened && pGift > 0.15 && !treePrompt.classList.contains('visible')) {
      treePrompt.classList.add('visible');
    }

    // 1. Ground
    if (pGround > 0.01) {
      for (let i = 0; i < N_GROUND; i++) {
        const pr = project(gndX[i], gndY[i], gndZ[i], cosA, sinA);
        if (!pr) continue;
        const sparkle = 0.76 + 0.24 * Math.sin(t * 2.0 + gndPhase[i]);
        const alpha = pGround * gndFade[i] * sparkle;
        plot(
          pr.col,
          pr.row,
          pr.z - 0.15,
          gndCh[i],
          Math.round(78 * alpha),
          Math.round(100 * alpha),
          Math.round(142 * alpha)
        );
      }
    }

    // 2. Trunk
    if (pTrunk > 0.01) {
      for (let i = 0; i < N_TRUNK; i++) {
        if (trkH[i] > pTrunk) continue;
        const pr = project(trkX[i], trkY[i], trkZ[i], cosA, sinA);
        if (!pr) continue;
        const shade = clamp(0.42 + (pr.z + 0.25) * 1.1, 0.25, 1.05);
        plot(
          pr.col,
          pr.row,
          pr.z,
          trkCh[i],
          Math.round(182 * shade),
          Math.round(108 * shade),
          Math.round(52 * shade)
        );
      }
    }

    // 3. Tree Foliage
    if (pTree > 0.005) {
      for (let i = 0; i < N_TREE; i++) {
        if (treeGrow[i] > pTree) continue;
        const pr = project(treeX[i], treeY[i], treeZ[i], cosA, sinA);
        if (!pr) continue;

        const frontLit = clamp(0.24 + (pr.z + 0.6) * 0.85 - pr.rx * 0.2, 0.12, 1.32);
        const lit = frontLit * treeShade[i];

        if (treeTip[i] && lit > 0.72) {
          const hi = clamp((lit - 0.72) * 1.6, 0, 1);
          const r = clamp(Math.round(45 + 175 * hi), 0, 255);
          const g = clamp(Math.round(205 + 50 * hi), 0, 255);
          const b = clamp(Math.round(78 + 145 * hi), 0, 255);
          plot(pr.col, pr.row, pr.z, treeCh[i], r, g, b);
        } else {
          const r = clamp(Math.round(24 * lit + 22 * Math.max(0, lit - 0.75)), 0, 255);
          const g = clamp(Math.round(192 * lit), 0, 255);
          const b = clamp(Math.round(52 * lit + 24 * Math.max(0, lit - 0.8)), 0, 255);
          plot(pr.col, pr.row, pr.z, treeCh[i], r, g, b);
        }
      }
    }

    const visibleLights = [];

    // 4. Spiral Garland Lights
    if (pLights > 0) {
      for (let i = 0; i < lightPts.length; i++) {
        const pt = lightPts[i];
        if (pt.frac > pLights) continue;
        const pr = project(pt.x, pt.y, pt.z, cosA, sinA);
        if (!pr) continue;
        const idx = pr.row * COLS + pr.col;
        const inFront = pr.z + 0.08 >= zBuf[idx];
        const tw = 0.72 + 0.28 * Math.sin(t * pt.speed + pt.phase);
        const r = clamp(Math.round(pt.color[0] * tw), 0, 255);
        const g = clamp(Math.round(pt.color[1] * tw), 0, 255);
        const b = clamp(Math.round(pt.color[2] * tw), 0, 255);
        if (inFront) {
          plot(pr.col, pr.row, pr.z + 0.08, '*', r, g, b);
          visibleLights.push({
            col: pr.col,
            row: pr.row,
            r,
            g,
            b,
            rad: cellH * 0.95,
            alpha: 0.78 * tw,
          });
        }
      }
    }

    // 5. Ornaments
    if (pOrn > 0) {
      for (let i = 0; i < ornamentPts.length; i++) {
        const pt = ornamentPts[i];
        if (pt.popAt > pOrn) continue;
        const pr = project(pt.x, pt.y, pt.z, cosA, sinA);
        if (!pr) continue;
        const idx = pr.row * COLS + pr.col;
        const inFront = pr.z + 0.1 >= zBuf[idx];
        const shade = clamp(0.75 + (pr.z + 0.5) * 0.45, 0.48, 1.1);
        const r = clamp(Math.round(pt.col[0] * shade), 0, 255);
        const g = clamp(Math.round(pt.col[1] * shade), 0, 255);
        const b = clamp(Math.round(pt.col[2] * shade), 0, 255);
        if (inFront) {
          plot(pr.col, pr.row, pr.z + 0.1, 'o', Math.min(255, r + 40), Math.min(255, g + 40), Math.min(255, b + 40));
          visibleLights.push({
            col: pr.col,
            row: pr.row,
            r,
            g,
            b,
            rad: cellH * 1.35,
            alpha: 0.9,
          });
        }
      }
    }

    // 6. Interactive Gift Boxes (disappear smoothly when opened)
    if (pGift > 0) {
      for (let i = 0; i < giftPts.length; i++) {
        const pt = giftPts[i];
        const gSpec = GIFT_SPECS[pt.giftId];
        if (gSpec.popAt > pGift) continue;
        if (gSpec.opened) continue;

        const pr = project(pt.x, pt.y, pt.z, cosA, sinA);
        if (!pr) continue;

        // Track 2D hit box for click/hover (only unopened gifts)
        const hb = giftHitBoxes[pt.giftId];
        hb.visible = true;
        if (pr.px < hb.minX) hb.minX = pr.px;
        if (pr.px > hb.maxX) hb.maxX = pr.px;
        if (pr.py < hb.minY) hb.minY = pr.py;
        if (pr.py > hb.maxY) hb.maxY = pr.py;
        if (pr.z > hb.maxZ) hb.maxZ = pr.z;

        const isHovered = hoveredGiftId === pt.giftId;
        const hoverBoost = isHovered ? 1.28 : 1.0;
        const shade = clamp(0.68 + (pr.z + 0.55) * 0.55, 0.45, 1.15) * hoverBoost;
        plot(
          pr.col,
          pr.row,
          pr.z + 0.04,
          pt.ch,
          clamp(Math.round(pt.col[0] * shade), 0, 255),
          clamp(Math.round(pt.col[1] * shade), 0, 255),
          clamp(Math.round(pt.col[2] * shade), 0, 255)
        );
      }
    }

    // 6b. Opened 3D ASCII BT21 Plushies standing right beside the tree!
    if (window.BT21Models) {
      // Key light direction (front-top-left)
      const LX = -0.35;
      const LY = 0.48;
      const LZ = 0.8;

      for (let gi = 0; gi < GIFT_SPECS.length; gi++) {
        const gSpec = GIFT_SPECS[gi];
        if (!gSpec.opened || gSpec.openAnim <= 0.01) continue;

        const pts = window.BT21Models.get(gSpec.key);
        const pop = ease(gSpec.openAnim);
        // Hop smoothly from the gift spot to right beside the tree
        const baseX = gSpec.cx + (gSpec.px - gSpec.cx) * pop;
        const baseZ = gSpec.cz + (gSpec.pz - gSpec.cz) * pop;
        const hopArc = Math.sin(pop * Math.PI) * 0.08;
        const bob = Math.sin(t * 3.2 + gi * 1.1) * 0.008;
        const scale = 0.088 * pop;
        const baseY = -0.17 + 0.088 * pop + hopArc + bob;

        // Face outward from the tree with a cute gentle sway
        const faceYaw = Math.atan2(gSpec.px, gSpec.pz) + Math.sin(t * 1.8 + gi) * 0.18;
        const cosF = Math.cos(faceYaw);
        const sinF = Math.sin(faceYaw);

        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          // Rotate plushie locally so it faces outward around the tree
          const lx = p.x * cosF + p.z * sinF;
          const lz = -p.x * sinF + p.z * cosF;
          const wx = baseX + lx * scale;
          const wy = baseY + p.y * scale;
          const wz = baseZ + lz * scale;

          const pr = project(wx, wy, wz, cosA, sinA);
          if (!pr) continue;

          let cr = p.r;
          let cg = p.g;
          let cb = p.b;
          if (!p.unlit) {
            // Rotate normal by local facing + global scene rotation
            const lnx = p.nx * cosF + p.nz * sinF;
            const lnz = -p.nx * sinF + p.nz * cosF;
            const wnx = lnx * cosA - lnz * sinA;
            const wnz = lnx * sinA + lnz * cosA;
            const diff = Math.max(0, wnx * LX + p.ny * LY + wnz * LZ);
            const rim = Math.pow(clamp(1 - Math.max(0, wnz), 0, 1), 2.2) * 0.25;
            const shade = clamp(0.38 + diff * 0.76 + rim, 0.28, 1.22);
            cr = clamp(Math.round(p.r * shade), 0, 255);
            cg = clamp(Math.round(p.g * shade), 0, 255);
            cb = clamp(Math.round(p.b * shade), 0, 255);
          }

          plot(pr.col, pr.row, pr.z + p.zBias * scale + 0.06, p.ch, cr, cg, cb);
        }
      }
    }

    // 6b2. Secret Golden Gift Box (appears after all 7 BT21 gifts are opened)
    if (SECRET_GIFT.unlocked && !SECRET_GIFT.opened && SECRET_GIFT.appearAnim > 0.01) {
      const pop = ease(SECRET_GIFT.appearAnim);
      const hoverFloat = Math.sin(t * 3.4) * 0.018;
      const spin = t * 0.7;
      const cosS = Math.cos(spin);
      const sinS = Math.sin(spin);
      const shimmer = 0.9 + 0.18 * Math.sin(t * 6.0);
      const hoverBoost = hoveredSecret ? 1.25 : 1.0;

      for (let i = 0; i < secretGiftPts.length; i++) {
        const pt = secretGiftPts[i];
        const rx = (pt.lx * cosS - pt.lz * sinS) * pop;
        const rz = (pt.lx * sinS + pt.lz * cosS) * pop;
        const wx = SECRET_GIFT.cx + rx;
        const wy = -0.14 + pt.ly * pop + hoverFloat;
        const wz = SECRET_GIFT.cz + rz;

        const pr = project(wx, wy, wz, cosA, sinA);
        if (!pr) continue;

        secretHitBox.visible = true;
        if (pr.px < secretHitBox.minX) secretHitBox.minX = pr.px;
        if (pr.px > secretHitBox.maxX) secretHitBox.maxX = pr.px;
        if (pr.py < secretHitBox.minY) secretHitBox.minY = pr.py;
        if (pr.py > secretHitBox.maxY) secretHitBox.maxY = pr.py;
        if (pr.z > secretHitBox.maxZ) secretHitBox.maxZ = pr.z;

        const baseCol = pt.isRibbon ? SECRET_GIFT.rib : SECRET_GIFT.body;
        const shade = clamp(0.75 + (pr.z + 0.55) * 0.5, 0.55, 1.25) * shimmer * hoverBoost;
        plot(
          pr.col,
          pr.row,
          pr.z + 0.08,
          pt.ch,
          clamp(Math.round(baseCol[0] * shade), 0, 255),
          clamp(Math.round(baseCol[1] * shade), 0, 255),
          clamp(Math.round(baseCol[2] * shade), 0, 255)
        );
      }

      // Add a warm golden aura around the secret gift
      const centerPr = project(SECRET_GIFT.cx, -0.06 + hoverFloat, SECRET_GIFT.cz, cosA, sinA);
      if (centerPr) {
        visibleLights.push({
          col: centerPr.col,
          row: centerPr.row,
          r: 255,
          g: 215,
          b: 90,
          rad: cellH * 3.8 * pop,
          alpha: (hoveredSecret ? 0.65 : 0.42) * shimmer,
        });
      }
    }

    // 6c. Gift Opening Sparkle Burst
    for (let i = burstParticles.length - 1; i >= 0; i--) {
      const bp = burstParticles[i];
      bp.x += bp.vx * dt;
      bp.y += bp.vy * dt;
      bp.z += bp.vz * dt;
      bp.vy -= 0.75 * dt;
      bp.life -= dt * 1.1;
      if (bp.life <= 0) {
        burstParticles.splice(i, 1);
        continue;
      }
      const pr = project(bp.x, bp.y, bp.z, cosA, sinA);
      if (!pr) continue;
      plot(
        pr.col,
        pr.row,
        pr.z + 0.25,
        bp.ch,
        Math.round(bp.col[0] * bp.life),
        Math.round(bp.col[1] * bp.life),
        Math.round(bp.col[2] * bp.life)
      );
    }

    // 7. Top Star + Crisp Rays
    if (pStar > 0.01) {
      const pr = project(0, 1.05, 0, cosA, sinA);
      if (pr) {
        const pulse = 0.86 + 0.14 * Math.sin(t * 5.2);
        const s = pStar * pulse;
        const rays = [
          [0, 0, '*', 255, 252, 200],
          [-1, 0, '-', 255, 228, 120],
          [1, 0, '-', 255, 228, 120],
          [-2, 0, '-', 255, 198, 78],
          [2, 0, '-', 255, 198, 78],
          [0, -1, '|', 255, 228, 120],
          [0, 1, '|', 255, 228, 120],
          [0, -2, '|', 255, 198, 78],
          [-1, -1, '\\', 255, 212, 92],
          [1, -1, '/', 255, 212, 92],
          [-1, 1, '/', 255, 212, 92],
          [1, 1, '\\', 255, 212, 92],
        ];
        for (const [dc, dr, ch, rr, gg, bb] of rays) {
          const cc = pr.col + dc;
          const rrRow = pr.row + dr;
          if (cc >= 0 && cc < COLS && rrRow >= 0 && rrRow < ROWS) {
            plot(cc, rrRow, pr.z + 0.5, ch, Math.round(rr * s), Math.round(gg * s), Math.round(bb * s));
          }
        }
      }
    }

    // --- Render Crisp ASCII Layer onto Offscreen Canvas ---
    crispCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    crispCtx.clearRect(0, 0, canvasW, canvasH);

    const snowFont = Math.max(8, Math.round(cellH * 0.95));
    crispCtx.font = `700 ${snowFont}px 'JetBrains Mono', monospace`;
    crispCtx.textAlign = 'center';
    crispCtx.textBaseline = 'middle';
    for (let i = 0; i < snowParticles.length; i++) {
      const sp = snowParticles[i];
      const px = (((sp.x + sp.vx * t) % 1) + 1) % 1;
      const py = (sp.y + sp.vy * t) % 1;
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * sp.twinkle + sp.phase));
      const alpha = sp.bright * tw;
      crispCtx.fillStyle = sp.isBig
        ? `rgba(235, 244, 255, ${alpha.toFixed(2)})`
        : `rgba(195, 212, 245, ${(alpha * 0.85).toFixed(2)})`;
      crispCtx.fillText(sp.ch, px * canvasW, py * canvasH);
    }

    const fontSize = Math.max(7.5, Math.min(cellH * 0.98, cellW * 1.66));
    crispCtx.font = `700 ${fontSize.toFixed(1)}px 'JetBrains Mono', monospace`;
    for (let row = 0; row < ROWS; row++) {
      const y = (row + 0.5) * cellH;
      const rowOffset = row * COLS;
      for (let col = 0; col < COLS; col++) {
        const idx = rowOffset + col;
        const ch = chBuf[idx];
        if (!ch) continue;
        crispCtx.fillStyle = `rgb(${rBuf[idx]},${gBuf[idx]},${bBuf[idx]})`;
        crispCtx.fillText(ch, (col + 0.5) * cellW, y);
      }
    }

    // --- Composite Final Frame ---
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, canvasW, canvasH);

    bloomCtx.clearRect(0, 0, bloomCanvas.width, bloomCanvas.height);
    bloomCtx.drawImage(crispCanvas, 0, 0, bloomCanvas.width, bloomCanvas.height);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55;
    ctx.filter = 'blur(8px)';
    ctx.drawImage(bloomCanvas, 0, 0, canvasW, canvasH);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.42;
    ctx.filter = 'blur(2.5px)';
    ctx.drawImage(bloomCanvas, 0, 0, canvasW, canvasH);
    ctx.restore();

    ctx.drawImage(crispCanvas, 0, 0, canvasW, canvasH);

    // Crisp luminous pinpoint + soft radial aura for each visible LED/ornament
    if (visibleLights.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < visibleLights.length; i++) {
        const L = visibleLights[i];
        const lx = (L.col + 0.5) * cellW;
        const ly = (L.row + 0.5) * cellH;
        const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, L.rad);
        grad.addColorStop(0, `rgba(255, 255, 245, ${(L.alpha * 0.85).toFixed(2)})`);
        grad.addColorStop(0.32, `rgba(${L.r}, ${L.g}, ${L.b}, ${(L.alpha * 0.65).toFixed(2)})`);
        grad.addColorStop(1, `rgba(${L.r}, ${L.g}, ${L.b}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(lx, ly, L.rad, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // If the Secret Finale is active, draw the starry couple constellation over the fading tree
    if (window.SecretFinale && window.SecretFinale.isActive()) {
      if (playing) {
        window.SecretFinale.update(dt);
      }
      window.SecretFinale.draw(ctx, canvasW, canvasH);
    }
  }

  // --- Animation Loop ---
  function tick(now) {
    const dt = Math.min((now - lastNow) / 1000, 0.1);
    lastNow = now;

    if (playing) {
      simTime += dt;
    }

    renderFrame(simTime, dt);
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();
