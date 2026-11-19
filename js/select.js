'use strict';
/* =========================================================
 * select.js — "CHOISIS TON BOLIDE", the vehicle select screen.
 * The vehicle spins on the turntable by stepping through its 16
 * painted views, using the same frames as the race.
 * ========================================================= */
const SEL_ORDER = Object.keys(VEHICLES);
const SEL_TIME = 30;
const TURN_FRAME_TIME = 0.15;
const TABLE_TILT = 0.19;          // vertical foreshortening of the painted disc
const SEL = {                     // layout on the 640x480 screen
  garage: [8, 50, 410, 280],
  panel: [426, 50, 206, 280],
  table: [213, 241],              // centre pin of the painted turntable
  arrowL: [20, 180, 48, 76], arrowR: [358, 180, 48, 76],
  cards: { x: 8, y: 339, w: 150, h: 45, cols: 4, rows: 2, gapX: 8, gapY: 7 },
  pageL: [333, 444, 30, 26], pageR: [427, 444, 30, 26],
  confirm: [468, 444, 164, 32],
};
const STAT_ROWS = [
  ['speed', '#ffc21a'],
  ['accel', '#ffc21a'],
  ['grip', '#36e6c8'],
  ['armor', '#ff3aa8'],
];
const PINK = '#d8369e';

const Select = {
  index: 0, view: 3, spin: 0, hold: 0, time: SEL_TIME, t: 0,

  get id() { return SEL_ORDER[this.index]; },
  get pageSize() { return SEL.cards.cols * SEL.cards.rows; },
  get firstCard() { return this.index - this.index % this.pageSize; },

  open(current) {
    this.index = Math.max(0, SEL_ORDER.indexOf(current));
    this.view = 3; this.hold = 1.2; this.spin = 0; this.time = SEL_TIME;
  },

  update(dt) {
    this.t += dt;
    this.spin += Math.max(0, dt - this.hold);
    this.hold = Math.max(0, this.hold - dt);
    const steps = Math.floor(this.spin / TURN_FRAME_TIME);
    this.spin -= steps * TURN_FRAME_TIME;
    this.view = (this.view + steps) % TURNTABLE_FRAMES;
    this.time -= dt;
    if (this.time <= 0) this.confirm();
  },

  move(d) {
    this.index = (this.index + d + SEL_ORDER.length) % SEL_ORDER.length;
    this.time = SEL_TIME; this.hold = 1.2; this.spin = 0;
    Sound.startMusic(); Sound.tone(880, 0.07, 'square', 0.08);
  },
  turnPage(d) {
    const pages = Math.ceil(SEL_ORDER.length / this.pageSize);
    if (pages < 2) return;
    const page = (this.firstCard / this.pageSize + d + pages) % pages;
    const next = Math.min(page * this.pageSize + this.index % this.pageSize, SEL_ORDER.length - 1);
    this.move(next - this.index);
  },
  rotate(d) {
    this.view = (this.view + d + TURNTABLE_FRAMES) % TURNTABLE_FRAMES;
    this.time = SEL_TIME; this.hold = 2.5; this.spin = 0;
    Sound.startMusic(); Sound.tone(440, 0.05, 'square', 0.06);
  },
  confirm() {
    if (G.state !== 'select') return;
    G.vehicle = this.id;
    G.start();
    Sound.beep(true);
  },

  click(x, y) {
    const inside = r => x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3];
    for (let i = this.firstCard; i < Math.min(SEL_ORDER.length, this.firstCard + this.pageSize); i++) {
      if (!inside(this.cardRect(i))) continue;
      if (i === this.index) this.confirm(); else this.move(i - this.index);
      return;
    }
    if (inside(SEL.confirm)) this.confirm();
    else if (inside(SEL.pageL)) this.turnPage(-1);
    else if (inside(SEL.pageR)) this.turnPage(1);
    else if (inside(SEL.arrowL) || inside([176, 444, 26, 24])) this.rotate(-1);
    else if (inside(SEL.arrowR) || inside([204, 444, 26, 24])) this.rotate(1);
    else if (inside([8, 444, 26, 24])) this.move(-1);
    else if (inside([36, 444, 26, 24])) this.move(1);
  },

  cardRect(i) {
    const c = SEL.cards, slot = i % this.pageSize;
    return [c.x + (slot % c.cols) * (c.w + c.gapX), c.y + Math.floor(slot / c.cols) * (c.h + c.gapY), c.w, c.h];
  },

  // ------------------------------------------------------------- drawing ---
  draw(pixel) {
    const ctx = R.ctx;
    ctx.imageSmoothingEnabled = false;
    // ---- pixel-art pass (goes through the same 320x240 filter as the race)
    ctx.fillStyle = '#140a22'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1b0f2e';
    for (let x = -H; x < W; x += 14) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + H, 0); ctx.lineTo(x + H + 5, 0); ctx.lineTo(x + 5, H); ctx.fill(); }
    this.stage();
    const end = Math.min(this.firstCard + this.pageSize, SEL_ORDER.length);
    for (let i = this.firstCard; i < end; i++) this.cardArt(i);
    if (pixel) R.pixelate();
    // ---- crisp UI pass
    this.header();
    this.border(...SEL.garage);
    this.plaque();
    this.panel();
    for (let i = this.firstCard; i < end; i++) this.cardUI(i);
    this.footer();
  },

  // Registered sheets keep the midpoint between the axles on the centre pin.
  // Other sheets use their display height and projected footprint.
  pose(id, frame) {
    const img = A.frame(id, frame), model = VEHICLES[id], foot = model.display;
    const angle = frame * 2 * Math.PI / TURNTABLE_FRAMES;
    const [tx, ty] = SEL.table;
    const scale = 0.82 * model.scale, w = Math.round(img.width * scale);
    if (foot.pivot) {
      const cell = img.atlas.width / 4;
      const x = Math.round(tx + (img.x % cell - foot.pivot[0]) * scale);
      const y = Math.round(ty + (img.y % cell - foot.pivot[1]) * scale);
      return { img, x, y, w, h: Math.round(img.height * scale), foot, angle };
    }
    const depth = TABLE_TILT * Math.hypot(foot.length * Math.cos(angle), foot.width * Math.sin(angle));
    const bottom = Math.round(ty + depth);
    const y = ty - foot.height;
    return { img, x: Math.round(tx - w / 2), y, w, h: bottom - y, foot, angle };
  },

  stage() {
    const ctx = R.ctx, [gx, gy, gw, gh] = SEL.garage, [tx, ty] = SEL.table;
    ctx.save();
    ctx.beginPath(); ctx.rect(gx, gy, gw, gh); ctx.clip();
    ctx.drawImage(A.ui.garage, gx, gy, gw, gh);
    const p = this.pose(this.id, this.view);
    ctx.save();
    ctx.translate(tx, ty); ctx.scale(1, TABLE_TILT); ctx.rotate(p.angle);
    ctx.fillStyle = 'rgba(11,3,22,0.68)';
    ctx.beginPath(); ctx.ellipse(0, 0, p.foot.width, p.foot.length, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#170c24';
    for (const [u, v] of A.contacts(p.img)) {
      ctx.beginPath(); ctx.ellipse(p.x + u * p.w, p.y + v * p.h - 0.4, 7, 1.6, 0, 0, 2 * Math.PI); ctx.fill();
    }
    A.drawFrame(ctx, p.img, p.x, p.y, p.w, p.h);
    // rotate arrows (the right one is the same PNG mirrored)
    const ar = A.ui.rotate_arrow, bob = Math.round(Math.sin(this.t * 3) * 3);
    ctx.drawImage(ar, SEL.arrowL[0], SEL.arrowL[1] + bob);
    ctx.save(); ctx.translate(SEL.arrowR[0] + ar.width, SEL.arrowR[1] - bob); ctx.scale(-1, 1); ctx.drawImage(ar, 0, 0); ctx.restore();
    ctx.restore();
  },

  cardArt(i) {
    const ctx = R.ctx, [x, y, w, h] = this.cardRect(i), id = SEL_ORDER[i], sel = i === this.index;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, sel ? '#4a2266' : '#2c1842'); g.addColorStop(1, sel ? '#26103a' : '#1a0e2a');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    const img = A.frame(id, VEHICLES[id].thumb);
    const k = Math.min(44 / img.width, (h - 8) / img.height);
    const dw = img.width * k, dh = img.height * k;
    const cx = x + 26, ground = y + h - 5;
    ctx.fillStyle = 'rgba(5,1,12,0.45)';
    ctx.beginPath(); ctx.ellipse(cx, ground - 1, dw * 0.44, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.imageSmoothingEnabled = true;
    A.drawFrame(ctx, img, Math.round(cx - dw / 2), Math.round(ground - dh), Math.round(dw), Math.round(dh));
    ctx.imageSmoothingEnabled = false;
  },

  // ---------------------------------------------------------------- UI ---
  rr(x, y, w, h, r) {
    const ctx = R.ctx;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  },

  border(x, y, w, h, col = PINK) {
    const ctx = R.ctx;
    ctx.lineWidth = 5; ctx.strokeStyle = '#07020f'; ctx.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
    ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,140,220,0.35)'; ctx.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
  },

  header() {
    const ctx = R.ctx;
    R.logo(110, 1, 0.73);
    const title = tr('garage.choose'), cx = 318;
    ctx.font = R.font(26);
    const tw = ctx.measureText(title).width;
    ctx.fillStyle = PINK;
    for (const [a, b] of [[136, cx - tw / 2 - 12], [cx + tw / 2 + 12, W - 136]]) {
      if (b - a > 6) { ctx.fillRect(a, 20, b - a, 3); ctx.fillRect(a + 4, 28, b - a - 8, 3); }
    }
    R.text(title, cx, 38, 26, R.grad(38, 26, ['#ffffff', '#fff3cc', '#ffd27a']), { align: 'center', maxWidth: 352 });
    R.text(tr('garage.select'), W - 48, 33, 12, '#ffffff', { align: 'right', lw: 3, maxWidth: 84 });
    const n = Math.max(0, Math.ceil(this.time));
    R.text(String(n), W - 8, 39, 28, n <= 5 && Math.floor(this.t * 4) % 2 ? '#ff4a6a' : R.yellow(39, 28), { align: 'right' });
  },

  plaque() {
    const ctx = R.ctx, cx = SEL.table[0], y = 306;
    this.rr(cx - 66, y, 132, 20, 5);
    ctx.fillStyle = '#2c2040'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#07020f'; ctx.stroke();
    this.rr(cx - 64, y + 2, 128, 16, 4);
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#a894cc'; ctx.stroke();
    ctx.fillStyle = '#d8ccf0';
    for (const dx of [-58, 58]) { ctx.beginPath(); ctx.arc(cx + dx, y + 10, 2, 0, Math.PI * 2); ctx.fill(); }
    R.text(tr('garage.turntable'), cx, y + 15, 12, '#f4eeff', { align: 'center', lw: 3, maxWidth: 106 });
  },

  panel() {
    const ctx = R.ctx, [x, y, w, h] = SEL.panel, v = I18n.copy.vehicles[this.id], cx = x + w / 2;
    ctx.fillStyle = '#1a0e2c'; ctx.fillRect(x, y, w, h);
    this.border(x, y, w, h);
    // name (shrunk to fit)
    let size = 21;
    ctx.font = R.font(size);
    while (ctx.measureText(v.title).width > w - 18 && size > 12) ctx.font = R.font(--size);
    R.text(v.title, cx, y + 32, size, R.grad(y + 32, size, ['#ffffff', '#f6eeff', '#d4c4f0']), { align: 'center', lw: 4 });
    // model line between two pink rules
    ctx.font = R.font(12);
    const sw = ctx.measureText(v.sub).width;
    ctx.fillStyle = PINK;
    ctx.fillRect(x + 10, y + 47, Math.max(0, cx - sw / 2 - 8 - (x + 10)), 2);
    ctx.fillRect(cx + sw / 2 + 8, y + 47, Math.max(0, x + w - 10 - (cx + sw / 2 + 8)), 2);
    R.text(v.sub, cx, y + 52, 12, '#b98aff', { align: 'center', lw: 3, maxWidth: w - 18 });
    v.tag.forEach((l, i) => R.text(l, cx, y + 74 + i * 15, 10, '#ffffff', { align: 'center', lw: 2.5, maxWidth: w - 18 }));
    // stats
    STAT_ROWS.forEach(([key, col], i) => {
      const sy = y + 114 + i * 36;
      R.text(tr('stat.' + key), x + 12, sy, 11, '#ffffff', { lw: 2.5 });
      this.bar(x + 12, sy + 5, w - 24, 14, VEHICLES[this.id].stats[key], col);
    });
    // badge
    const by = y + 250;
    ctx.fillStyle = PINK; ctx.fillRect(x + 10, by - 6, w - 20, 1); ctx.fillRect(x + 10, by + 26, w - 20, 1);
    const badge = A.ui['badge_' + this.id];
    if (badge) ctx.drawImage(badge, x + 16, by - 2, 22, 26);
    else {
      const front = A.frame(this.id, 8), side = Math.min(front.width, Math.round(front.height * 0.52));
      const left = front.x + Math.floor((front.width - side) / 2);
      ctx.drawImage(front.atlas, left, front.y, side, side, x + 14, by - 1, 26, 26);
    }
    R.text(v.badge, x + 48, by + 18, 14, R.grad(by + 18, 14, ['#ffffff', '#efe2ff']), { lw: 3, maxWidth: w - 59 });
  },

  bar(x, y, w, h, n, col) {
    const ctx = R.ctx;
    this.rr(x, y, w, h, h / 2);
    ctx.fillStyle = '#0c0618'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#6a5a8a'; ctx.stroke();
    const gap = 3, sw = (w - 6 - gap * 4) / 5;
    for (let i = 0; i < 5; i++) {
      const sx = x + 3 + i * (sw + gap);
      this.rr(sx, y + 3, sw, h - 6, 3);
      ctx.fillStyle = i < n ? col : '#3a3050'; ctx.fill();
      if (i < n) { ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(sx + 2, y + 4, sw - 4, 2); }
    }
  },

  cardUI(i) {
    const ctx = R.ctx, [x, y, w, h] = this.cardRect(i), id = SEL_ORDER[i], sel = i === this.index;
    if (sel) {
      ctx.save();
      ctx.shadowColor = '#ff9a10'; ctx.shadowBlur = 12;
      ctx.lineWidth = 3; ctx.strokeStyle = '#ffb020'; ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
      ctx.restore();
      ctx.lineWidth = 1; ctx.strokeStyle = '#ffe9a0'; ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
    } else {
      this.border(x, y, w, h, '#8a3aa8');
    }
    const v = I18n.copy.vehicles[id];
    let size = 13;
    ctx.font = R.font(size);
    const textWidth = w - 58;
    while (ctx.measureText(v.label).width > textWidth && size > 9) ctx.font = R.font(--size);
    R.text(v.label, x + 51, y + 22, size, sel ? R.yellow(y + 22, size) : '#fff', { lw: 2.5, maxWidth: textWidth });
    R.text(v.origin || v.badge, x + 51, y + 34, 9, '#d5b6e8', { lw: 2, maxWidth: textWidth });
  },

  key(x, y, glyph) {
    const ctx = R.ctx;
    this.rr(x, y, 24, 22, 4);
    ctx.fillStyle = '#241a36'; ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = '#e8e0ff'; ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.fillStyle = '#ffffff'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    const cx = x + 12, cy = y + 11;
    ctx.beginPath();
    if (glyph === 'left' || glyph === 'right') {
      const s = glyph === 'left' ? -1 : 1;
      ctx.moveTo(cx - 6 * s, cy); ctx.lineTo(cx + 5 * s, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 6 * s, cy); ctx.lineTo(cx + 1 * s, cy - 5); ctx.lineTo(cx + 1 * s, cy + 5); ctx.closePath(); ctx.fill();
    } else {
      // ccw = arc over the top from right to left (head on the left), cw = mirror
      const ccw = glyph === 'ccw', ay = cy + 3;
      ctx.arc(cx, ay, 6, ccw ? 0 : Math.PI, ccw ? Math.PI : 0, ccw); ctx.stroke();
      const hx = cx + (ccw ? -6 : 6);
      ctx.beginPath(); ctx.moveTo(hx - 4, ay - 1); ctx.lineTo(hx + 4, ay - 1); ctx.lineTo(hx, ay + 5); ctx.closePath(); ctx.fill();
    }
    ctx.lineCap = 'butt';
  },

  footer() {
    const ctx = R.ctx, y = 444;
    ctx.fillStyle = PINK;
    ctx.fillRect(0, y + 11, 6, 2);
    this.key(8, y, 'left'); this.key(36, y, 'right');
    R.text(tr('garage.vehicle'), 68, y + 17, 13, '#ffffff', { lw: 3, maxWidth: 86 });
    ctx.fillStyle = PINK; ctx.fillRect(163, y - 1, 2, 25);
    this.key(176, y, 'ccw'); this.key(204, y, 'cw');
    R.text(tr('garage.rotate'), 236, y + 17, 13, '#ffffff', { lw: 3, maxWidth: 85 });
    const pages = Math.ceil(SEL_ORDER.length / this.pageSize);
    if (pages > 1) {
      const current = Math.floor(this.index / this.pageSize) + 1;
      this.key(SEL.pageL[0] + 3, y, 'left');
      this.key(SEL.pageR[0] + 3, y, 'right');
      R.text(current + ' / ' + pages, 394, y + 17, 13, '#d5b6e8', { align: 'center', lw: 2 });
    } else {
      ctx.fillStyle = PINK; ctx.fillRect(330, y + 11, 128, 2);
    }
    // CONFIRMER
    const [bx, by, bw, bh] = SEL.confirm, sk = 10;
    const glow = this.time < 10 ? 0.5 + 0.5 * Math.sin(this.t * 8) : 0;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(bx + sk, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw - sk, by + bh); ctx.lineTo(bx, by + bh); ctx.closePath();
    const g = ctx.createLinearGradient(0, by, 0, by + bh);
    g.addColorStop(0, '#fff3a0'); g.addColorStop(0.45, '#ffd02a'); g.addColorStop(1, '#ff8a00');
    ctx.shadowColor = '#ff9a10'; ctx.shadowBlur = 6 + glow * 14;
    ctx.fillStyle = g; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3; ctx.strokeStyle = '#07020f'; ctx.stroke();
    ctx.restore();
    ctx.font = R.font(19); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const confirm = tr('garage.confirm');
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillText(confirm, bx + bw / 2 + 1, by + 24, bw - 28);
    ctx.fillStyle = '#3a1200'; ctx.fillText(confirm, bx + bw / 2, by + 23, bw - 28);
    ctx.textAlign = 'left';
  },
};
