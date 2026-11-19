'use strict';
/* =========================================================
 * util.js — constants & helpers shared by every module
 * ========================================================= */

// Internal (native) resolution. The canvas is upscaled with
// nearest-neighbour by CSS, exactly like an arcade monitor.
const W = 640, H = 480;
const PLAYER_BASE = H - 8;   // tyre contact on the chase camera's ground plane

// World
const SEG = 200;            // length of a road segment (world units)
const DRAW_DIST = 300;      // number of segments drawn ahead
const FOV = 100;
const CAM_H = 1000;
const CAM_DEPTH = 1 / Math.tan((FOV / 2) * Math.PI / 180);
const PLAYER_Z = CAM_H * CAM_DEPTH;
const STEP = 1 / 60;

const U = {
  limit: (v, a, b) => Math.max(a, Math.min(v, b)),
  lerp: (a, b, t) => a + (b - a) * t,
  easeIn: (a, b, t) => a + (b - a) * t * t,
  easeInOut: (a, b, t) => a + (b - a) * ((-Math.cos(t * Math.PI) / 2) + 0.5),
  percentRemaining: (n, total) => (n % total) / total,
  accelerate: (v, a, dt) => v + a * dt,
  shuffled(items, random) {
    const order = items.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  },
  overlap(x1, w1, x2, w2, percent) {
    const half = (percent || 1) / 2;
    const min1 = x1 - w1 * half, max1 = x1 + w1 * half;
    const min2 = x2 - w2 * half, max2 = x2 + w2 * half;
    return !(max1 < min2 || min1 > max2);
  },
  mixColor(a, b, t) { // '#rrggbb' mix
    const pa = U.hex(a), pb = U.hex(b);
    const r = Math.round(U.lerp(pa[0], pb[0], t)), g = Math.round(U.lerp(pa[1], pb[1], t)), bl = Math.round(U.lerp(pa[2], pb[2], t));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  },
  hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; },
  rgba(c, a) { const p = U.hex(c); return `rgba(${p[0]},${p[1]},${p[2]},${a})`; },
};

// Deterministic RNG so the track / art are identical on every run
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Project a world point to screen (classic pseudo-3D projection, no 3D API)
function project(p, camX, camY, camZ, horizon, halfWidth, screenWidth = W) {
  p.camera.x = (p.world.x || 0) - camX;
  p.camera.y = (p.world.y || 0) - camY;
  p.camera.z = (p.world.z || 0) - camZ;
  p.screen.scale = CAM_DEPTH / p.camera.z;
  p.screen.x = screenWidth / 2 + p.screen.scale * p.camera.x * W / 2;
  p.screen.y = horizon - p.screen.scale * p.camera.y * (PLAYER_BASE - horizon);
  p.screen.w = p.screen.scale * halfWidth * W / 2;
}
