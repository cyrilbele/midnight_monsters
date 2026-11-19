'use strict';
/* =========================================================
 * director.js — camera and edit of the 15-second trailer.
 *
 * trailer/index.html injects this file INTO the game page, so
 * every shot uses the real engine: G and its autopilot for the
 * races, Select's turntable poses, Local for the split screen,
 * R for every picture. One video frame = one 1/60 s simulation
 * step, drawn at 854 x 480 (16:9 on the game's 480 lines).
 *
 * The cut follows "Vespers at Redline" (144 BPM): 1 beat = 25
 * frames, 1 bar = 100 frames, 9 bars = 15 s.
 * ========================================================= */
(() => {
  const OUT_W = 854, OUT_H = H, FPS = 60;
  const BEAT = 25, BAR = 100;
  // section starts, in frames
  const MONSTERS = BAR, WORLDS = 4 * BAR, SUNRISE = 6 * BAR, PLAYERS = 7 * BAR, FLAG = 8 * BAR, END = 9 * BAR;
  const TOTAL = 11 * BAR;
  const GROUPS = [WORLD_IDS.slice(0, 4), WORLD_IDS.slice(4, 8)];
  const groupOf = id => GROUPS.find(g => g.includes(id));
  const ease = t => 1 - (1 - U.limit(t, 0, 1)) ** 3;
  // the two 4 x 2 grids (monsters, worlds): a new cell every half beat
  const GRID_W = Math.ceil(OUT_W / 4), GRID_H = OUT_H / 2;
  const REVEAL = i => Math.round(i * BEAT / 2);

  // ------------------------------------------------------------- surfaces ---
  const surface = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
  const frame = surface(OUT_W, OUT_H), fx = frame.getContext('2d', { alpha: false });
  const hud = Object.create(R);
  hud.ctx = fx; hud.width = OUT_W;
  function renderer(w, h, width = w, step = 1) {
    const canvas = surface(w, h), r = Object.create(R);
    r.ctx = canvas.getContext('2d', { alpha: false });
    r.ctx.setTransform(1 / step, 0, 0, 1 / step, 0, 0);
    r.width = width; r.rowStep = step; r.cameraYaws = new WeakMap();
    return { canvas, r };
  }
  const cam = renderer(OUT_W, OUT_H);                                     // 16:9 chase camera
  const arena = renderer(W, H);                                           // finish arena, painted for 640 x 480
  const quads = [0, 1, 2, 3].map(() => renderer(OUT_W / 2, OUT_H / 2, OUT_W, 2));   // 4-player split screen

  // ---------------------------------------------------------- race setup ---
  let routeKey = '';
  function useRoute(route) {
    if (route.join() !== routeKey) { Track.build(route); routeKey = route.join(); }
  }
  function clearTraffic(driver = G) {
    for (const car of driver.traffic) {
      const bucket = Track.find(car.z).cars, i = bucket.indexOf(car);
      if (i >= 0) bucket.splice(i, 1);
    }
    driver.traffic.length = 0;
  }

  // A race already under way, on the real course near a world's landmark.
  // rivals: [vehicle, segments ahead, lane, pace as a share of MAX_SPEED]
  function race(o) {
    useRoute(o.route || groupOf(o.world));
    G.vehicle = o.vehicle || 'hearse';
    G.reset(true, mulberry32(o.seed || 7));
    const stage = Track.route.indexOf(o.world);
    G.position = (Track.landmarks[stage] + (o.at || 0)) * SEG;
    G.playerX = o.x ?? 0;
    G.state = 'race'; G.auto = true; G.frozen = false; G.keys = {};
    G.speed = G.topSpeed * (o.speed ?? 0.96);
    G.stage = Track.find(G.position + PLAYER_Z).stage;
    G.trialIndex = Track.trials.length;          // no trial steering inside a cut-down shot
    G.time = 99; G.dawnT = o.dawnT || 0; G.dawn = DAWN_MAX * (1 - G.dawnT);
    G.elapsed = o.elapsed ?? 40; G.hillOffset = o.hill ?? 0.19;
    const pz = G.position + PLAYER_Z;
    G.cars.forEach((car, i) => {
      const spec = (o.rivals || [])[i];
      car.launch = 0;
      if (!spec) { Track.moveCar(car, Math.max(0, pz - 400 * SEG)); car.speed = 0; return; }
      const [id, ahead, lane, pace = 0.84] = spec;
      car.vehicle = id; car.w = A.vehicleWidth(id);
      Track.moveCar(car, pz + ahead * SEG);
      car.offset = lane; car.base = pace; car.speed = pace * MAX_SPEED;
    });
    clearTraffic();
    for (const [id, ahead, lane] of o.traffic || []) G.addTraffic(id, pz + ahead * SEG, lane);
    for (let i = 0; i < (o.preroll ?? 18); i++) G.update(STEP);
    if (o.turbo) G.boostFor(TURBO_DURATION);
  }
  function drawRace() {
    cam.r.frame(G);
    fx.drawImage(cam.canvas, 0, 0);
  }
  const raceShot = o => ({ setup: () => race(o), step: () => G.update(STEP), draw: drawRace });

  // ----------------------------------------------------------- monsters ---
  // The garage in two pages of eight, like the real select screen. Each cell
  // is a small booth: the painted garage around the turntable pin, and the
  // vehicle spinning on it with Select.pose(), the game's own anchoring.
  function drawBooth(id, view, clip, pinX, pinY, k) {
    const [gx, gy, gw, gh] = SEL.garage, [tx, ty] = SEL.table;
    fx.save();
    fx.beginPath(); fx.rect(...clip); fx.clip();
    fx.fillStyle = '#120a1e'; fx.fillRect(...clip);
    fx.imageSmoothingEnabled = false;
    fx.translate(pinX, pinY); fx.scale(k, k); fx.translate(-tx, -ty);
    fx.drawImage(A.ui.garage, gx, gy, gw, gh);
    const p = Select.pose(id, view);
    fx.save();
    fx.translate(tx, ty); fx.scale(1, TABLE_TILT); fx.rotate(p.angle);
    fx.fillStyle = 'rgba(11,3,22,0.68)';
    fx.beginPath(); fx.ellipse(0, 0, p.foot.width, p.foot.length, 0, 0, Math.PI * 2); fx.fill();
    fx.restore();
    fx.fillStyle = '#170c24';
    for (const [u, v] of A.contacts(p.img)) {
      fx.beginPath(); fx.ellipse(p.x + u * p.w, p.y + v * p.h - 0.4, 7, 1.6, 0, 0, 2 * Math.PI); fx.fill();
    }
    A.drawFrame(fx, p.img, p.x, p.y, p.w, p.h);
    fx.restore();
  }
  const ROSTER = Object.keys(VEHICLES);               // garage order, 2 pages of 8
  const PAGE = 150;                                    // 1.5 bars per page
  const SPIN = 5;                                      // frames per turntable view
  const monstersShot = {
    draw(f) {
      const page = Math.min(1, Math.floor(f / PAGE)), local = f - page * PAGE;
      fx.fillStyle = '#0b0614'; fx.fillRect(0, 0, OUT_W, OUT_H);
      ROSTER.slice(page * 8, page * 8 + 8).forEach((id, i) => {
        const t = local - REVEAL(i);
        if (t < 0) return;
        const x = Math.round((i % 4) * OUT_W / 4), y = Math.floor(i / 4) * GRID_H, top = i < 4;
        const clip = [x, y, GRID_W, GRID_H];
        // every booth turns from a three-quarter view, each one a little ahead
        const view = (3 + i * 2 + Math.floor(t / SPIN)) % TURNTABLE_FRAMES;
        drawBooth(id, view, clip, x + GRID_W / 2, y + (top ? 178 : 198), 0.86);
        if (t < 5) { fx.fillStyle = `rgba(255,230,250,${0.75 * (1 - t / 5)})`; fx.fillRect(...clip); }
        const v = I18n.copy.vehicles[id];
        fx.globalAlpha = U.limit(t / 4, 0, 1);
        const ly = top ? y + 23 : y + GRID_H - 22;
        hud.text(v.label, x + GRID_W / 2, ly, 15, hud.yellow(ly, 15), { align: 'center', lw: 3, maxWidth: GRID_W - 10 });
        hud.text(v.origin || v.sub, x + GRID_W / 2, ly + 14, 10, '#f4d8ff', { align: 'center', lw: 2.5, maxWidth: GRID_W - 10 });
        fx.globalAlpha = 1;
      });
      gridLines();
      centerBand();
    },
  };

  function gridLines() {
    fx.fillStyle = '#07020f';
    for (let c = 1; c < 4; c++) fx.fillRect(Math.round(c * OUT_W / 4) - 2, 0, 4, OUT_H);
    fx.fillRect(0, GRID_H - 2, OUT_W, 4);
  }
  // a band across the middle carries the caption over a grid of views
  function centerBand() {
    const band = fx.createLinearGradient(0, OUT_H / 2 - 44, 0, OUT_H / 2 + 44);
    band.addColorStop(0, 'rgba(7,2,15,0)'); band.addColorStop(0.3, 'rgba(7,2,15,0.82)');
    band.addColorStop(0.7, 'rgba(7,2,15,0.82)'); band.addColorStop(1, 'rgba(7,2,15,0)');
    fx.fillStyle = band; fx.fillRect(0, OUT_H / 2 - 44, OUT_W, 88);
  }

  // -------------------------------------------------------- split screen ---
  const SPLIT_RIDES = ['werewolf', 'vampire', 'kappa', 'jiangshi'];
  function splitSetup() {
    const route = GROUPS[1];
    Local.resetRace(SPLIT_RIDES, route, mulberry32(21));
    routeKey = route.join();
    Local.countdown = 0;
    const base = Track.landmarks[route.indexOf('desert')] - 120;   // on the sand, before the sphinx
    Local.drivers.forEach((d, i) => {
      d.auto = true; d.state = 'race'; d.keys = {};
      d.time = 99; d.dawn = DAWN_MAX; d.elapsed = 40; d.trialIndex = Track.trials.length;
      d.position = (base + [0, 5, 10, 15][i]) * SEG; d.playerX = [-0.42, 0.42, 0.05, -0.3][i];
      d.speed = d.topSpeed * 0.95; d.stage = Track.find(d.position + PLAYER_Z).stage;
      const car = d.localCar;
      Track.moveCar(car, d.position + PLAYER_Z); car.offset = d.playerX; car.speed = d.speed;
    });
    Local.entries.filter(car => !car.driver).forEach((car, i) => {
      car.launch = 0; car.offset = [0.45, -0.45, 0.1, -0.15, 0.6, -0.6][i] ?? 0;
      Track.moveCar(car, (base + 8 + i * 6) * SEG + PLAYER_Z);
      car.speed = car.base * MAX_SPEED;
    });
    for (let i = 0; i < 18; i++) Local.advanceRace(STEP, () => ({}));
  }
  const splitShot = {
    setup: splitSetup,
    step: () => Local.advanceRace(STEP, () => ({})),
    draw() {
      Local.drivers.forEach((d, i) => {
        const q = quads[i], x = (i % 2) * OUT_W / 2, y = Math.floor(i / 2) * OUT_H / 2;
        q.r.frame(d);
        fx.drawImage(q.canvas, x, y);
        hud.text(seatName(i), x + 12, y + 26, 18, SEAT_COLORS[i], { lw: 4 });
        hud.text(`${tr('hud.pos')} ${d.rank}/8`, x + OUT_W / 2 - 12, y + 26, 16, '#ffffff', { align: 'right', lw: 4 });
      });
      fx.fillStyle = '#07020f';
      fx.fillRect(OUT_W / 2 - 2, 0, 4, OUT_H); fx.fillRect(0, OUT_H / 2 - 2, OUT_W, 4);
      centerBand();
    },
  };

  // ------------------------------------------------------------- finish ---
  // The approach to the line in the last world, then the game's own cut to
  // the raised camera over the arena, where the field parks.
  function finishSetup() {
    useRoute(GROUPS[0]);
    G.vehicle = 'hearse';
    G.reset(false, mulberry32(93));
    G.auto = true; G.state = 'race'; G.frozen = false; G.keys = {};
    G.stage = STAGE_COUNT - 1; G.trialIndex = Track.trials.length;
    G.elapsed = 116; G.time = 26; G.dawnT = 0.55; G.dawn = DAWN_MAX * (1 - G.dawnT);
    G.position = (Track.finishSeg - 40) * SEG - PLAYER_Z; G.speed = G.topSpeed * 0.96; G.playerX = 0.08;
    G.cars.forEach((car, i) => {
      Track.moveCar(car, (Track.finishSeg - 6 - 8 * i) * SEG);
      car.offset = [0.45, -0.4, 0.1, -0.55, 0.5, -0.2, 0.3][i];
      car.speed = car.base * MAX_SPEED; car.launch = 0;
    });
    for (let i = 0; i < 6; i++) G.update(STEP);
  }
  const finishShot = {
    setup: finishSetup,
    step: () => G.update(STEP),
    draw() {
      if (G.state !== 'finish') return drawRace();
      arena.r.frame(G);
      const k = OUT_W / W;
      fx.imageSmoothingEnabled = false;
      fx.drawImage(arena.canvas, 0, -62, OUT_W, H * k);
    },
  };

  // ------------------------------------------------------------ end card ---
  const SITE = 'cyrilbele.github.io/midnight_monsters';
  const endShot = {
    draw(f) {
      const art = A.ui.titleScene, zoom = 1.1 - 0.1 * ease(f / 150);
      const k = OUT_W / art.width * zoom, w = art.width * k, h = art.height * k;
      // keep the arch's logo high in the frame while easing out
      const ox = (OUT_W - w) / 2, oy = 46 - 196 * k;
      fx.imageSmoothingEnabled = true; fx.imageSmoothingQuality = 'high';
      fx.drawImage(art, ox, oy, w, h);
      fx.imageSmoothingEnabled = false;
      const cta = ease((f - 70) / 14);
      if (cta <= 0) return;
      const g = fx.createLinearGradient(0, OUT_H - 150, 0, OUT_H);
      g.addColorStop(0, 'rgba(8,3,18,0)'); g.addColorStop(0.45, `rgba(8,3,18,${0.82 * cta})`); g.addColorStop(1, `rgba(8,3,18,${0.92 * cta})`);
      fx.fillStyle = g; fx.fillRect(0, OUT_H - 150, OUT_W, 150);
      const lift = Math.round(18 * (1 - cta));
      fx.globalAlpha = cta;
      hud.text('PLAY NOW IN YOUR BROWSER', OUT_W / 2, OUT_H - 62 + lift, 30, hud.yellow(OUT_H - 62, 30), { align: 'center', lw: 5 });
      hud.text('SOLO  •  SPLIT-SCREEN  •  ONLINE', OUT_W / 2, OUT_H - 38 + lift, 15, '#f4d8ff', { align: 'center', lw: 3 });
      hud.text(SITE, OUT_W / 2, OUT_H - 13 + lift, 17, '#7ff4ff', { align: 'center', lw: 3 });
      fx.globalAlpha = 1;
    },
  };

  // ------------------------------------------------------------ the cut ---
  // ------------------------------------------------- the eight worlds ---
  // One shot, cut into a 4 x 2 grid: a race runs in every world at once.
  // Two routes are needed (4 worlds each), so both tracks are built once
  // and swapped in before each world is simulated or drawn.
  // at: start, in segments from the world's landmark; rivals as in race().
  const WORLD_CUTS = [
    { world: 'motel', vehicle: 'hearse', at: -70, rivals: [['vampire', 7, -0.32, 0.74], ['werewolf', 15, 0.34, 0.76]] },
    { world: 'swamp', vehicle: 'werewolf', at: -155, rivals: [['kappa', 7, 0.3, 0.74], ['ahuizotl', 16, -0.32, 0.76]] },
    { world: 'carnival', vehicle: 'vampire', at: -155, rivals: [['rakshasa', 6, -0.32, 0.74], ['tokoloshe', 15, 0.3, 0.76]] },
    { world: 'cemetery', vehicle: 'ankou', at: -155, dawnT: 0.25, rivals: [['vampire', 7, 0.32, 0.74], ['mummy', 16, -0.3, 0.76]] },
    { world: 'desert', vehicle: 'mummy', at: -155, rivals: [['olgoi_khorkhoi', 7, -0.32, 0.74], ['jiangshi', 16, 0.32, 0.76]] },
    { world: 'alpine', vehicle: 'iku_turso', at: -155, rivals: [['baba_yaga', 7, -0.32, 0.74], ['kappa', 16, 0.3, 0.76]] },
    { world: 'city', vehicle: 'krasue', at: -155, rivals: [['dokkaebi', 7, 0.32, 0.74], ['vampire', 16, -0.32, 0.76]] },
    { world: 'foundry', vehicle: 'dokkaebi', at: -155, rivals: [['ankou', 7, -0.32, 0.74], ['amaru', 16, 0.32, 0.76]] },
  ];
  const panels = WORLD_CUTS.map(() => renderer(GRID_W, GRID_H, GRID_W * 2, 2));
  const trackData = () => Object.fromEntries(Object.entries(Track).filter(([, v]) => typeof v !== 'function'));
  let worldTracks = [], worldDrivers = [];

  // an independent driver for one panel, like a seat of the local multiplayer
  function panelDriver(cut) {
    const d = Object.create(G);
    Object.assign(d, { vehicle: cut.vehicle, keys: {}, auto: true, state: 'race', audio: null });
    d.resetDriver();
    d.position = (Track.landmarks[Track.route.indexOf(cut.world)] + cut.at) * SEG;
    d.playerX = cut.x ?? 0; d.speed = d.topSpeed * (cut.speed ?? 0.8);
    d.stage = Track.find(d.position + PLAYER_Z).stage; d.trialIndex = Track.trials.length;
    d.time = 99; d.dawnT = cut.dawnT || 0; d.dawn = DAWN_MAX * (1 - d.dawnT); d.elapsed = 40;
    d.cars = cut.rivals.map(([id, ahead, lane, pace], i) => {
      const z = d.position + PLAYER_Z + ahead * SEG;
      const car = { name: id, vehicle: id, w: A.vehicleWidth(id), base: pace, gridSlot: i + 1, offset: lane,
        z, speed: pace * MAX_SPEED, percent: U.percentRemaining(z, SEG), finished: false, launch: 0 };
      Track.find(z).cars.push(car);
      return car;
    });
    d.traffic = [];
    return d;
  }
  const onTrack = (i, fn) => { Object.assign(Track, worldTracks[i < 4 ? 0 : 1]); fn(worldDrivers[i]); };
  const worldsShot = {
    setup() {
      worldTracks = GROUPS.map(route => { Track.build(route); return trackData(); });
      worldDrivers = WORLD_CUTS.map((cut, i) => {
        Object.assign(Track, worldTracks[i < 4 ? 0 : 1]);
        return panelDriver(cut);
      });
      worldDrivers.forEach((d, i) => onTrack(i, () => { for (let n = 0; n < 18; n++) d.update(STEP); }));
      routeKey = '';                                    // the next race shot rebuilds its own course
    },
    step() { worldDrivers.forEach((d, i) => onTrack(i, () => d.update(STEP))); },
    draw(f) {
      fx.fillStyle = '#0b0614'; fx.fillRect(0, 0, OUT_W, OUT_H);
      WORLD_CUTS.forEach((cut, i) => {
        const t = f - REVEAL(i);
        if (t < 0) return;
        const x = Math.round((i % 4) * OUT_W / 4), y = Math.floor(i / 4) * GRID_H, top = i < 4;
        onTrack(i, d => panels[i].r.frame(d));
        fx.drawImage(panels[i].canvas, x, y);
        if (t < 5) { fx.fillStyle = `rgba(255,230,250,${0.75 * (1 - t / 5)})`; fx.fillRect(x, y, GRID_W, GRID_H); }
        fx.globalAlpha = U.limit(t / 4, 0, 1);
        const ly = top ? y + 22 : y + GRID_H - 10;
        hud.text(tr('zone.' + cut.world), x + GRID_W / 2, ly, 13, '#ffffff', { align: 'center', lw: 3, maxWidth: GRID_W - 10 });
        fx.globalAlpha = 1;
      });
      gridLines();
      centerBand();
    },
  };

  const SHOTS = [
    { from: 0, to: MONSTERS, ...raceShot({ world: 'motel', at: -40, x: 0.1, seed: 3,
      rivals: [['vampire', 7, -0.45, 0.84], ['werewolf', 12, 0.55, 0.86], ['mummy', 24, 0.05, 0.85]] }) },
    { from: MONSTERS, to: WORLDS, ...monstersShot },
    { from: WORLDS, to: SUNRISE, ...worldsShot },
    { from: SUNRISE, to: PLAYERS, ...raceShot({ world: 'cemetery', at: -60, x: 0, dawnT: 0.9, turbo: true, seed: 11,
      rivals: [['werewolf', 8, -0.4, 0.86], ['baba_yaga', 14, 0.45, 0.86], ['vampire', 26, 0, 0.87]] }) },
    { from: PLAYERS, to: FLAG, ...splitShot },
    { from: FLAG, to: END, ...finishShot },
    { from: END, to: TOTAL, ...endShot },
  ];

  const CAPTIONS = [
    { from: BEAT, to: MONSTERS - 3, parts: [['AT MIDNIGHT...', 'gold']] },
    { from: MONSTERS, to: WORLDS - 3, parts: [['16', 'blood'], [' MONSTERS', 'gold']], y: 255 },
    { from: WORLDS, to: SUNRISE - 3, parts: [['8', 'blood'], [' HAUNTED WORLDS', 'gold']], y: 255 },
    { from: SUNRISE, to: PLAYERS - 3, parts: [['1', 'blood'], [' RACE', 'gold']], sub: 'AGAINST THE SUNRISE' },
    { from: PLAYERS, to: FLAG - 3, parts: [['UP TO ', 'gold'], ['4', 'blood'], [' PLAYERS', 'gold']], sub: 'SPLIT-SCREEN  •  ONLINE', y: 262, subY: 292 },
    { from: FLAG, to: END - 3, parts: [['TAKE THE FLAG!', 'gold']] },
  ];
  const FLASHES = [MONSTERS, MONSTERS + PAGE, WORLDS, SUNRISE, PLAYERS, FLAG, END];

  const STYLES = {
    gold: (y, s) => hud.yellow(y, s),
    blood: (y, s) => hud.grad(y, s, ['#ffd0d8', '#ff4a6a', '#e0103a', '#8a0020']),
  };
  function caption(c, f) {
    const t = f - c.from, left = c.to - f;
    const pop = ease(t / 7), alpha = U.limit(Math.min(t / 3, left / 4), 0, 1);
    const size = Math.round((c.size || 40) * (1 + 0.45 * (1 - pop))), y = c.y || 74;
    fx.font = hud.font(size);
    const widths = c.parts.map(([text]) => fx.measureText(text).width);
    let x = (OUT_W - widths.reduce((a, b) => a + b, 0)) / 2;
    fx.globalAlpha = alpha;
    c.parts.forEach(([text, style], i) => {
      hud.text(text, x, y, size, STYLES[style](y, size), { lw: Math.max(5, size / 7) });
      x += widths[i];
    });
    if (c.sub) {
      const sy = c.subY || y + 30, ss = 19;
      hud.text(c.sub, OUT_W / 2, sy, ss, '#ffffff', { align: 'center', lw: 4 });
    }
    fx.globalAlpha = 1;
  }

  function overlays(f, shot) {
    for (const c of CAPTIONS) if (f >= c.from && f < c.to) caption(c, f);
    for (const at of FLASHES) {
      const t = f - at;
      if (t >= 0 && t < 5) { fx.fillStyle = `rgba(255,230,250,${0.7 * (1 - t / 5)})`; fx.fillRect(0, 0, OUT_W, OUT_H); }
    }
    // a soft vignette ties the different screens together
    const v = fx.createRadialGradient(OUT_W / 2, OUT_H / 2, OUT_H * 0.45, OUT_W / 2, OUT_H / 2, OUT_W * 0.62);
    v.addColorStop(0, 'rgba(6,2,14,0)'); v.addColorStop(1, 'rgba(6,2,14,0.38)');
    fx.fillStyle = v; fx.fillRect(0, 0, OUT_W, OUT_H);
  }

  // ------------------------------------------------------------ playback ---
  const shotAt = f => SHOTS.find(s => f >= s.from && f < s.to);
  // toDataURL is synchronous: unlike toBlob's callback, it is not slowed
  // down when the page runs in a background tab.
  async function put(path, canvas) {
    const b64 = canvas.toDataURL('image/png').slice(22);
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const res = await fetch(path, { method: 'PUT', body: bytes });
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
  }

  window.Trailer = {
    total: TOTAL, fps: FPS, frame,
    shotStart: f => shotAt(f).from,
    // Renders frames [from, to). A shot always starts from its own setup,
    // so a preview of any moment begins at the start of that shot.
    async render({ from = 0, to = TOTAL, upload = false, onFrame } = {}) {
      let current = null;
      for (let f = shotAt(from).from; f < to; f++) {
        const shot = shotAt(f);
        if (shot !== current) { current = shot; shot.setup?.(); }
        shot.draw(f - shot.from);
        overlays(f, shot);
        if (f >= from) {
          if (upload) await put(`/frame/${String(f).padStart(5, '0')}.png`, frame);
          await onFrame?.(f);
        }
        shot.step?.();
      }
    },
    save: (name, canvas = frame) => put(`/preview/${name}.png`, canvas),
  };
})();
