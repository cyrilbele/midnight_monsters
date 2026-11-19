'use strict';
/* =========================================================
 * assets.js — loads the PNG files listed in sprites.js.
 * Turntable sheets have an offline index of source rectangles.
 * ========================================================= */
const TEX_SPAN = 1.08;            // the outer frayed edges extend slightly onto the shoulders

const A = {
  img: {},        // scenery name -> image
  contactCache: new WeakMap(),
  flipped: {},    // name -> horizontally flipped copy (made lazily)
  bg: [],         // per zone {panorama, ground, road, pavement?}
  ui: {},         // select screen images
  veh: {},        // vehicle id -> [16 frames]
  traffic: {},    // traffic id -> [left, rear, right]
  raceRear: {},   // painted chase-camera views, when provided
  loaded: 0, total: 0,

  loadImage(path) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('sprites/' + path));
      img.src = 'sprites/' + path + '?v=' + ART_VERSION;
    });
  },

  async loadTurntable(id) {
    const path = 'players/' + id + '/turntable';
    const indexPath = 'sprites/' + path + '.json';
    const index = fetch(indexPath + '?v=' + ART_VERSION).then(response => {
      if (!response.ok) throw new Error(indexPath);
      return response.json();
    }).catch(() => { throw new Error(indexPath); });
    const [atlas, cuts] = await Promise.all([this.loadImage(path + '.png'), index]);
    if (cuts?.size !== atlas.width || atlas.height !== atlas.width || atlas.width % 4 ||
        !Array.isArray(cuts.frames) || cuts.frames.length !== TURNTABLE_FRAMES) throw new Error(indexPath);
    const cell = atlas.width / 4, pad = VEHICLES[id].framePadding ?? 0;
    return cuts.frames.map((rect, i) => {
      if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isInteger)) throw new Error(indexPath);
      const [x, y, width, height] = rect, left = i % 4 * cell, top = Math.floor(i / 4) * cell;
      if (width < 1 || height < 1 || x - pad < left || y - pad < top ||
          x + width + pad > left + cell || y + height + pad > top + cell) throw new Error(indexPath);
      return { atlas, x: x - pad, y: y - pad, width: width + 2 * pad, height: height + 2 * pad };
    });
  },

  async load(onProgress) {
    const jobs = [], missing = [];
    const job = (path, set) => jobs.push(() => this.loadImage(path).then(set));
    for (const [name, def] of Object.entries(SPRITES)) job(def.file, i => (this.img[name] = i));
    BACKGROUNDS.forEach((b, z) => {
      this.bg[z] = {};
      for (const [key, path] of Object.entries(b)) job(path, i => (this.bg[z][key] = i));
    });
    for (const [k, f] of Object.entries(UI_SPRITES)) job(f, i => (this.ui[k] = i));
    for (const [id, v] of Object.entries(VEHICLES)) {
      jobs.push(async () => { this.veh[id] = await this.loadTurntable(id); });
      if (v.raceRear) job(v.raceRear, i => (this.raceRear[id] = i));
    }
    for (const id of Object.keys(TRAFFIC_MODELS)) {
      this.traffic[id] = [];
      TRAFFIC_VIEWS.forEach((view, f) => job(`traffic/${id}/${view}.png`, i => (this.traffic[id][f] = i)));
    }
    this.total = jobs.length;
    this.loaded = 0;
    await Promise.all(jobs.map(async load => {
      try { await load(); } catch (err) { missing.push(err.message); }
      this.loaded++;
      if (onProgress) onProgress(this.loaded / this.total);
    }));
    if (missing.length) throw new Error(tr('error.missing') + '\n' + missing.join('\n'));
  },

  get(name, flip) {
    if (!flip) return this.img[name];
    if (!this.flipped[name]) {
      const src = this.img[name], c = document.createElement('canvas');
      c.width = src.width; c.height = src.height;
      const g = c.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0);
      this.flipped[name] = c;
    }
    return this.flipped[name];
  },

  // Hill occlusion draws only the visible fraction from the top of a frame.
  drawFrame(ctx, frame, x, y, w, h, visible = 1) {
    const source = frame.atlas || frame;
    const sx = frame.atlas ? frame.x : 0, sy = frame.atlas ? frame.y : 0;
    ctx.drawImage(source, sx, sy, frame.width, frame.height * visible, x, y, w, h);
  },

  copyFrame(frame, options) {
    const c = document.createElement('canvas');
    c.width = frame.width; c.height = frame.height;
    this.drawFrame(c.getContext('2d', options), frame, 0, 0, c.width, c.height);
    return c;
  },

  // Locate the bottom of each visible tyre in the trimmed PNG. These small
  // contact shadows meet the rubber even on asymmetrical three-quarter views.
  contacts(img) {
    if (this.contactCache.has(img)) return this.contactCache.get(img);
    const c = this.copyFrame(img, { willReadFrequently: true });
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, points = [];
    for (let side = 0; side < 2; side++) {
      const start = Math.floor(c.width * side / 2), end = Math.floor(c.width * (side + 1) / 2);
      let lowest = -1, left = start, right = start;
      for (let x = start; x < end; x++) {
        for (let y = c.height - 1; y >= Math.max(lowest, c.height * 0.65); y--) {
          if (data[(y * c.width + x) * 4 + 3] < 128) continue;
          if (y > lowest) { lowest = y; left = x; }
          right = x;
          break;
        }
      }
      if (lowest >= 0) points.push([(left + right + 1) / (2 * c.width), (lowest + 1) / c.height]);
    }
    this.contactCache.set(img, points);
    return points;
  },

  // one view of a vehicle; f can be negative (-1 = 15, turning left)
  frame(id, f) {
    const fr = this.veh[id];
    return fr[((f % fr.length) + fr.length) % fr.length];
  },
  // world width of a vehicle seen from behind (used for collisions)
  vehicleWidth(id) { return this.veh[id][0].width * VEHICLE_PX * VEHICLES[id].scale; },
};
