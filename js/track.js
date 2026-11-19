'use strict';
/* =========================================================
 * track.js — the rally route: 4 zones, curves, hills,
 * roadside scenery placement and the rival grid.
 * ========================================================= */

const ZONES = [
  { id: 'motel',
    horizon: 222, panoramaWidth: 750, panoramaFill: [112, 470], roadWidth: 1880, tileSegments: 19, groundBands: ['#24235b', '#343878'], pavementBands: ['#625673', '#766887'],
    verge: ['#554856', '#655569'], vergeW: 1.26,
    fog: '#9867c6' },
  { id: 'swamp',
    horizon: 154, panoramaWidth: 850, roadWidth: 1570, tileSegments: 16, groundBands: ['#205742', '#347859'],
    verge: ['#344033', '#45513c'], vergeW: 1.24,
    fog: '#7766ac' },
  { id: 'carnival',
    horizon: 211, panoramaWidth: 750, panoramaFill: [603, 807], roadWidth: 1730, tileSegments: 15, groundBands: ['#402240', '#583052'],
    verge: ['#53353d', '#67464a'], vergeW: 1.24,
    fog: '#b76aaf' },
  { id: 'cemetery',
    horizon: 199, panoramaWidth: 830, panoramaFill: [101, 458], roadWidth: 1400, tileSegments: 14, groundBands: ['#59466f', '#6b5985'],
    verge: ['#51475b', '#64556a'], vergeW: 1.24,
    fog: '#ab92d0', fogK: 1.12 },
];

const RIVAL_SPEEDS = [0.88, 0.87, 0.86, 0.85, 0.835, 0.82, 0.805];
const SLALOM_HALF = 0.46; // distance from the gate centre to either lantern, in road half-widths
function rivalGrid(players, random = Math.random) {
  if (!Array.isArray(players)) players = [players];
  const eligible = Object.keys(VEHICLES).filter(id => !players.includes(id));
  const entrants = U.shuffled(eligible, random).slice(0, 8 - players.length);
  return entrants.sort((a, b) => VEHICLES[b].stats.accel - VEHICLES[a].stats.accel)
    .map((vehicle, i) => ({ vehicle, name: I18n.copy.vehicles[vehicle].label, speed: RIVAL_SPEEDS[i] }));
}

const Track = {
  segments: [],
  zoneStart: [],
  landmarks: [],   // camera approaches on the actual course, also used by the art preview
  trials: [],
  finishSeg: 0,
  length: 0,

  find(z) {
    const i = Math.max(0, Math.min(this.segments.length - 1, Math.floor(z / SEG)));
    return this.segments[i];
  },

  build() {
    const segs = this.segments = [];
    let zone = 0, endWidth = ZONES[0].roadWidth;
    const lastY = () => segs.length ? segs[segs.length - 1].p2.world.y : 0;
    const addSegment = (curve, y, halfWidth) => {
      const n = segs.length;
      segs.push({
        index: n, zone, curve, halfWidth, sprites: [], cars: [], clip: 0,
        p1: { world: { y: lastY(), z: n * SEG }, camera: {}, screen: {} },
        p2: { world: { y, z: (n + 1) * SEG }, camera: {}, screen: {} },
      });
    };
    // A bend ends at a chosen elevation and width. Shoulders, scenery and
    // collision space follow the same width through to the next bend.
    const road = (enter, hold, leave, curve, height, width = 1) => {
      const startY = lastY(), endY = startY + height * SEG, total = enter + hold + leave;
      const startWidth = endWidth;
      endWidth = ZONES[zone].roadWidth * width;
      const next = (n, bend) => addSegment(bend,
        U.easeInOut(startY, endY, (n + 1) / total), U.easeInOut(startWidth, endWidth, n / total));
      for (let n = 0; n < enter; n++) next(n, U.easeIn(0, curve, n / enter));
      for (let n = 0; n < hold; n++) next(enter + n, curve);
      for (let n = 0; n < leave; n++) next(enter + hold + n, U.easeInOut(curve, 0, (n + 1) / leave));
    };

    // ---------------- ZONE 0 : HAUNTED MOTEL (coast road) ----------------
    this.zoneStart[0] = 0;
    road(12, 36, 22, 0.65, 5, 1.10);
    this.landmarks[0] = segs.length + 6;
    road(9, 32, 11, 5.0, 3, 0.97);
    road(10, 29, 13, -5.8, -6, 0.89);
    // Two long climbs to the headlands, with the forecourts down in the coves.
    road(19, 52, 27, 1.8, 25, 0.98);
    road(38, 89, 23, -1.9, 24, 0.91);
    road(13, 48, 29, -4.8, -23, 0.82);
    road(31, 107, 49, 1.3, -32, 1.10);
    road(27, 66, 54, -3.8, 31, 0.99);
    road(18, 38, 24, 2.7, -13, 0.91);
    road(47, 111, 28, 2.4, 31, 0.85);
    road(16, 44, 37, -5.4, -26, 0.83);
    road(50, 123, 43, -1.2, -29, 1.12);
    road(22, 68, 48, -3.0, 19, 1.03);
    road(52, 93, 56, 1.9, -20, 0.96);
    road(22, 30, 34, -1.1, 6, 0.91);

    // ---------------- ZONE 1 : TOXIC SWAMP ----------------
    zone = 1; this.zoneStart[1] = segs.length;
    road(24, 54, 42, 1.2, -8, 1.02);
    this.landmarks[1] = segs.length + 3;
    // Short levees lift the causeway above the pools between the docks.
    road(4, 13, 5, -6.8, 2, 0.89);
    road(5, 25, 10, 7.1, 4, 0.86);
    road(8, 20, 15, -4.1, -5, 0.94);
    road(17, 44, 23, 2.8, 16, 0.82);
    road(32, 82, 49, -1.4, -23, 1.12);
    road(12, 55, 18, -5.1, 14, 0.84);
    road(26, 104, 44, 1.7, -17, 0.94);
    road(17, 36, 28, 5.8, 19, 0.80);
    road(44, 82, 31, -2.9, -25, 1.03);
    road(21, 70, 40, -3.6, 15, 0.86);
    road(13, 43, 22, 4.9, 9, 0.80);
    road(51, 83, 34, 1.1, -23, 1.08);
    road(25, 89, 42, -2.6, 18, 0.90);

    // ---------------- ZONE 2 : CREEPY CARNIVAL ----------------
    zone = 2; this.zoneStart[2] = segs.length;
    road(17, 78, 55, -0.7, 16, 0.97);
    this.landmarks[2] = segs.length + 3;
    // The midway rolls over broad wooden ramps then drops into the service alleys.
    road(9, 25, 13, 3.4, -4, 0.90);
    road(15, 37, 18, -2.8, 9, 1.16);
    road(16, 31, 15, 2.0, -9, 0.90);
    road(26, 89, 19, -0.8, 26, 1.12);
    road(13, 39, 22, -5.5, -19, 0.83);
    road(27, 78, 42, 2.0, 30, 0.96);
    road(24, 45, 15, 5.0, -24, 0.85);
    road(51, 104, 38, -1.5, -12, 1.16);
    road(24, 68, 28, -3.6, 30, 0.91);
    road(43, 91, 39, 0.9, -32, 1.13);
    road(17, 33, 25, 5.4, 17, 0.83);
    road(39, 89, 56, -2.7, -20, 1.00);
    road(31, 78, 46, 1.6, 15, 0.92);
    road(19, 60, 27, -1.1, -14, 1.02);

    // ---------------- ZONE 3 : GIANT GRAVEYARD ----------------
    zone = 3; this.zoneStart[3] = segs.length;
    road(31, 58, 41, 0.6, 11, 0.98);
    road(26, 74, 48, -3.4, 31, 0.91);
    road(15, 38, 25, 4.8, -18, 0.84);
    road(42, 90, 36, 1.7, 36, 1.07);
    road(18, 51, 36, -5.2, 29, 0.84);
    road(40, 89, 47, 2.6, -30, 0.96);
    road(20, 40, 29, 5.4, 25, 0.89);
    road(55, 95, 45, -1.8, 38, 1.06);
    road(35, 70, 29, 3.5, -20, 0.89);
    road(23, 64, 41, -3.2, 35, 0.92);
    const crest = segs.length, crestY = lastY();
    this.landmarks[3] = crest + 16;
    road(9, 27, 11, 5.4, 0, 0.98);
    road(7, 29, 12, -7.2, 0, 0.85);
    road(10, 41, 14, 6.2, 0, 0.94);
    // One continuous valley under all three bends, with no flat shelf
    // between corners that could hide the road on the opposite hillside.
    const valleyLength = segs.length - crest;
    const elevation = n => crestY - 32 * SEG * Math.sin(Math.PI * n / valleyLength) ** 2;
    for (let n = 0; n < valleyLength; n++) {
      segs[crest + n].p1.world.y = elevation(n);
      segs[crest + n].p2.world.y = elevation(n + 1);
    }
    road(24, 86, 25, -1.0, 23, 1.12);
    this.finishSeg = segs.length - 60;
    road(0, 450, 0, 0, 0); // run-off after the finish line
    this.zoneStart[4] = segs.length;
    this.length = segs.length * SEG;

    this.placeScenery();
    this.placeTrials();
    this.placePotions();
  },

  placePotions() {
    // Distances from the zone entrance and lane offsets in road half-widths.
    const positions = [
      [[240, 0], [900, -0.5], [1500, 0.5]],
      [[215, 0.5], [800, -0.5], [1290, 0]],
      [[220, -0.5], [608, 0.5], [1310, 0]],
      [[200, 0.5], [760, 0], [1210, -0.5]],
    ];
    positions.forEach((placements, zone) => {
      for (const [distance, offset] of placements) {
        this.add(this.zoneStart[zone] + distance, 'turbo_potion', offset);
      }
    });
  },

  placeTrials() {
    const swamp = this.zoneStart[1], carnival = this.zoneStart[2], finish = this.finishSeg;
    this.trials = [
      { kind: 'slalom', bonus: 3, gates: [
        { seg: 560, x: -0.44 }, { seg: 700, x: 0.46 }, { seg: 850, x: -0.34 },
      ] },
      { kind: 'clean', bonus: 4, gates: [{ seg: swamp + 405 }, { seg: swamp + 735 }] },
      { kind: 'radar', bonus: 4, kmh: 310, gates: [{ seg: carnival + 700 }] },
      { kind: 'sprint', bonus: 5, limit: 9.5, gates: [{ seg: finish - 615 }, { seg: finish - 155 }] },
    ];
    for (const trial of this.trials) {
      const marker = trial.kind === 'radar' ? 'speed_camera' : 'trial_lantern';
      const half = trial.kind === 'slalom' ? SLALOM_HALF : 1.02;
      for (const gate of trial.gates) {
        this.add(gate.seg, marker, (gate.x ?? 0) - half);
        this.add(gate.seg, marker, (gate.x ?? 0) + half, { flip: true });
      }
    }
  },

  add(n, name, offset, opts = {}) {
    const s = this.segments[n];
    const def = SPRITES[name];
    if (!s || !def) return;
    const anchor = def.anchor != null ? (opts.flip ? 1 - def.anchor : def.anchor) : def.center ? 0.5 : offset < 0 ? 1 : 0;
    s.sprites.push({ name, offset, flip: !!opts.flip, w: def.w * (opts.scale || 1), anchor, hit: def.hit });
  },

  // A building or railing follows the roadside in depth. Every strip shares
  // its segment's projection, occlusion and collision footprint.
  frontage(start, length, name, offset, height, cropTop = 0) {
    for (let i = 0; i < length; i++) {
      this.segments[start + i].sprites.unshift({
        name, offset, w: 420, anchor: offset < 0 ? 1 : 0, hit: [0.5, 1],
        frontage: { from: i / length, to: (i + 1) / length, height, cropTop },
      });
    }
  },

  placeScenery() {
    const r = mulberry32(42);
    const pick = a => a[Math.floor(r() * a.length)];
    const side = () => (r() < 0.5 ? -1 : 1);
    const Z = this.zoneStart;
    // Each stop is measured from its zone entrance. Leave a sightline only on
    // its own bank so trees, tents and fence posts don't stand in front of it.
    const leftBank = new Set(), rightBank = new Set();
    const site = (zone, name, positions) => {
      for (const [distance, offset, scale = 1] of positions) {
        const at = Z[zone] + distance, bank = offset < 0 ? leftBank : rightBank;
        this.add(at, name, offset, { scale, flip: offset < 0 });
        for (let n = at - 15; n <= at + 5; n++) bank.add(n);
      }
    };
    site(0, 'gas_pump', [
      [42, -1.26], [268, -1.16], [276, -1.28], [570, -1.16],
      [962, -1.28], [1130, -1.16], [1138, -1.29], [1672, -1.23],
    ]);
    site(0, 'lighthouse', [[119, 2.55, 0.88], [773, 2.48], [1532, 2.19, 0.90]]);
    site(1, 'stilt_shack', [[73, -1.52, 0.78], [273, 1.54], [524, -1.48], [929, 1.64, 0.87], [1281, -1.44]]);
    site(1, 'ghost_skiff', [
      [157, 1.43, 0.84], [262, 1.23], [539, -1.24, 0.92], [746, 1.36],
      [1113, -1.38, 0.85], [1293, -1.24], [1434, 1.34],
    ]);
    site(2, 'fortune_wagon', [[62, 1.34, 0.89], [319, -1.30], [656, 1.35], [1051, -1.35, 0.92], [1460, 1.32]]);
    site(2, 'high_striker', [[196, -1.27], [330, 1.20], [536, -1.22, 0.90], [842, 1.20], [1247, -1.18], [1471, -1.24]]);
    site(3, 'mausoleum', [[78, 1.43, 0.87], [346, -1.40], [651, 1.47], [995, -1.46, 0.94], [1305, 1.67]]);
    site(3, 'stone_angel', [
      [60, -1.25], [351, 1.22], [558, -1.26, 0.88], [642, 1.21],
      [905, -1.25], [1147, 1.32], [1399, -1.47], [1511, 1.21],
    ]);

    const add = (n, name, offset, opts) => {
      if ((offset < 0 && leftBank.has(n)) || (offset > 0 && rightBank.has(n))) return;
      if (!this.landmarks.some(at => n >= at - 4 && n <= at + 94)) this.add(n, name, offset, opts);
    };

    // ============ MOTEL ============
    add(15, 'arch_start', 0);
    const motels = [Z[0] + 560, Z[0] + 1120];
    const busyLeft = n => motels.some(m => n > m - 14 && n < m + 60);
    motels.forEach((m, i) => {
      add(m, 'motel_sign', -1.16);
      this.frontage(m - 4, 31, i % 2 ? 'motel_1' : 'motel_0', -1.44, 2630);
      this.frontage(m + 28, 24, i % 2 ? 'motel_0' : 'motel_1', -1.40, 2320);
      add(m + 4, 'lamp', -1.12);
      add(m + 30, 'lamp', -1.12);
    });
    for (let n = Z[0] + 18; n < Z[1] - 8; n += 6 + Math.floor(r() * 6)) {
      if (!busyLeft(n)) {
        const bluff = Math.floor(n / 135) % 3 === 1;
        const plant = bluff ? pick(['bush_0', 'bush_1', 'bush_2', 'palm_1']) : pick(['palm_0', 'palm_1', 'palm_2']);
        add(n, plant, -1.25 - r() * 1.3, { flip: r() < 0.5 });
      }
    }
    for (let n = Z[0] + 22; n < Z[1] - 8; n += 7 + Math.floor(r() * 8)) {
      if (r() < 0.6) add(n, 'rock', 1.14 + r() * 0.4, { scale: 0.54 + r() * 0.5 });
      if (!busyLeft(n) && r() < 0.5) add(n + 2, pick(['bush_0', 'bush_2']), -1.2 - r() * 0.6);
    }
    for (let n = Z[0] + 60; n < Z[1] - 8; n += 30 + Math.floor(r() * 30)) add(n, 'rock', 2.2 + r() * 1.5);
    for (let n = Z[0] + 30; n < Z[1] - 8; n += 32) add(n, 'lamp', -1.12);

    // ============ SWAMP ============
    add(Z[1], 'arch_swamp', 0);
    for (let n = Z[1] + 6; n < Z[2] - 6; n += 7 + Math.floor(r() * 6)) {
      const s = side();
      add(n, pick(['swamp_tree_0', 'swamp_tree_1', 'swamp_tree_2']), s * (r() < 0.35 ? 1.65 + r() * 0.3 : 2.1 + r() * 2.6), { flip: s > 0 });
    }
    for (let n = Z[1] + 10; n < Z[2] - 6; n += 7 + Math.floor(r() * 8)) add(n, 'mushrooms', side() * (1.1 + r() * 0.25));
    for (let n = Z[1] + 8; n < Z[2] - 6; n += 5 + Math.floor(r() * 6)) add(n, 'reeds', side() * (1.15 + r() * 0.9), { flip: r() < 0.5 });
    for (let n = Z[1] + 30; n < Z[2] - 6; n += 26 + Math.floor(r() * 30)) { const s = side(); add(n, 'gator', s * (1.5 + r() * 1.2), { flip: s < 0 }); }
    for (let n = Z[1] + 20; n < Z[2] - 6; n += 22 + Math.floor(r() * 20)) add(n, 'eyes_bush', side() * (1.25 + r() * 0.8));
    for (let n = Z[1] + 50; n < Z[2] - 6; n += 90 + Math.floor(r() * 50)) add(n, 'croc_sign', 1.14);

    // ============ CARNIVAL ============
    add(Z[2], 'arch_carnival', 0);
    add(Z[2] + 24, 'carnival_sign', -1.2);
    add(Z[2] + 40, 'billboard', 1.22);
    add(Z[2] + 1060, 'clown_gate', 0);
    add(Z[2] + 257, 'carnival_sign', -1.15);
    add(Z[2] + 252, 'billboard', 1.2);
    for (let n = Z[2] + 8; n < Z[3] - 6; n += 18) {
      add(n, 'light_pole', -1.1);
      add(n + 4, 'light_pole', 1.1, { flip: true });
    }
    for (let n = Z[2] + 12; n < Z[3] - 6; n += 12 + Math.floor(r() * 12)) {
      add(n, r() < 0.5 ? 'tent_red' : 'tent_purple', side() * (1.45 + r() * 1.6));
    }
    for (let n = Z[2] + 70; n < Z[3] - 6; n += 110 + Math.floor(r() * 70)) add(n, 'ferris', side() * (2.7 + r() * 1.2));
    for (let n = Z[2] + 10; n < Z[3] - 6; n += 9 + Math.floor(r() * 9)) add(n + 2, 'pumpkin', side() * (1.14 + r() * 0.3));
    for (let n = Z[2] + 200; n < Z[3] - 6; n += 220) {
      add(n, 'billboard', side() * 1.22);
      add(n + 110, 'carnival_sign', side() * 1.2);
    }

    // ============ CEMETERY ============
    add(Z[3], 'arch_cemetery', 0);
    const F = this.finishSeg;
    for (let n = Z[3] + 10; n < F + 40; n += 5) {
      const avenue = Math.floor((n - Z[3]) / 70) % 3;
      if (avenue === 2 || (n > F - 50 && n < F + 2)) continue;
      if (avenue === 0) {
        add(n, 'coffin', -1.12); add(n + 1, 'coffin', 1.12);
      } else if ((n - Z[3]) % 10 === 0) {
        add(n, 'carved_cross', -1.30, { scale: 0.82 });
        add(n + 4, 'ivy_headstone', 1.24, { scale: 0.86 });
      }
    }
    for (let n = Z[3] + 6; n < F + 60; n += 3 + Math.floor(r() * 4)) {
      const offset = side() * (1.4 + r() * 2.6);
      const distant = Math.abs(offset) > 3.3;
      const name = distant ? pick(['tomb_cross', 'tomb_small']) : pick(['tomb_rip', 'carved_cross', 'ivy_headstone']);
      add(n, name, offset, { scale: distant ? 0.68 : 1, flip: name !== 'tomb_rip' && r() < 0.3 });
    }
    for (let n = Z[3] + 20; n < F + 60; n += 22 + Math.floor(r() * 26)) add(n, pick(['dead_tree_0', 'dead_tree_1']), side() * (2 + r() * 2), { flip: r() < 0.5 });
    for (let n = Z[3] + 18; n < F + 40; n += 13) {
      const s = side();
      add(n, 'grave_bank', s * (1.35 + r() * 0.9), { flip: s > 0 });
      if (r() < 0.38) add(n + 3, 'grave_pines', -s * (2.3 + r() * 1.8));
    }
    for (let n = Z[3] + 120; n < F - 40; n += 170) {
      add(n, 'gate', 1.35);
      for (let k = 1; k < 5; k++) add(n + k * 6, 'fence', 1.35);
    }
    for (let n = Z[3] + 8; n < F + 60; n += 6 + Math.floor(r() * 6)) add(n, 'fog', side() * (1.15 + r() * 2.2));
    for (let n = F - 48; n < F; n += 6) {
      add(n, 'skeleton_flag', -1.3);
      add(n + 3, 'skeleton_flag', 1.3, { flip: true });
    }
    add(F - 44, 'tomb_rip', -1.45);
    add(F - 27, 'gate', 1.42);
    add(F - 20, 'tomb_rip', 1.5);
    add(F, 'arch_finish', 0);
    this.placeLandmarks();
  },

  placeLandmarks() {
    const place = (zone, distance, name, offset, scale = 1, flip = false) =>
      this.add(this.landmarks[zone] + distance, name, offset, { scale, flip });
    // A neon forecourt on the outside of the coastal bend, open sea on its inside.
    place(0, 12, 'motel_sign', -1.04, 0.81);
    this.frontage(this.landmarks[0] + 8, 31, 'motel_0', -1.44, 2630);
    this.frontage(this.landmarks[0] + 40, 24, 'motel_1', -1.30, 2320);
    place(0, 40, 'palm_1', -1.48, 1.84);
    place(0, 53, 'palm_2', -1.44, 1.48);
    for (const [i, n] of [24, 37, 51, 64, 82].entries()) {
      place(0, n, 'palm_' + (i % 3), -2.4, 1.1);
      place(0, n + 5, 'lamp', -1.07, 0.62);
    }
    for (const n of [12, 21, 33, 45, 65, 86]) place(0, n, 'rock', 1.08, 0.88);

    // The cypresses lean over the water. The warning, gator and mushrooms
    // each have their own gap in the reeds.
    place(1, 14, 'swamp_tree_0', -0.86, 0.66);
    place(1, 17, 'swamp_tree_2', 1.39, 0.93, true);
    place(1, 11, 'croc_sign', 1.29, 0.69);
    place(1, 12, 'gator', 1.08, 0.57);
    place(1, 13, 'mushrooms', -0.82, 0.60);
    place(1, 24, 'mushrooms', 1.68);
    for (let n = 11; n <= 94; n += 4) {
      const right = n % 8 === 3;
      place(1, n, 'reeds', right ? 1.28 : -1.31, 0.65 + n % 3 * 0.15, right);
      if (n >= 31 && n % 12 === 7) place(1, n, 'swamp_tree_1', right ? 3.1 : -3.1, 0.85, right);
    }

    // The wheel is on the skyline; the entrance is a drive-through arch.
    place(2, 82, 'clown_gate', 0);
    place(2, 17, 'carnival_sign', -1.04, 0.74);
    place(2, 21, 'billboard', 1.09, 0.95);
    for (const [i, n] of [22, 29, 39, 51, 64, 84, 92].entries()) {
      place(2, n, i % 2 ? 'tent_purple' : 'tent_red', -1.11, 0.93);
      place(2, n + 4, i % 2 ? 'tent_red' : 'tent_purple', 1.13, 1.1);
    }

    // Marshals flank the brow; the road can be seen switching back below.
    place(3, 18, 'tomb_rip', -1.93, 1.60);
    place(3, 43, 'gate', 1.12, 2.10);
    place(3, 8, 'skeleton_flag', -1.18, 0.54);
    place(3, 8, 'skeleton_flag', 1.13, 0.54, true);
    for (let n = 13; n < 94; n += 6) {
      place(3, n + 3, 'coffin', -1.10, 0.76);
      place(3, n + 4, 'coffin', 1.10, 0.76);
      place(3, n + 6, 'grave_bank', -1.18 - n % 5 * 0.18, 1.20);
      place(3, n + 5, 'grave_bank', 1.42 + n % 4 * 0.20, 1.05, true);
    }
    const grave = this.landmarks[3];
    for (let n = 7; n < 89; n += 9) {
      this.frontage(grave + n, 9, 'fence', -1.10, 260, 0.74);
      this.frontage(grave + n, 9, 'fence', 1.10, 260, 0.74);
    }
    for (let n = 21; n < 76; n += 11) this.frontage(grave + n, 11, 'fence', 1.95, 1380);
    for (const n of [23, 36, 57, 80, 114, 145]) place(3, n, 'grave_pines', n % 2 ? -3.65 : 3.5, 1.2);
  },
};
