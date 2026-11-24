(() => {
  'use strict';

  const WORD = 'EUTEAMO';

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

  function createCollector(seed = 11) {
    const rng = mulberry32(seed);
    const pts = [];

    function pushPt(x, y, z, nx, ny, nz, col, zBias = 0, unlit = false, forceCh = null) {
      const len = Math.hypot(nx, ny, nz) || 1;
      pts.push({
        x,
        y,
        z,
        nx: nx / len,
        ny: ny / len,
        nz: nz / len,
        r: col[0],
        g: col[1],
        b: col[2],
        zBias,
        unlit,
        ch: forceCh || WORD[Math.floor(rng() * WORD.length)],
      });
    }

    function ellipsoid(cx, cy, cz, rx, ry, rz, col, count, rotZ = 0, rotX = 0, zBias = 0, unlit = false, forceCh = null) {
      const cosZ = Math.cos(rotZ);
      const sinZ = Math.sin(rotZ);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const golden = Math.PI * (3 - Math.sqrt(5));

      for (let i = 0; i < count; i++) {
        const yy = 1 - ((i + 0.5) / count) * 2;
        const rad = Math.sqrt(Math.max(0, 1 - yy * yy));
        const theta = golden * i + (rng() - 0.5) * 0.14;
        const ux = Math.cos(theta) * rad;
        const uy = yy;
        const uz = Math.sin(theta) * rad;

        let lx = ux * rx;
        let ly = uy * ry;
        let lz = uz * rz;
        let nx = ux / rx;
        let ny = uy / ry;
        let nz = uz / rz;

        if (rotZ !== 0) {
          const tx = lx * cosZ - ly * sinZ;
          const ty = lx * sinZ + ly * cosZ;
          lx = tx;
          ly = ty;
          const tnx = nx * cosZ - ny * sinZ;
          const tny = nx * sinZ + ny * cosZ;
          nx = tnx;
          ny = tny;
        }
        if (rotX !== 0) {
          const ty = ly * cosX - lz * sinX;
          const tz = ly * sinX + lz * cosX;
          ly = ty;
          lz = tz;
          const tny = ny * cosX - nz * sinX;
          const tnz = ny * sinX + nz * cosX;
          ny = tny;
          nz = tnz;
        }

        pushPt(cx + lx, cy + ly, cz + lz, nx, ny, nz, col, zBias, unlit, forceCh);
      }
    }

    function cylinder(cx, cy, cz, rx, h, rz, col, count, rotZ = 0, zBias = 0, unlit = false, forceCh = null) {
      const cosZ = Math.cos(rotZ);
      const sinZ = Math.sin(rotZ);
      for (let i = 0; i < count; i++) {
        const a = rng() * Math.PI * 2;
        const ly = (rng() - 0.5) * h;
        const lx = Math.cos(a) * rx;
        const lz = Math.sin(a) * rz;
        let wx = lx;
        let wy = ly;
        let nx = Math.cos(a);
        let ny = 0;
        if (rotZ !== 0) {
          wx = lx * cosZ - ly * sinZ;
          wy = lx * sinZ + ly * cosZ;
          nx = Math.cos(a) * cosZ;
          ny = Math.cos(a) * sinZ;
        }
        pushPt(cx + wx, cy + wy, cz + lz, nx, ny, Math.sin(a), col, zBias, unlit, forceCh);
      }
    }

    function heart3D(cx, cy, cz, scale, depthScale, col, count) {
      for (let i = 0; i < count; i++) {
        const t = rng() * Math.PI * 2;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        const f = Math.pow(rng(), 0.42);
        const px = (hx / 17) * scale * f;
        const py = ((hy + 2.2) / 17) * scale * f;
        const dome = Math.sqrt(Math.max(0.01, 1 - f * f));
        const side = rng() < 0.5 ? 1 : -1;
        const pz = side * dome * depthScale;
        pushPt(cx + px, cy + py, cz + pz, (hx / 17) * f, ((hy + 2.2) / 17) * f, side * (0.4 + dome * 1.2), col, 0, false);
      }
    }

    function smileArc(cx, cy, cz, rx, ry, col, count, startA = Math.PI * 0.15, endA = Math.PI * 0.85, zBias = 0.04) {
      for (let i = 0; i < count; i++) {
        const a = startA + (i / Math.max(1, count - 1)) * (endA - startA);
        const x = cx + Math.cos(a) * rx;
        const y = cy - Math.sin(a) * ry;
        const z = cz + Math.sin(a) * 0.02;
        pushPt(x, y, z, 0, 0, 1, col, zBias, true, 'o');
      }
    }

    function sittingBody(bodyCol, bellyCol, footCol = bodyCol) {
      ellipsoid(0, -0.58, 0, 0.46, 0.44, 0.4, bodyCol, 1200);
      ellipsoid(-0.27, -0.46, 0.28, 0.18, 0.14, 0.17, bodyCol, 280, -0.35);
      ellipsoid(0.27, -0.46, 0.28, 0.18, 0.14, 0.17, bodyCol, 280, 0.35);
      ellipsoid(-0.29, -0.88, 0.22, 0.2, 0.15, 0.23, footCol, 300, 0, 0.18);
      ellipsoid(0.29, -0.88, 0.22, 0.2, 0.15, 0.23, footCol, 300, 0, 0.18);
      if (bellyCol) {
        ellipsoid(0, -0.55, 0.28, 0.24, 0.22, 0.17, bellyCol, 320, 0, 0, 0.015);
      }
    }

    function eyes(y, z, sep = 0.22, size = 0.095) {
      const dark = [14, 16, 24];
      const white = [255, 255, 255];
      ellipsoid(-sep, y, z, size, size, size * 0.55, dark, 150, 0, 0, 0.045, true, '@');
      ellipsoid(sep, y, z, size, size, size * 0.55, dark, 150, 0, 0, 0.045, true, '@');
      pushPt(-sep + size * 0.3, y + size * 0.28, z + size * 0.5, 0, 0, 1, white, 0.07, true, '*');
      pushPt(sep + size * 0.3, y + size * 0.28, z + size * 0.5, 0, 0, 1, white, 0.07, true, '*');
    }

    function cheeks(col, y, z, sep = 0.42, size = 0.14) {
      ellipsoid(-sep, y, z, size, size * 0.85, size * 0.38, col, 170, 0, 0, 0.025);
      ellipsoid(sep, y, z, size, size * 0.85, size * 0.38, col, 170, 0, 0, 0.025);
    }

    return { pts, ellipsoid, cylinder, heart3D, smileArc, sittingBody, eyes, cheeks };
  }

  function buildTata() {
    const c = createCollector(101);
    c.heart3D(0, 0.44, 0, 0.86, 0.48, [255, 60, 78], 3200);
    c.cylinder(-0.2, 0.62, 0.42, 0.035, 0.16, 0.035, [16, 16, 22], 60, Math.PI / 2 - 0.1, 0.05, true);
    c.cylinder(0.2, 0.62, 0.42, 0.035, 0.16, 0.035, [16, 16, 22], 60, Math.PI / 2 + 0.1, 0.05, true);
    c.eyes(0.46, 0.42, 0.19, 0.09);
    c.cheeks([220, 28, 58], 0.32, 0.4, 0.42, 0.13);
    c.ellipsoid(0, 0.3, 0.45, 0.18, 0.115, 0.08, [255, 218, 52], 220, 0, 0, 0.05);
    c.cylinder(0, 0.3, 0.51, 0.024, 0.14, 0.024, [20, 18, 16], 45, Math.PI / 2, 0.07, true);
    c.cylinder(0, -0.14, 0.02, 0.34, 0.15, 0.32, [255, 244, 206], 340);
    c.sittingBody([182, 146, 248], null);
    return c.pts;
  }

  function buildKoya() {
    const c = createCollector(102);
    const blue = [110, 202, 255];
    const pale = [216, 242, 255];
    c.ellipsoid(0, 0.38, 0, 0.74, 0.64, 0.62, blue, 2600);
    c.ellipsoid(0, 1.04, 0, 0.17, 0.19, 0.15, blue, 220, -0.15);
    c.ellipsoid(-0.78, 0.62, -0.04, 0.34, 0.32, 0.19, blue, 580, 0.3);
    c.ellipsoid(-0.76, 0.61, 0.06, 0.2, 0.18, 0.1, pale, 200, 0.3, 0, 0.015);
    c.ellipsoid(0.78, 0.62, -0.04, 0.34, 0.32, 0.19, blue, 580, -0.3);
    c.ellipsoid(0.76, 0.61, 0.06, 0.2, 0.18, 0.1, pale, 200, -0.3, 0, 0.015);
    c.eyes(0.4, 0.58, 0.24, 0.088);
    c.ellipsoid(0, 0.36, 0.62, 0.135, 0.165, 0.095, [150, 82, 252], 230, 0, 0, 0.05);
    c.smileArc(0, 0.22, 0.6, 0.095, 0.068, [18, 18, 26], 34);
    c.cheeks([255, 86, 165], 0.24, 0.55, 0.44, 0.14);
    c.sittingBody(blue, [172, 224, 255]);
    return c.pts;
  }

  function buildChimmy() {
    const c = createCollector(103);
    const yellow = [255, 220, 68];
    const white = [255, 250, 240];
    const dark = [38, 38, 48];
    c.ellipsoid(0, 0.38, -0.03, 0.74, 0.68, 0.65, yellow, 2500);
    c.ellipsoid(0, 0.33, 0.24, 0.57, 0.51, 0.44, white, 1600, 0, 0, 0.015);
    c.ellipsoid(-0.77, 0.25, 0.02, 0.22, 0.44, 0.2, dark, 560, 0.28);
    c.ellipsoid(0.77, 0.25, 0.02, 0.22, 0.44, 0.2, dark, 560, -0.28);
    c.eyes(0.35, 0.64, 0.19, 0.086);
    c.ellipsoid(0, 0.26, 0.67, 0.082, 0.062, 0.05, [18, 18, 24], 110, 0, 0, 0.06, true);
    c.smileArc(0, 0.2, 0.64, 0.115, 0.078, [18, 18, 24], 40);
    c.cheeks([255, 118, 165], 0.22, 0.6, 0.35, 0.13);
    c.sittingBody(yellow, white);
    c.ellipsoid(0, -0.66, 0.44, 0.072, 0.072, 0.05, [248, 54, 70], 100, 0, 0, 0.05);
    return c.pts;
  }

  function buildCooky() {
    const c = createCollector(104);
    const pink = [255, 164, 200];
    const pale = [255, 226, 238];
    const bow = [255, 82, 156];
    c.ellipsoid(0, 0.32, 0, 0.72, 0.64, 0.62, pink, 2600);
    c.ellipsoid(-0.34, 1.04, 0, 0.24, 0.46, 0.17, pink, 680, 0.18);
    c.ellipsoid(-0.34, 1.02, 0.08, 0.13, 0.31, 0.09, pale, 220, 0.18, 0, 0.015);
    c.ellipsoid(0.33, 0.94, 0.03, 0.24, 0.26, 0.17, pink, 480, -0.35, 0.25);
    c.ellipsoid(0.24, 0.96, 0.17, 0.16, 0.1, 0.095, bow, 220, 0.25, 0, 0.04);
    c.eyes(0.35, 0.59, 0.2, 0.086);
    c.ellipsoid(0, 0.26, 0.63, 0.074, 0.056, 0.045, [18, 18, 26], 100, 0, 0, 0.06, true);
    c.smileArc(-0.06, 0.21, 0.61, 0.064, 0.054, [18, 18, 26], 26);
    c.smileArc(0.06, 0.21, 0.61, 0.064, 0.054, [18, 18, 26], 26);
    c.cheeks([255, 86, 150], 0.22, 0.55, 0.4, 0.13);
    c.sittingBody(pink, pale);
    return c.pts;
  }

  function buildRJ() {
    const c = createCollector(105);
    const white = [245, 248, 255];
    const brown = [148, 88, 52];
    c.ellipsoid(0, 0.36, 0, 0.66, 0.6, 0.6, white, 2100);
    c.ellipsoid(-0.36, 0.74, -0.04, 0.3, 0.28, 0.24, white, 440);
    c.ellipsoid(0.36, 0.74, -0.04, 0.3, 0.28, 0.24, white, 440);
    c.ellipsoid(0, 0.82, 0, 0.34, 0.25, 0.26, white, 440);
    c.ellipsoid(-0.52, 0.28, 0, 0.28, 0.26, 0.26, white, 380);
    c.ellipsoid(0.52, 0.28, 0, 0.28, 0.26, 0.26, white, 380);
    c.eyes(0.42, 0.57, 0.18, 0.082);
    c.ellipsoid(0, 0.32, 0.61, 0.07, 0.054, 0.045, [18, 18, 26], 100, 0, 0, 0.06, true);
    c.smileArc(-0.055, 0.26, 0.59, 0.058, 0.05, [18, 18, 26], 24);
    c.smileArc(0.055, 0.26, 0.59, 0.058, 0.05, [18, 18, 26], 24);
    c.cheeks([255, 108, 160], 0.28, 0.55, 0.38, 0.125);
    c.cylinder(0, -0.14, 0.02, 0.34, 0.14, 0.32, [255, 134, 54], 360);
    c.ellipsoid(-0.1, -0.24, 0.34, 0.13, 0.095, 0.09, brown, 160, 0.3, 0, 0.03);
    c.ellipsoid(0.1, -0.24, 0.34, 0.13, 0.095, 0.09, brown, 160, -0.3, 0, 0.03);
    c.sittingBody(white, null, brown);
    return c.pts;
  }

  function buildShooky() {
    const c = createCollector(106);
    const cookie = [218, 138, 68];
    const dark = [114, 60, 28];
    c.ellipsoid(0, 0.06, 0, 0.9, 0.78, 0.66, cookie, 3600);
    c.ellipsoid(0.05, 0.88, 0, 0.19, 0.17, 0.15, cookie, 260, -0.35);
    c.ellipsoid(-0.86, -0.16, 0.08, 0.19, 0.28, 0.18, dark, 380, -0.35);
    c.ellipsoid(0.86, -0.16, 0.08, 0.19, 0.28, 0.18, dark, 380, 0.35);
    c.ellipsoid(-0.34, -0.7, 0.18, 0.24, 0.16, 0.26, dark, 380);
    c.ellipsoid(0.34, -0.7, 0.18, 0.24, 0.16, 0.26, dark, 380);
    c.cylinder(-0.28, 0.34, 0.6, 0.04, 0.2, 0.04, [18, 14, 12], 60, Math.PI / 2 - 0.18, 0.05, true);
    c.cylinder(0.28, 0.34, 0.6, 0.04, 0.2, 0.04, [18, 14, 12], 60, Math.PI / 2 + 0.18, 0.05, true);
    c.eyes(0.16, 0.62, 0.27, 0.105);
    c.cylinder(0, -0.06, 0.65, 0.038, 0.46, 0.038, [18, 14, 12], 80, Math.PI / 2, 0.06, true);
    c.ellipsoid(0, -0.15, 0.61, 0.19, 0.14, 0.08, [18, 14, 12], 170, 0, 0, 0.05, true);
    c.ellipsoid(0, -0.12, 0.67, 0.105, 0.085, 0.045, [255, 255, 255], 120, 0, 0, 0.08, true);
    return c.pts;
  }

  function buildMang() {
    const c = createCollector(107);
    const blue = [126, 202, 255];
    const purple = [174, 130, 248];
    const pink = [255, 124, 180];
    c.ellipsoid(-0.06, 0.38, 0, 0.68, 0.62, 0.62, blue, 2400);
    c.ellipsoid(0.38, 0.32, 0.32, 0.33, 0.36, 0.28, pink, 980, -0.1, 0, 0.02);
    c.ellipsoid(0.45, 0.38, 0.56, 0.042, 0.064, 0.035, [205, 58, 122], 50, 0, 0, 0.055, true);
    c.ellipsoid(0.57, 0.35, 0.5, 0.042, 0.064, 0.035, [205, 58, 122], 50, 0, 0, 0.055, true);
    c.ellipsoid(-0.22, 0.96, -0.06, 0.18, 0.22, 0.18, purple, 260, 0.35);
    c.ellipsoid(-0.58, 0.68, -0.14, 0.19, 0.26, 0.18, purple, 280, 0.65);
    c.ellipsoid(-0.66, 0.18, -0.12, 0.13, 0.36, 0.15, purple, 280, 0.22);
    c.ellipsoid(-0.52, 0.72, 0.08, 0.18, 0.26, 0.14, blue, 260, 0.65);
    c.eyes(0.42, 0.56, 0.26, 0.082);
    c.cylinder(0, -0.14, 0.02, 0.34, 0.14, 0.32, [118, 234, 248], 340);
    c.sittingBody(purple, null);
    return c.pts;
  }

  const BUILDERS = {
    tata: buildTata,
    koya: buildKoya,
    chimmy: buildChimmy,
    cooky: buildCooky,
    rj: buildRJ,
    shooky: buildShooky,
    mang: buildMang,
  };

  const CACHE = {};
  window.BT21Models = {
    get(key) {
      if (!CACHE[key] && BUILDERS[key]) {
        CACHE[key] = BUILDERS[key]();
      }
      return CACHE[key] || [];
    },
  };
})();
