'use strict';

const STAGE_COUNT = 4;
const FINISH_HALF_WIDTH = 3300;
const FINISH_SWEEP = 7 * Math.PI / 8; // the last turntable frame before a full front view
const FINISH_TURN_DEPTH = 11 * SEG;
const FINISH_TURN_RADIUS_X = .13;
const WORLD_IDS = ZONES.map(zone => zone.id);
const SURFACES_WITHOUT_SHOULDERS = new Set(['temple', 'bore', 'bridge']);
const BODY_BAND = [[0, .80]];
function validRoute(route) {
  return Array.isArray(route) && route.length === STAGE_COUNT &&
    new Set(route.filter(id => WORLD_IDS.includes(id))).size === STAGE_COUNT;
}

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

  drawRoute(random = Math.random) {
    const shuffled = U.shuffled(WORLD_IDS, random);
    const route = shuffled.slice(0, STAGE_COUNT);
    if (this.lastRaceRoute?.every((id, i) => id === route[i])) route[STAGE_COUNT - 1] = shuffled[STAGE_COUNT];
    return route;
  },

  startRace(route = this.drawRoute()) {
    this.build(route);
    this.lastRaceRoute = this.route;
  },

  itinerary() { return this.route.map(id => tr('zone.' + id)).join('  ›  '); },

  build(route = WORLD_IDS.slice(0, STAGE_COUNT)) {
    if (!validRoute(route)) throw new Error('Invalid race route');
    this.route = route.slice();
    this.zoneStart = []; this.landmarks = []; this.trials = [];
    this.avalanche = null;
    const segs = this.segments = [];
    let stage, zone = WORLD_IDS.indexOf(route[0]), endWidth = ZONES[zone].roadWidth;
    const lastY = () => segs.length ? segs[segs.length - 1].p2.world.y : 0;
    const addSegment = (curve, y, halfWidth) => {
      const n = segs.length;
      segs.push({
        index: n, zone, stage, curve, halfWidth, sprites: [], cars: [], clip: 0,
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
        U.easeInOut(startY, endY, (n + 1) / total), U.easeInOut(startWidth, endWidth, (n + 1) / total));
      for (let n = 0; n < enter; n++) next(n, U.easeIn(0, curve, n / enter));
      for (let n = 0; n < hold; n++) next(enter + n, curve);
      for (let n = 0; n < leave; n++) next(enter + hold + n, U.easeInOut(curve, 0, (n + 1) / leave));
    };

    for (let i = 0; i < route.length; i++) {
      stage = i; zone = WORLD_IDS.indexOf(route[i]);
      const world = ZONES[zone], start = segs.length;
      this.zoneStart.push(start);
      this.landmarks.push(start + world.preview);
      for (const bend of world.bends) road(...bend);
      if (world.valley) {
        const [offset, length, depth] = world.valley;
        const crest = start + offset, top = segs[crest].p1.world.y;
        const elevation = n => top - depth * SEG * Math.sin(Math.PI * n / length) ** 2;
        for (let n = 0; n < length; n++) {
          segs[crest + n].p1.world.y = elevation(n);
          segs[crest + n].p2.world.y = elevation(n + 1);
        }
      }
    }
    this.zoneStart.push(segs.length);
    this.finishSeg = segs.length - 60;
    road(0, 450, 0, 0, 0); // room for cameras and coasting beyond the line
    this.length = segs.length * SEG;
    route.forEach((id, i) => {
      const world = ZONES[WORLD_IDS.indexOf(id)], start = this.zoneStart[i];
      this.placeScenery(i, world);
      for (const [distance, offset] of world.potions) this.add(start + distance, 'turbo_potion', offset);
      const trial = { ...world.trial, title: world.trial.title || 'trial.' + world.trial.kind,
        gates: world.trial.gates.map(([distance, x = 0]) => ({ seg: start + distance, x })) };
      this.trials.push(trial);
      const marker = trial.kind === 'radar' ? 'speed_camera' : 'trial_lantern';
      const half = trial.kind === 'slalom' ? SLALOM_HALF : 1.02;
      for (const gate of trial.gates) {
        this.add(gate.seg, marker, gate.x - half);
        this.add(gate.seg, marker, gate.x + half, { flip: true });
      }
      const arch = i && ['swamp', 'carnival', 'cemetery'].includes(id) ? 'arch_' + id : 'arch_start';
      this.add(start + (i ? 0 : 15), arch, 0, { sign: 'zone.' + id, start: i === 0 });
    });
    this.placeFinish();
  },

  // The final world's road opens onto a level corral. Its back rail describes
  // a semicircle beyond both rows of parking bays, leaving the entrance open.
  placeFinish() {
    const line = this.finishSeg, entry = this.segments[line];
    const ground = entry.p1.world.y, width = entry.halfWidth;
    for (let i = line - 22; i < this.segments.length; i++) {
      const seg = this.segments[i];
      if (i < line) {
        // Clear the banks for spectators; a race object on the approach remains playable.
        seg.sprites = seg.sprites.filter(sp => sp.obstacle || ['trial_lantern', 'speed_camera', 'turbo_potion', 'press_gantry'].includes(sp.name));
        continue;
      }
      seg.sprites.length = 0;
      if (seg.hazards) seg.hazards.length = 0;
      seg.curve = 0;
      seg.p1.world.y = seg.p2.world.y = ground;
      seg.halfWidth = U.easeInOut(width, FINISH_HALF_WIDTH, Math.min(1, (i - line) / 36));
      seg.finishApron = true;
    }
    this.add(line, 'arch_finish', 0);
    const crowds = ['fans_classic', 'fans_howl', 'fans_folklore'];
    for (const [i, distance] of [-21, -10, 3, 17, 34, 53, 72, 88].entries()) {
      const seg = this.segments[line + distance], outside = 1.04 + SPRITES.fans_classic.w / (2 * seg.halfWidth);
      this.add(seg.index, crowds[i % 3], -outside, { flip: true });
      this.add(seg.index, crowds[(i + 1) % 3], outside);
    }
    for (let i = -4; i <= 4; i++) {
      const angle = i * Math.PI / 8;
      this.add(line + 94 + Math.round(26 * Math.cos(angle)), crowds[(i + 4) % 3], 1.24 * Math.sin(angle), { flip: i < 0 });
    }
  },

  finishBay(slot) {
    const back = slot < 4, column = slot % 4;
    return { z: (this.finishSeg + (back ? 94 : 55)) * SEG, x: (column - 1.5) * .43 + (back ? .04 : -.04) };
  },

  moveCar(car, z) {
    const old = this.find(car.z), next = this.find(z);
    car.previousZ = car.z;
    car.z = z; car.percent = U.percentRemaining(z, SEG);
    if (old !== next) {
      const at = old.cars.indexOf(car);
      if (at >= 0) old.cars.splice(at, 1);
      next.cars.push(car);
    }
  },

  enterFinishArea(car, crossingTime) {
    if (car.finished) return;
    const bay = this.finishBay(car.gridSlot);
    const direction = bay.x < 0 ? 1 : -1;
    const turnZ = bay.z - FINISH_TURN_DEPTH * Math.sin(FINISH_SWEEP);
    const turnX = bay.x - direction * FINISH_TURN_RADIUS_X * (1 - Math.cos(FINISH_SWEEP));
    const straight = turnZ - car.z, length = straight + 2 * FINISH_TURN_DEPTH;
    car.finished = true; car.finishedAt = crossingTime;
    car.arrival = { bay, fromX: car.offset, direction, turnX, turnZ, straight, length, distance: 0,
      braking: Math.max(car.speed, MAX_SPEED * .45) ** 2 / (2 * length) };
    car.parked = false; car.bounce = 0;
  },

  brakeIntoBay(car, dt) {
    if (car.parked) return;
    const path = car.arrival;
    const { bay, fromX, direction, turnX, turnZ, straight, length, braking } = path;
    const left = length - path.distance;
    // The stopping speed v² = 2ad keeps a fast finisher inside its bay.
    // A slower one can pull clear of the timing line before braking.
    const speed = Math.min(car.speed + MAX_SPEED * .35 * dt, Math.sqrt(2 * braking * left));
    path.distance = Math.min(length, path.distance + dt * speed);
    car.parked = path.distance === length;
    let x, z;
    if (path.distance < straight) {
      const t = path.distance / straight;
      z = turnZ - (straight - path.distance);
      x = U.lerp(fromX, turnX, t * t * (3 - 2 * t));
      car.pose = Math.round(U.limit(3 * (x - car.offset) / dt, -2, 2));
    } else {
      const angle = FINISH_SWEEP * (path.distance - straight) / (length - straight);
      x = car.parked ? bay.x : turnX + direction * FINISH_TURN_RADIUS_X * (1 - Math.cos(angle));
      z = car.parked ? bay.z : turnZ + FINISH_TURN_DEPTH * Math.sin(angle);
      car.pose = direction * Math.round(angle / (Math.PI / 8));
    }
    car.turn = (x - car.offset) / dt; car.offset = x;
    this.moveCar(car, z);
    car.speed = car.parked ? 0 : speed;
    if (car.parked) car.turn = 0;
  },

  add(n, name, offset, opts = {}) {
    const s = this.segments[n];
    const def = SPRITES[name];
    if (!s || !def) return;
    const flip = opts.flip ?? (def.facing === Math.sign(offset));
    const anchor = def.anchor != null ? (flip ? 1 - def.anchor : def.anchor) : def.center ? 0.5 : offset < 0 ? 1 : 0;
    const sprite = { name, offset, flip, w: def.w * (opts.scale || 1), anchor, hit: def.hit };
    if (opts.sign) { sprite.sign = opts.sign; sprite.start = opts.start; }
    s.sprites.push(sprite);
    return sprite;
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

  placeWorld(stage, world) {
    const start = this.zoneStart[stage], end = this.zoneStart[stage + 1];
    const random = mulberry32(1201 + WORLD_IDS.indexOf(world.id));
    for (const [from, to, surface, backdrop] of world.sections) {
      const textureSpan = surface === 'bridge' ? { from: start + from, length: to - from } : null;
      for (let i = start + from; i < start + to; i++) {
        this.segments[i].surface = surface;
        this.segments[i].backdrop = backdrop;
        if (textureSpan) this.segments[i].textureSpan = textureSpan;
      }
      if (surface === 'temple' || surface === 'bore') {
        const name = surface === 'temple' ? 'sphinx_wall' : 'tunnel_wall';
        for (let n = from; n < to; n += 36) {
          const length = Math.min(36, to - n);
          this.frontage(start + n, length, name, -1.14, 2050);
          this.frontage(start + n, length, name, 1.14, 2050);
        }
      }
    }
    for (const [name, spacing, bank, spread, first = 24] of world.scenery) {
      for (let i = start + first; i < end - 15; i += spacing + Math.floor(random() * spacing * .5)) {
        if (SURFACES_WITHOUT_SHOULDERS.has(this.segments[i].surface)) continue;
        const side = random() < .5 ? -1 : 1;
        if (world.sites.some(([at, , x]) => side * x > 0 && Math.abs(start + at - i) < 16)) continue;
        this.add(i, name, side * (bank + random() * spread), { scale: .82 + random() * .34 });
      }
    }
    for (const [at, name, x, scale] of world.sites) this.add(start + at, name, x, { scale });
    if (world.shoulderProps?.length) {
      // Dress the open gaps close to each kerb, leaving the larger roadside scenes visible.
      for (const side of [-1, 1]) {
        for (let i = start + 14 + Math.floor(random() * 12); i < end - 15; i += 14 + Math.floor(random() * 12)) {
          if (SURFACES_WITHOUT_SHOULDERS.has(this.segments[i].surface)) continue;
          const nearby = this.segments.slice(i - 5, i + 6).some(seg =>
            seg.sprites.some(sp => side * sp.offset >= 1 && side * sp.offset < 1.75));
          if (nearby) continue;
          const name = world.shoulderProps[Math.floor(random() * world.shoulderProps.length)];
          this.add(i, name, side * (1.07 + random() * .56), { scale: .82 + random() * .30, flip: random() < .5 });
        }
      }
    }
    for (const [at, name, x, phase = 0] of world.events) {
      if (name === 'press_die') this.add(start + at, 'press_gantry', 0);
      const sp = this.add(start + at, name, x);
      sp.obstacle = SPRITES[name].obstacle;
      sp.phase = phase;
      (this.segments[start + at].hazards ??= []).push(sp);
    }
    if (world.chase) {
      this.avalanche = { from: start + world.chase[0], to: start + world.chase[1], started: null };
    }
  },

  // The lead racer releases the snow. All cameras sample the same moving front.
  advanceAvalanche(leadZ, time) {
    const wave = this.avalanche;
    if (wave && wave.started === null && leadZ >= wave.from * SEG) wave.started = time;
  },

  avalancheZ(time) {
    const wave = this.avalanche;
    if (!wave || wave.started === null) return null;
    const z = (wave.from - 48) * SEG + (time - wave.started) * MAX_SPEED * .84;
    return z < wave.to * SEG ? z : null;
  },

  // Poses depend on race time, including when sampled between two physics ticks.
  hazardPose(sp, time) {
    const h = sp.obstacle;
    let offset = sp.offset, lift = 0, height = 1, active = true;
    if (h.period) {
      const phase = ((time + sp.phase) / h.period) % 1;
      const wave = Math.sin(phase * 2 * Math.PI);
      if (h.swing) {
        // The giant crosses the junction then waits at the red light.
        offset += h.swing * (h.motion === 'walk' ? Math.sin(Math.min(1, phase * 2) * Math.PI * 2) : wave);
      } else if (h.motion === 'press') {
        const raised = U.limit((.48 - wave) * 1.7, 0, 1);
        lift = raised * 2050;
        active = lift < 740;
      } else if (h.motion === 'pulse') {
        height = .15 + .85 * U.limit((wave + .35) * 1.25, 0, 1);
        active = height > .53;
      }
    }
    return { offset, lift, height, active };
  },

  hazardContact(startZ, endZ, startX, endX, width, time, dt) {
    if (endZ <= startZ) return null;
    for (let i = Math.floor(startZ / SEG) + 1; i <= Math.floor(endZ / SEG); i++) {
      const seg = this.segments[i];
      if (!seg?.hazards) continue;
      const t = (i * SEG - startZ) / (endZ - startZ), x = U.lerp(startX, endX, t);
      for (const sp of seg.hazards) {
        const pose = this.hazardPose(sp, time + dt * t);
        if (!pose.active) continue;
        const w = sp.w / seg.halfWidth;
        for (const [center, span] of sp.obstacle.bands || BODY_BAND) {
          if (U.overlap(x, width / seg.halfWidth, pose.offset + center * w, span * w)) return sp;
        }
      }
    }
    return null;
  },

  placeScenery(stage, world) {
    const start = this.zoneStart[stage], end = this.zoneStart[stage + 1];
    if (world.sites) { this.placeWorld(stage, world); return; }
    const r = mulberry32(42 + WORLD_IDS.indexOf(world.id));
    const pick = a => a[Math.floor(r() * a.length)];
    const side = () => (r() < 0.5 ? -1 : 1);
    // Each stop is measured from its zone entrance. Leave a sightline only on
    // its own bank so trees, tents and fence posts don't stand in front of it.
    const leftBank = new Set(), rightBank = new Set();
    const site = (name, positions) => {
      for (const [distance, offset, scale = 1] of positions) {
        const at = start + distance, bank = offset < 0 ? leftBank : rightBank;
        this.add(at, name, offset, { scale, flip: offset < 0 });
        for (let n = at - 15; n <= at + 5; n++) bank.add(n);
      }
    };
    const add = (n, name, offset, opts) => {
      if ((offset < 0 && leftBank.has(n)) || (offset > 0 && rightBank.has(n))) return;
      const at = this.landmarks[stage];
      if (n >= start && n < end && (n < at - 4 || n > at + 94)) this.add(n, name, offset, opts);
    };

    if (world.id === 'motel') {
      site('gas_pump', [
        [42, -1.26], [268, -1.16], [276, -1.28], [570, -1.16],
        [962, -1.28], [1130, -1.16], [1138, -1.29], [1672, -1.23],
      ]);
      site('lighthouse', [[119, 2.55, 0.88], [773, 2.48], [1532, 2.19, 0.90]]);
      const motels = [start + 560, start + 1120];
      const busyLeft = n => motels.some(m => n > m - 14 && n < m + 60);
      motels.forEach((m, i) => {
        add(m, 'motel_sign', -1.16);
        this.frontage(m - 4, 31, i % 2 ? 'motel_1' : 'motel_0', -1.44, 2630);
        this.frontage(m + 28, 24, i % 2 ? 'motel_0' : 'motel_1', -1.40, 2320);
        add(m + 4, 'lamp', -1.12);
        add(m + 30, 'lamp', -1.12);
      });
      for (let n = start + 18; n < end - 8; n += 6 + Math.floor(r() * 6)) {
        if (!busyLeft(n)) {
          const bluff = Math.floor((n - start) / 135) % 3 === 1;
          const plant = bluff ? pick(['bush_0', 'bush_1', 'bush_2', 'palm_1']) : pick(['palm_0', 'palm_1', 'palm_2']);
          add(n, plant, -1.25 - r() * 1.3, { flip: r() < 0.5 });
        }
      }
      for (let n = start + 22; n < end - 8; n += 7 + Math.floor(r() * 8)) {
        if (r() < 0.6) add(n, 'rock', 1.14 + r() * 0.4, { scale: 0.54 + r() * 0.5 });
        if (!busyLeft(n) && r() < 0.5) add(n + 2, pick(['bush_0', 'bush_2']), -1.2 - r() * 0.6);
      }
      for (let n = start + 60; n < end - 8; n += 30 + Math.floor(r() * 30)) add(n, 'rock', 2.2 + r() * 1.5);
      for (let n = start + 30; n < end - 8; n += 32) add(n, 'lamp', -1.12);
    } else if (world.id === 'swamp') {
      site('stilt_shack', [[73, -1.52, 0.78], [273, 1.54], [524, -1.48], [929, 1.64, 0.87], [1281, -1.44]]);
      site('ghost_skiff', [
        [157, 1.43, 0.84], [262, 1.23], [539, -1.24, 0.92], [746, 1.36],
        [1113, -1.38, 0.85], [1293, -1.24], [1434, 1.34],
      ]);
      for (let n = start + 6; n < end - 6; n += 7 + Math.floor(r() * 6)) {
        const s = side();
        add(n, pick(['swamp_tree_0', 'swamp_tree_1', 'swamp_tree_2']), s * (r() < 0.35 ? 1.65 + r() * 0.3 : 2.1 + r() * 2.6), { flip: s > 0 });
      }
      for (let n = start + 10; n < end - 6; n += 7 + Math.floor(r() * 8)) add(n, 'mushrooms', side() * (1.1 + r() * 0.25));
      for (let n = start + 8; n < end - 6; n += 5 + Math.floor(r() * 6)) add(n, 'reeds', side() * (1.15 + r() * 0.9), { flip: r() < 0.5 });
      for (let n = start + 30; n < end - 6; n += 26 + Math.floor(r() * 30)) { const s = side(); add(n, 'gator', s * (1.5 + r() * 1.2), { flip: s < 0 }); }
      for (let n = start + 20; n < end - 6; n += 22 + Math.floor(r() * 20)) add(n, 'eyes_bush', side() * (1.25 + r() * 0.8));
      for (let n = start + 50; n < end - 6; n += 90 + Math.floor(r() * 50)) add(n, 'croc_sign', 1.14);
    } else if (world.id === 'carnival') {
      site('fortune_wagon', [[62, 1.34, 0.89], [319, -1.30], [656, 1.35], [1051, -1.35, 0.92], [1460, 1.32]]);
      site('high_striker', [[196, -1.27], [330, 1.20], [536, -1.22, 0.90], [842, 1.20], [1247, -1.18], [1471, -1.24]]);
      add(start + 24, 'carnival_sign', -1.2);
      add(start + 40, 'billboard', 1.22);
      add(start + 1060, 'clown_gate', 0);
      add(start + 257, 'carnival_sign', -1.15);
      add(start + 252, 'billboard', 1.2);
      for (let n = start + 8; n < end - 6; n += 18) {
        add(n, 'light_pole', -1.1);
        add(n + 4, 'light_pole', 1.1, { flip: true });
      }
      for (let n = start + 12; n < end - 6; n += 12 + Math.floor(r() * 12)) {
        add(n, r() < 0.5 ? 'tent_red' : 'tent_purple', side() * (1.45 + r() * 1.6));
      }
      for (let n = start + 70; n < end - 6; n += 110 + Math.floor(r() * 70)) add(n, 'ferris', side() * (2.7 + r() * 1.2));
      for (let n = start + 10; n < end - 6; n += 9 + Math.floor(r() * 9)) add(n + 2, 'pumpkin', side() * (1.14 + r() * 0.3));
      for (let n = start + 200; n < end - 6; n += 220) {
        add(n, 'billboard', side() * 1.22);
        add(n + 110, 'carnival_sign', side() * 1.2);
      }
    } else if (world.id === 'cemetery') {
      site('mausoleum', [[78, 1.43, 0.87], [346, -1.40], [651, 1.47], [995, -1.46, 0.94], [1305, 1.67]]);
      site('stone_angel', [
        [60, -1.25], [351, 1.22], [558, -1.26, 0.88], [642, 1.21],
        [905, -1.25], [1147, 1.32], [1399, -1.47], [1511, 1.21],
      ]);
      const F = end - 60;
      for (let n = start + 10; n < F + 40; n += 5) {
        const avenue = Math.floor((n - start) / 70) % 3;
        if (avenue === 2 || (n > F - 50 && n < F + 2)) continue;
        if (avenue === 0) {
          add(n, 'coffin', -1.12); add(n + 1, 'coffin', 1.12);
        } else if ((n - start) % 10 === 0) {
          add(n, 'carved_cross', -1.30, { scale: 0.82 });
          add(n + 4, 'ivy_headstone', 1.24, { scale: 0.86 });
        }
      }
      for (let n = start + 6; n < F + 60; n += 3 + Math.floor(r() * 4)) {
        const offset = side() * (1.4 + r() * 2.6);
        const distant = Math.abs(offset) > 3.3;
        const name = distant ? pick(['tomb_cross', 'tomb_small']) : pick(['tomb_rip', 'carved_cross', 'ivy_headstone']);
        add(n, name, offset, { scale: distant ? 0.68 : 1, flip: name !== 'tomb_rip' && r() < 0.3 });
      }
      for (let n = start + 20; n < F + 60; n += 22 + Math.floor(r() * 26)) add(n, pick(['dead_tree_0', 'dead_tree_1']), side() * (2 + r() * 2), { flip: r() < 0.5 });
      for (let n = start + 18; n < F + 40; n += 13) {
        const s = side();
        add(n, 'grave_bank', s * (1.35 + r() * 0.9), { flip: s > 0 });
        if (r() < 0.38) add(n + 3, 'grave_pines', -s * (2.3 + r() * 1.8));
      }
      for (let n = start + 120; n < F - 40; n += 170) {
        add(n, 'gate', 1.35);
        for (let k = 1; k < 5; k++) add(n + k * 6, 'fence', 1.35);
      }
      for (let n = start + 8; n < F + 60; n += 6 + Math.floor(r() * 6)) add(n, 'fog', side() * (1.15 + r() * 2.2));
      for (let n = F - 48; stage === STAGE_COUNT - 1 && n < F; n += 6) {
        add(n, 'skeleton_flag', -1.3);
        add(n + 3, 'skeleton_flag', 1.3, { flip: true });
      }
      add(F - 44, 'tomb_rip', -1.45);
      add(F - 27, 'gate', 1.42);
      add(F - 20, 'tomb_rip', 1.5);

    }
    this.placeLandmarks(stage, world.id);
  },

  placeLandmarks(stage, id) {
    const at = this.landmarks[stage];
    const place = (distance, name, offset, scale = 1, flip = false) =>
      this.add(at + distance, name, offset, { scale, flip });
    if (id === 'motel') {
      // A neon forecourt on the outside of the coastal bend, open sea on its inside.
      place(12, 'motel_sign', -1.04, 0.81);
      this.frontage(at + 8, 31, 'motel_0', -1.44, 2630);
      this.frontage(at + 40, 24, 'motel_1', -1.30, 2320);
      place(40, 'palm_1', -1.48, 1.84);
      place(53, 'palm_2', -1.44, 1.48);
      for (const [i, n] of [24, 37, 51, 64, 82].entries()) {
        place(n, 'palm_' + (i % 3), -2.4, 1.1);
        place(n + 5, 'lamp', -1.07, 0.62);
      }
      for (const n of [12, 21, 33, 45, 65, 86]) place(n, 'rock', 1.08, 0.88);
    } else if (id === 'swamp') {
      // The cypresses lean over the water. The warning, gator and mushrooms
      // each have their own gap in the reeds.
      place(14, 'swamp_tree_0', -0.86, 0.66);
      place(17, 'swamp_tree_2', 1.39, 0.93, true);
      place(11, 'croc_sign', 1.29, 0.69);
      place(12, 'gator', 1.08, 0.57);
      place(13, 'mushrooms', -0.82, 0.60);
      place(24, 'mushrooms', 1.68);
      for (let n = 11; n <= 94; n += 4) {
        const right = n % 8 === 3;
        place(n, 'reeds', right ? 1.28 : -1.31, 0.65 + n % 3 * 0.15, right);
        if (n >= 31 && n % 12 === 7) place(n, 'swamp_tree_1', right ? 3.1 : -3.1, 0.85, right);
      }
    } else if (id === 'carnival') {
      // The wheel is on the skyline; the entrance is a drive-through arch.
      place(82, 'clown_gate', 0);
      place(17, 'carnival_sign', -1.04, 0.74);
      place(21, 'billboard', 1.09, 0.95);
      for (const [i, n] of [22, 29, 39, 51, 64, 84, 92].entries()) {
        place(n, i % 2 ? 'tent_purple' : 'tent_red', -1.11, 0.93);
        place(n + 4, i % 2 ? 'tent_red' : 'tent_purple', 1.13, 1.1);
      }
    } else if (id === 'cemetery') {
      // Marshals flank the brow; the road can be seen switching back below.
      place(18, 'tomb_rip', -1.93, 1.60);
      place(43, 'gate', 1.12, 2.10);
      place(8, 'skeleton_flag', -1.18, 0.54);
      place(8, 'skeleton_flag', 1.13, 0.54, true);
      for (let n = 13; n < 94; n += 6) {
        place(n + 3, 'coffin', -1.10, 0.76);
        place(n + 4, 'coffin', 1.10, 0.76);
        place(n + 6, 'grave_bank', -1.18 - n % 5 * 0.18, 1.20);
        place(n + 5, 'grave_bank', 1.42 + n % 4 * 0.20, 1.05, true);
      }
      const grave = at;
      for (let n = 7; n < 89; n += 9) {
        this.frontage(grave + n, 9, 'fence', -1.10, 260, 0.74);
        this.frontage(grave + n, 9, 'fence', 1.10, 260, 0.74);
      }
      for (let n = 21; n < 76; n += 11) this.frontage(grave + n, 11, 'fence', 1.95, 1380);
      for (const n of [23, 36, 57, 80, 114, 145]) place(n, 'grave_pines', n % 2 ? -3.65 : 3.5, 1.2);
    }
  },
};
