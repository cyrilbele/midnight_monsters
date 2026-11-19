'use strict';
/* =========================================================
 * render.js — the "super scaler" renderer.
 *  - no 3D API: every segment of road is projected to 2 screen
 *    lines, then each scanline between them is drawn as a
 *    1-pixel-high slice of the road bitmap, stretched to the
 *    projected width (line-scroll / sprite-row scaling).
 *  - every object is a pre-drawn bitmap that is only moved and
 *    scaled (drawImage), back to front.
 * ========================================================= */
const MAX_SPEED = SEG / STEP;   // 12000 world units / s
const KMH = 290;                // km/h shown at MAX_SPEED

// Each painted label uses its own tight rectangle in the cabinet lettering strip.
const RACE_LABELS = {
  pos: [0, 59, 26], time: [119, 74, 21],
  speedUnit: [194, 62, 31], field: [257, 38, 32],
};
const DIGIT_WIDTHS = [32, 25, 33, 33, 30, 38, 32, 32, 35, 30];
const TURBO_BUTTON = { x: 12, y: H - 55, w: 121, h: 44 };

const R = {
  ctx: null,
  width: W,
  rowStep: 1,
  fogCache: {},
  strips: new WeakMap(),
  halfSize: new WeakMap(),

  init(canvas) {
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    ZONES.forEach(z => { this.fogCache[z.id] = Array.from({ length: 33 }, (_, i) => U.rgba(z.fog, (i / 32) * 0.85)); });
  },

  frame(G) {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    if (G.state === 'finish') { this.finishArea(G); return; }
    const baseSeg = Track.find(G.position);
    const basePercent = U.percentRemaining(G.position, SEG);
    const playerSeg = Track.find(G.position + PLAYER_Z);
    const playerPercent = U.percentRemaining(G.position + PLAYER_Z, SEG);
    const playerY = U.lerp(playerSeg.p1.world.y, playerSeg.p2.world.y, playerPercent);

    ctx.save();
    if (G.shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * G.shake * 10), Math.round((Math.random() - 0.5) * G.shake * 6));

    const zi = playerSeg.zone, start = Track.zoneStart[playerSeg.stage];
    const previous = playerSeg.stage ? Track.segments[start - 1].zone : zi;
    const zt = previous === zi ? 1 : U.limit((playerSeg.index - start) / 90, 0, 1);
    // Ease the camera into the next slope while keeping the tyres at PLAYER_BASE.
    const behind = Track.find(G.position + PLAYER_Z - 8 * SEG);
    const ahead = Track.find(G.position + PLAYER_Z + 16 * SEG);
    const rise = U.lerp(ahead.p1.world.y - behind.p1.world.y, ahead.p2.world.y - behind.p2.world.y, playerPercent);
    const grade = rise / (Math.max(1, ahead.index - behind.index) * SEG);
    this.horizon = U.lerp(ZONES[previous].horizon, ZONES[zi].horizon, zt) + U.limit(grade * 40, -18, 18);
    const distant = Track.find(G.position + 120 * SEG).p1.world;
    const fall = (playerY - distant.y) * CAM_DEPTH * (PLAYER_BASE - this.horizon) / (120 * SEG);
    this.backgrounds(G, zi, previous, zt, Math.max(0, fall), playerSeg.backdrop);
    this.road(G, baseSeg, basePercent, playerY);
    this.sprites(G, baseSeg, playerSeg, playerPercent);
    const snowZ = Track.avalancheZ(G.elapsed);
    if (snowZ !== null && playerSeg.index >= Track.avalanche.from - 25 && playerSeg.index < Track.avalanche.to) {
      // In a rear chase camera the approaching powder first curls around the two lower corners.
      const distance = Math.abs(G.position + PLAYER_Z - snowZ) / SEG;
      if (distance < 48) {
        const w = Math.round((1 - distance / 48) * Math.min(this.width * .32, 260)) + 1;
        const img = A.img.snow_wave, h = w * img.height / img.width;
        ctx.globalAlpha = .80;
        ctx.drawImage(img, -w * .14, H - h * .80, w, h);
        ctx.drawImage(A.get('snow_wave', true), this.width - w * .86, H - h * .80, w, h);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    if (G.turboLeft > 0) {
      const envelope = Math.min(1, (G.elapsed - G.turboStart) * 6, G.turboLeft * 4);
      ctx.globalAlpha = 0.65 * envelope;
      ctx.drawImage(A.ui.turbo, 0, 0, this.width, H);
      ctx.globalAlpha = 1;
    }
  },

  backgrounds(G, zi, previous, blend, fall, backdrop) {
    const ctx = this.ctx;
    ctx.fillStyle = ZONES[zi].groundBands[0];
    ctx.fillRect(0, 0, this.width, H);
    const panorama = (z, opacity, layer = 'panorama') => {
      const image = A.bg[z][layer];
      const width = ZONES[z].panoramaWidth;
      const extra = ZONES[z].panoramaExtra;
      const height = Math.round(this.horizon + extra + fall);
      ctx.globalAlpha = opacity;
      const sky = z === 0 || z === 2 ? 45 : 20;
      const paint = (sx, sw, dx, dw) => {
        ctx.drawImage(image, sx, 0, sw, 20, dx, 0, dw, sky);
        ctx.drawImage(image, sx, 20, sw, image.height - 20, dx, sky, dw, height - sky);
      };
      if (this.width > width && ZONES[z].panoramaFill) {
        // Extend an unoccupied stretch of horizon so a wide camera gets one moon or Ferris wheel.
        const [a, b] = ZONES[z].panoramaFill, scale = width / image.width;
        const travel = width - W, start = -Math.round((1 - Math.cos(G.hillOffset * 2 * Math.PI)) * travel / 2);
        const left = start + Math.round(a * scale), right = start + this.width + travel - Math.round((image.width - b) * scale);
        const span = right - left;
        const pairs = Math.round((span / ((b - a) * scale) - 1) / 2), pieces = 2 * pairs + 1;
        paint(0, a, start, left - start);
        for (let i = 0; i < pieces; i++) {
          const x1 = left + Math.round(i * span / pieces), x2 = left + Math.round((i + 1) * span / pieces);
          if (i % 2) {
            ctx.save(); ctx.translate(x2, 0); ctx.scale(-1, 1);
            paint(a, b - a, 0, x2 - x1); ctx.restore();
          } else paint(a, b - a, x1, x2 - x1);
        }
        paint(b, image.width - b, right, Math.round((image.width - b) * scale));
        return;
      }
      const x = Math.floor(((G.hillOffset % 1 + 1) % 1) * width);
      for (let left = -x; left < this.width; left += width) {
        paint(0, image.width, left, width);
      }
    };
    if (blend < 1) panorama(previous, 1);
    panorama(zi, blend, backdrop);
    ctx.globalAlpha = 1;
    // The sky gets warmer as the dawn clock runs down.
    if (G.dawnT > 0) {
      ctx.fillStyle = U.rgba('#ff937c', G.dawnT * 0.09);
      ctx.fillRect(0, 0, this.width, H);
    }
  },

  // --------------------------------------------------------------- ROAD ---
  road(G, baseSeg, basePercent, playerY) {
    const segs = Track.segments;
    let maxy = H;
    const bend = seg => seg.curve * (seg.zone === 1 ? 1.45 : 1);
    let x = 0, dx = -bend(baseSeg) * basePercent;
    const camX = G.playerX * Track.find(G.position + PLAYER_Z).halfWidth, camY = playerY + CAM_H, camZ = G.position;
    for (let n = 0; n < DRAW_DIST; n++) {
      const seg = segs[baseSeg.index + n];
      if (!seg) break;
      seg.clip = maxy;
      project(seg.p1, camX - x, camY, camZ, this.horizon, seg.halfWidth, this.width);
      project(seg.p2, camX - x - dx, camY, camZ, this.horizon, (segs[seg.index + 1] || seg).halfWidth, this.width);
      seg.rdx = dx;               // lateral drift per segment = road heading (for car views)
      x += dx;
      dx += bend(seg);
      if (seg.p1.camera.z <= CAM_DEPTH || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy) continue;
      this.rows(seg, maxy, camZ);
      maxy = seg.p2.screen.y;
    }
  },

  rows(seg, maxy, camZ) {
    const ctx = this.ctx;
    const p1 = seg.p1.screen, p2 = seg.p2.screen;
    const y1 = p1.y, y2 = p2.y;
    const step = this.rowStep, width = this.width;
    const yStart = Math.max(0, Math.ceil(y2 / step) * step);
    const yEnd = Math.min(Math.ceil(y1), Math.ceil(maxy), H);
    if (yEnd <= yStart) return;
    const zone = ZONES[seg.zone];
    const fog = this.fogCache[zone.id], fogK = zone.fogK || 1;
    const iz1 = 1 / seg.p1.camera.z, iz2 = 1 / seg.p2.camera.z, dy = y1 - y2;
    const fogMax = DRAW_DIST * SEG;
    const bg = A.bg[seg.zone], surface = seg.finishApron ? A.finish.paving : bg[seg.surface || 'road'];
    const bridge = !!seg.textureSpan, tunnel = seg.surface === 'temple' || seg.surface === 'bore';
    const ground = bridge ? bg.ravineGround : tunnel ? surface : bg.ground;
    const period = zone.tileSegments * SEG;
    // A far segment can fit an entire stretch of cobbles in a pixel. Average
    // the painting at that depth so its joints and wood grain stay steady in motion.
    const textureSegments = bridge ? seg.textureSpan.length : zone.tileSegments;
    const textureWidth = Math.max(12, Math.min(p2.w * 2 * TEX_SPAN, dy * textureSegments * surface.width / surface.height));
    const road = this.sourceAtSize(surface, textureWidth);
    for (let y = yStart; y < yEnd; y += step) {
      const t = U.limit((y1 - (y + 0.5)) / dy, 0, 1);
      const xc = p1.x + (p2.x - p1.x) * t;
      const w = p1.w + (p2.w - p1.w) * t;
      const zc = 1 / (iz1 + (iz2 - iz1) * t);
      const wz = zc + camZ;
      const band = Math.floor(wz / (SEG * 2)) & 1;
      const verge = w * zone.vergeW;
      const edge = w * TEX_SPAN;
      const depth = zc / SEG;
      // A visible terrain row occludes the panorama across the whole screen,
      // even when a crest rises above the horizon or the road bends out of view.
      ctx.fillStyle = bridge ? '#403855' : tunnel ? '#292237' : zone.groundBands[band];
      ctx.fillRect(0, y, width, step);
      if (zone.pavementBands && xc > edge) {
        ctx.fillStyle = zone.pavementBands[band];
        ctx.fillRect(0, y, Math.min(width, Math.ceil(xc - edge)), step);
      }
      if (bridge) {
        this.groundRow(ground, wz, xc, w, y, 0, width);
      } else if (xc > edge || xc + edge < width) {
        const far = U.limit((depth - 19) / (seg.zone === 3 ? 42 : 56), 0, 1);
        ctx.globalAlpha = 0.85 - 0.52 * far;
        if (xc > edge) this.groundRow(bg.pavement || ground, wz, xc, w, y, 0, Math.min(width, xc - edge + 1));
        if (xc + edge < width) this.groundRow(ground, wz, xc, w, y, Math.max(0, xc + edge - 1), width);
        ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = tunnel ? '#3c3447' : zone.verge[band];
      if (!bridge) ctx.fillRect(xc - verge, y, verge * 2, step);
      ctx.globalAlpha = 1;
      // Alternate the direction of the painting so the adjoining rows meet
      // exactly, including loose stones and the ends of the boardwalk planks.
      const phase = (wz / period) % 2;
      const texY = bridge ? 1 - (wz / SEG - seg.textureSpan.from) / seg.textureSpan.length : phase < 1 ? phase : 2 - phase;
      const tr = U.limit(Math.floor(texY * road.height), 0, road.height - 1);
      ctx.drawImage(road, 0, tr, road.width, 1, xc - edge, y, edge * 2, step);
      if (seg.index === Track.finishSeg - 1 || seg.index === Track.finishSeg - 2) {
        const stripe = A.finish.stripe;
        const across = U.limit((Track.finishSeg - wz / SEG) / 2, 0, 1);
        ctx.drawImage(stripe, 0, Math.round((stripe.height - 1) * across), stripe.width, 1, xc - w, y, 2 * w, step);
      }
      // distance haze
      const f = zc / fogMax;
      if (f > 0.16 / fogK) {
        ctx.fillStyle = fog[Math.min(32, Math.floor((f * fogK - 0.16) * 1.35 * 32))];
        ctx.globalAlpha = 0.35;
        ctx.fillRect(0, y, width, step);
        ctx.globalAlpha = 1;
        ctx.fillRect(xc - verge, y, 2 * verge, step);
      }
    }
  },

  // Repeat the terrain in world coordinates. Eight copies share one draw call
  // on most scanlines, including the thin slivers outside the kerbs.
  groundRow(tile, wz, xc, roadWidth, y, from, to) {
    let strip = this.strips.get(tile);
    if (!strip) {
      strip = document.createElement('canvas');
      strip.width = tile.width * 8; strip.height = tile.height;
      const g = strip.getContext('2d');
      for (let i = 0; i < 8; i++) g.drawImage(tile, i * tile.width, 0);
      this.strips.set(tile, strip);
    }
    const width = Math.max(9, roadWidth * 1.85);
    const row = Math.floor((wz / (SEG * 10) % 1) * tile.height);
    const scale = width / tile.width;
    let sx = ((from - xc) / scale % tile.width + tile.width) % tile.width;
    for (let x = from; x < to; sx = 0) {
      const dw = Math.min(to - x, (strip.width - sx) * scale);
      this.ctx.drawImage(strip, sx, row, dw / scale, 1, x, y, dw, this.rowStep);
      x += dw;
    }
  },

  // ------------------------------------------------------------ SPRITES ---
  sprites(G, baseSeg, playerSeg, playerPercent) {
    const segs = Track.segments;
    const fadeFrom = DRAW_DIST * 0.75;
    for (let n = DRAW_DIST - 1; n > 0; n--) {
      const seg = segs[baseSeg.index + n];
      if (!seg || seg.p1.camera.z <= CAM_DEPTH) continue;
      const haze = 1 - 0.44 * U.limit((n - 36) / 140, 0, 1);
      const alpha = n > fadeFrom ? haze * (DRAW_DIST - n) / (DRAW_DIST - fadeFrom) : haze;
      const scale = seg.p1.screen.scale;
      for (const sp of seg.sprites) {
        if (sp.name === 'turbo_potion' && G.collectedPotions.has(sp)) continue;
        if (sp.frontage) {
          this.frontage(seg, sp, alpha);
          continue;
        }
        const pose = sp.obstacle && Track.hazardPose(sp, G.elapsed);
        const sx = seg.p1.screen.x + seg.p1.screen.w * (pose ? pose.offset : sp.offset);
        const sy = seg.p1.screen.y - (pose ? pose.lift * scale * (PLAYER_BASE - this.horizon) : 0);
        this.sprite(sp, scale, sx, sy, seg.clip, alpha, pose ? pose.height : 1);
      }
      const cars = seg.cars.length > 1 ? [...seg.cars].sort((a, b) => b.z - a.z) : seg.cars;
      let drawPlayer = seg === playerSeg && G.showPlayer !== false;
      for (const car of cars) {
        if (car === G.localCar) continue;
        // A car we have passed must not fill the space between our own bumper and camera.
        if (G.localCar && car.z < G.localCar.z) continue;
        if (drawPlayer && car.percent < playerPercent) {
          this.player(G, playerSeg, playerPercent);
          drawPlayer = false;
        }
        const s = U.lerp(seg.p1.screen.scale, seg.p2.screen.scale, car.percent);
        const sx = U.lerp(seg.p1.screen.x, seg.p2.screen.x, car.percent) + U.lerp(seg.p1.screen.w, seg.p2.screen.w, car.percent) * car.offset;
        const sy = U.lerp(seg.p1.screen.y, seg.p2.screen.y, car.percent) + (car.bounce || 0);
        // Select the painted view from road heading, camera angle and lane change.
        const heading = Math.atan2(seg.rdx || 0, SEG);
        const view = Math.atan(((sx - this.width / 2) / (W / 2)) / CAM_DEPTH);
        const drift = Math.atan2((car.turn || 0) * seg.halfWidth, Math.max(3000, car.speed));
        const yaw = heading - view + drift;
        const lastYaw = this.cameraYaws ? this.cameraYaws.get(car) : car.yawS;
        const smoothYaw = lastYaw == null ? yaw : U.lerp(lastYaw, yaw, 0.3);
        if (this.cameraYaws) this.cameraYaws.set(car, smoothYaw); else car.yawS = smoothYaw;
        const f = car.pose ?? U.limit(Math.round(smoothYaw / (Math.PI / 8)), -3, 3);
        const top = this.vehicle(car.vehicle, f, s, sx, sy, seg.clip, alpha);
        if (car.driver && n < 48 && top < seg.clip && sx > 0 && sx < this.width) {
          this.text(seatName(car.seat), sx, top - 3, Math.max(12, 20 - n / 4), SEAT_COLORS[car.seat], {align: 'center', lw: 2});
        }
      }
      if (drawPlayer) this.player(G, playerSeg, playerPercent);
    }
  },

  sprite(sp, scale, x, y, clipY, alpha, height) {
    const img = A.get(sp.name, sp.flip), def = SPRITES[sp.name];
    const sign = sp.sign ? sp : def.caption || (I18n.language !== 'en' && def.sign);
    if (img) this.blit(img, sp.w, scale, x, y, -sp.anchor, clipY, alpha, height, sign);
  },

  frontage(seg, sp, alpha) {
    const a = seg.p1.screen, b = seg.p2.screen, wall = sp.frontage;
    const x1 = a.x + a.w * sp.offset, x2 = b.x + b.w * sp.offset;
    const left = Math.max(0, Math.round(Math.min(x1, x2)));
    const right = Math.min(this.width, Math.round(Math.max(x1, x2)));
    if (right <= left) return;
    const img = A.img[sp.name], srcY = Math.round(img.height * wall.cropTop);
    const srcH = img.height - srcY, za = seg.p1.camera.z, zb = seg.p2.camera.z;
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    for (let x = left; x < right; x += 2) {
      const step = Math.min(2, right - x);
      const t = U.limit((x + step / 2 - x1) / (x2 - x1), 0, 1);
      const depthT = (t / zb) / U.lerp(1 / za, 1 / zb, t);
      const u = U.lerp(wall.from, wall.to, depthT);
      const bottom = U.lerp(a.y, b.y, t), height = U.lerp(a.scale, b.scale, t) * wall.height * W / 2;
      const show = Math.min(height, seg.clip - (bottom - height));
      if (show <= 0) continue;
      const sx = Math.min(img.width - 1, Math.floor(u * img.width));
      ctx.drawImage(img, sx, srcY, 1, srcH * show / height, x, bottom - height, step, show);
    }
    ctx.globalAlpha = 1;
  },

  // Area-average fine artwork before the final nearest-neighbour scaling.
  // Small gravestones, tree branches and lettering keep a silhouette in motion.
  sourceAtSize(img, width) {
    while (img.width >= 2 * width && img.width > 2 && img.height > 2) {
      let half = this.halfSize.get(img);
      if (!half) {
        half = document.createElement('canvas');
        half.width = Math.ceil(img.width / 2); half.height = Math.ceil(img.height / 2);
        const g = half.getContext('2d');
        // Filter the isolated view at its original pixel boundaries.
        const source = img.atlas ? A.copyFrame(img) : img;
        g.drawImage(source, 0, 0, half.width, half.height);
        this.halfSize.set(img, half);
      }
      img = half;
    }
    return img;
  },

  // draw a bitmap standing on (x, y), scaled for its depth, clipped by hills
  blit(img, worldW, scale, x, y, ax, clipY, alpha, heightScale = 1, sign) {
    const dw = worldW * scale * W / 2;
    if (dw < 0.8 || dw > W * 8) return;
    const dh = dw * img.height / img.width * heightScale;
    const dx = x + dw * ax, dy = y - dh;
    if (dx > this.width || dx + dw < 0 || dy > H) return;
    const clipH = clipY ? Math.max(0, dy + dh - clipY) : 0;
    if (clipH >= dh - 0.5) return;
    const ctx = this.ctx;
    if (alpha < 1) ctx.globalAlpha = alpha;
    const src = this.sourceAtSize(img, dw);
    A.drawFrame(ctx, src, dx, dy, dw, dh - clipH, 1 - clipH / dh);
    if (sign && dw >= 12) {
      ctx.save();
      ctx.beginPath(); ctx.rect(dx, dy, dw, dh - clipH); ctx.clip();
      ctx.translate(dx, dy); ctx.scale(dw / img.width, dh / img.height);
      this.signLettering(sign, img.width, img.height);
      ctx.restore();
    }
    if (alpha < 1) ctx.globalAlpha = 1;
  },

  // The coordinates follow the lettering panels in the original PNGs.
  // Draw the translation in the same projection and depth pass as the sign.
  signLettering(sign, width, height) {
    const ctx = this.ctx;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const line = (key, x, y, size, width, color, shadow) => {
      ctx.font = this.font(size);
      const text = tr(key);
      ctx.fillStyle = shadow; ctx.fillText(text, x + 1, y + 2, width);
      ctx.fillStyle = color; ctx.fillText(text, x, y, width);
    };
    const face = (color, points) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(...points[0]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
      ctx.closePath(); ctx.fill();
    };
    if (sign.panel) {
      const [cx, cy, w, h] = sign.panel;
      const lineH = h * height / sign.lines.length;
      ctx.fillStyle = '#322235'; ctx.fillRect((cx - w / 2) * width, (cy - h / 2) * height, w * width, h * height);
      sign.lines.forEach((key, i) => line(key, cx * width, (cy - h / 2) * height + (i + .82) * lineH,
        lineH * .87, w * width - 4, '#ffe7aa', '#261931'));
    } else if (sign === 'motel') {
      if (tr('sign.motel') !== I18n.catalogs.en.strings['sign.motel']) {
        face('#790554', [[24,115], [200,124], [196,173], [27,171]]);
        line('sign.motel', 111, 161, 39, 162, '#fff0fb', '#ff25b5');
      }
      face('#390423', [[58,186], [170,186], [165,202], [64,202]]);
      line('sign.vacancy', 114, 199, 15, 99, '#fff2cf', '#a21a5c');
    } else if (sign === 'carnival') {
      face('#930546', [[33,155], [55,146], [79,119], [91,116], [249,116], [263,122], [284,146], [306,152],
        [309,222], [299,227], [275,223], [245,212], [207,204], [166,202], [125,205], [91,216], [59,229], [28,223]]);
      line('sign.carnivalTop', 170, 154, 40, 189, '#ffde5c', '#762207');
      line('sign.carnivalBottom', 171, 198, 48, 253, '#ffd447', '#712609');
    } else if (sign === 'epitaph') {
      ctx.translate(160, 196); ctx.rotate(0.19);
      ctx.fillStyle = '#715f86'; ctx.fillRect(-64, -32, 128, 64);
      ctx.strokeStyle = '#59486c'; ctx.lineWidth = 2; ctx.strokeRect(-62, -30, 124, 60);
      line('sign.epitaph', 0, 14, 37, 112, '#21162d', '#a18bb6');
    } else if (sign === 'sign.finish') {
      ctx.fillStyle = '#1b061b'; ctx.fillRect(185, 38, 170, 34);
      line(sign, 270, 66, 33, 165, '#ffd648', '#8d330b');
    } else {
      ctx.fillStyle = '#1b061b'; ctx.fillRect(75, 38, 390, 34);
      line(sign.sign || sign, 270, 59, 25, 379, '#ffd648', '#8d330b');
      line(sign.start || sign === 'sign.rally' ? 'sign.start' : 'sign.checkpoint', 270, 71, 12, 328, '#f8eaf9', '#47143c');
    }
  },

  // Zero faces away, positive turns right. Traffic has one painted turn per side.
  vehicle(id, f, scale, x, y, clipY, alpha) {
    const traffic = A.traffic[id];
    const frame = traffic ? traffic[1 + Math.sign(f)] : A.frame(id, f);
    const rear = f === 0 && A.raceRear[id];
    const img = rear || frame;
    const hearse = id === 'hearse';
    const bikeWidth = id === 'werewolf' && f ? 0.89 : 1;
    const worldW = traffic ? TRAFFIC_MODELS[id].w * frame.width / traffic[1].width :
      frame.width * VEHICLE_PX * VEHICLES[id].scale * (hearse ? 1.07 : bikeWidth);
    const dw = worldW * scale * W / 2;
    const heightScale = 1 / bikeWidth;
    const dh = dw * img.height / img.width * heightScale;
    const lean = id === 'werewolf' && f ? U.limit(f * 0.085, -0.2, 0.2) : 0;
    if (dw > 3 && (!clipY || y <= clipY + 1)) {
      const ctx = this.ctx;
      let cx = x, cy = y - dw * 0.009, length = dw * 0.49, angle = 0;
      if (f && dw >= 18) {
        const tyres = A.contacts(img);
        if (tyres.length === 2) {
          const [[u1, v1], [u2, v2]] = tyres;
          const dx = (u2 - u1) * dw - lean * (v2 - v1) * dh, dy = (v2 - v1) * dh;
          cy = y + ((v1 + v2) / 2 - 1) * dh;
          cx = x + ((u1 + u2) / 2 - 0.5) * dw - lean * (cy - y);
          angle = Math.atan2(dy, dx);
          length = Math.max(dw * 0.25, Math.hypot(dx, dy) * 0.62);
        }
      }
      ctx.globalAlpha = 0.65 * alpha;
      ctx.fillStyle = '#06020e';
      ctx.beginPath(); ctx.ellipse(cx, cy, length, Math.max(1, dw * 0.026), angle, 0, 2 * Math.PI); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (lean) {
      this.ctx.save();
      this.ctx.transform(1, 0, -lean, 1, lean * y, 0);
    }
    this.blit(img, worldW, scale, x, y, -0.5, clipY, alpha, heightScale);
    if (lean) this.ctx.restore();
    return y - dh;
  },

  player(G, playerSeg, playerPercent) {
    const s = CAM_DEPTH / PLAYER_Z;
    const camY = U.lerp(playerSeg.p1.camera.y, playerSeg.p2.camera.y, playerPercent);
    const speedPct = G.speed / MAX_SPEED;
    const offroad = Math.abs(G.playerX) > 1;
    const bounce = G.frozen ? 0 : (Math.random() * speedPct * (offroad ? 4 : 1.4)) * (Math.random() < 0.5 ? -1 : 1);
    const y = this.horizon - s * camY * (PLAYER_BASE - this.horizon) + bounce;
    const chaseScale = VEHICLES[G.vehicle].chaseScale ?? 1;
    const pose = U.limit(Math.round(G.yawS || 0), -3, 3);
    this.vehicle(G.vehicle, pose, s * chaseScale, this.width / 2, y, 0, 1);
    // off-road dust
    if (!G.frozen && offroad && G.speed > 1000) {
      const ctx = this.ctx;
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i & 1 ? 'rgba(200,180,255,0.35)' : 'rgba(120,255,160,0.3)';
        const px = this.width / 2 + (Math.random() - 0.5) * 200, py = y - Math.random() * 20;
        ctx.fillRect(px, py, 6 + Math.random() * 10, 4 + Math.random() * 6);
      }
    }
  },

  // The finish camera looks across the timing line. Every car here is drawn
  // from its live position, including late arrivals and cars at rest.
  finishArea(driver) {
    const ctx = this.ctx, art = A.finish.arena;
    const scale = Math.min(this.width / W, 1);
    ctx.save();
    ctx.fillStyle = '#120b1d'; ctx.fillRect(0, 0, this.width, H);
    ctx.translate((this.width - W * scale) / 2, (H - H * scale) / 2);
    ctx.scale(scale, scale);
    ctx.drawImage(art, 0, 0, W, H);
    const field = driver.localCar ? Local.entries : [...driver.cars, driver.finishCar];
    const finishers = field.filter(car => car.finished).sort((a, b) => b.z - a.z);
    for (const car of finishers) {
      const depth = car.z / SEG - Track.finishSeg;
      const perspective = 1 / (1 + depth / 78), pixels = .19 * perspective;
      const x = W / 2 + car.offset * Track.find(car.z).halfWidth * .127 * perspective;
      const y = 160 + 365 * perspective;
      this.vehicle(car.vehicle, car.pose || 0, pixels / (W / 2), x, y, 0, 1);
      if (car.driver) this.text(seatName(car.seat), x, y + 12, 12, SEAT_COLORS[car.seat], { align: 'center', lw: 2 });
    }
    ctx.restore();
  },

  finishHud(driver, solo) {
    this.text(tr('result.finish'), 12, 29, 25, this.yellow(29, 25));
    this.text(tr('result.place', { rank: driver.rank, total: 8 }), W / 2, 25, 17, '#ffe9a8', { align: 'center' });
    this.text(tr('result.time', { time: I18n.seconds(driver.finishedAt, 2) }), W - 12, 25, 17, '#fff0d4', { align: 'right' });
    if (solo && driver.finishCar.parked) {
      this.text(tr('result.summary', { won: driver.trialsWon, total: Track.trials.length, passes: driver.nearMisses }),
        12, H - 12, 14, '#9ff5db', { maxWidth: W * .57 });
      this.text(tr('result.continue'), W - 12, H - 12, 15, '#ffe9a8', { align: 'right', maxWidth: W * .37 });
    }
  },

  // "arcade resolution" filter: resample the scene to 320x240 then blow it
  // back up with nearest-neighbour (Power Drift / OutRun ran at ~320x224)
  pixelate(ctx = this.ctx) {
    const { width, height } = ctx.canvas;
    const w = Math.ceil(width / 2), h = Math.ceil(height / 2);
    if (!this.low) {
      this.low = document.createElement('canvas');
      this.lctx = this.low.getContext('2d');
    }
    if (this.low.width !== w || this.low.height !== h) {
      this.low.width = w; this.low.height = h;
    }
    this.lctx.imageSmoothingEnabled = false;   // nearest, like the real scaler hardware
    this.lctx.drawImage(ctx.canvas, 0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.low, 0, 0, width, height);
  },

  // ---------------------------------------------------------------- HUD ---
  font(size) {
    const cjk = I18n.language === 'ja' || I18n.language === 'zh-CN';
    const style = cjk ? (size < 16 ? '600' : '700') : 'italic 900';
    return `${style} ${size}px ${I18n.fonts}`;
  },
  grad(y, size, stops) {
    const g = this.ctx.createLinearGradient(0, y - size * 0.8, 0, y);
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    return g;
  },
  yellow(y, size) { return this.grad(y, size, ['#fffbd0', '#ffe14a', '#ffb012', '#ff8a00']); },
  text(str, x, y, size, fill, opts = {}) {
    const ctx = this.ctx;
    ctx.font = this.font(size);
    ctx.textAlign = opts.align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    const lw = opts.lw || Math.max(3, Math.round(size / 6));
    const width = opts.maxWidth ?? W - 28;
    ctx.fillStyle = '#07020f';
    ctx.fillText(str, x + Math.max(2, size / 14), y + Math.max(2, size / 12), width);
    ctx.strokeStyle = opts.stroke || '#140a24';
    ctx.lineWidth = lw;
    ctx.strokeText(str, x, y, width);
    ctx.fillStyle = fill;
    ctx.fillText(str, x, y, width);
  },

  raceLabel(key, x, y, width, height) {
    if (I18n.language !== 'en' && key !== 'field') {
      const label = 'hud.' + key;
      if (tr(label) !== I18n.catalogs.en.strings[label]) {
        const ink = key === 'speedUnit' ? this.yellow(y + height, height) : '#fff2ff';
        this.text(tr(label), x + width / 2, y + height - 3, height - 1, ink, { align: 'center', maxWidth: width, lw: 3 });
        return;
      }
    }
    const [sx, sw, sh] = RACE_LABELS[key];
    this.ctx.drawImage(A.ui.raceLabels, sx, 0, sw, sh, x, y, width, height);
  },

  digits(value, x, y, height, align = 'left') {
    const str = String(value), scale = height / 38 * 0.94;
    let width = 5 * scale;
    for (const digit of str) width += (DIGIT_WIDTHS[digit] - 5) * scale;
    if (align === 'center') x -= width / 2;
    if (align === 'right') x -= width;
    for (const digit of str) {
      const w = DIGIT_WIDTHS[digit];
      this.ctx.drawImage(A.ui.raceDigits, Number(digit) * 40, 0, w, 38,
        Math.round(x), y, Math.round(w * scale), height);
      x += (w - 5) * scale;
    }
  },

  hud(G) {
    this.raceLabel('pos', 15, 7, 53, 24);
    this.digits(G.rank, 79, 4, 31);
    this.raceLabel('field', 104, 6, 36, 28);
    this.raceLabel('time', W / 2 - 33, 4, 66, 18);
    this.digits(G.clockSeconds, W / 2, 24, 39, 'center');
    this.logo(W - 7, 3, 1);
    this.digits(Math.round(G.speed / MAX_SPEED * KMH), W - 64, H - 49, 36, 'right');
    this.raceLabel('speedUnit', W - 65, H - 39, 56, 25);
    if (G.state === 'race' || G.state === 'countdown' || G.state === 'shot') this.turboGauge(G);
    if (G.state === 'countdown') this.text(Track.itinerary(), W / 2, 95, 15, '#ffe8ae', { align: 'center', maxWidth: W - 32 });
    if (G.state === 'race') {
      const remaining = G.checkpointNoticeUntil - G.elapsed;
      if (remaining > 0) {
        this.ctx.save();
        this.ctx.globalAlpha = Math.min(1, remaining / 0.25);
        this.text(G.checkpointMessage, W / 2 + 59, 34, 20, '#8dffdc', { maxWidth: 109 });
        this.ctx.restore();
      }
      this.trialPanel(G, 43, W / 2 - 64);
      if (G.elapsed < G.offroadNoticeUntil) {
        this.text(G.offroadMessage, W / 2 + 45, 53, 13, '#ffab87', { maxWidth: 133 });
      }
    }
  },

  turboGauge(G) {
    const {x, y, w, h} = TURBO_BUTTON, ctx = this.ctx;
    const active = G.turboLeft > 0;
    ctx.fillStyle = '#160b21e8';
    ctx.fillRect(x, y, w, h);
    const color = active ? '#ffce4d' : G.charge ? '#68ffe3' : '#cab6d7';
    this.text(tr('hud.turbo'), x + 6, y + 21, 17, color, { maxWidth: 54 });
    const iconWidth = 18, iconX = x + w - 55;
    const icon = this.sourceAtSize(A.img.turbo_potion, iconWidth);
    ctx.drawImage(icon, iconX, y + 2, iconWidth, Math.round(iconWidth * icon.height / icon.width));
    this.text(`${G.charge}/${TURBO_CAPACITY}`, x + w - 6, y + 21, 16, '#fff3cc', { align: 'right', maxWidth: 27 });
    const shortcut = G.localCar ? 'X' : 'X / ␣';
    this.text(active ? tr('hud.active') : shortcut, x + 7, y + 37, 12, color, { maxWidth: 28, lw: 2 });
    const gap = 3, barWidth = Math.floor((w - 45 - gap * (TURBO_CAPACITY - 1)) / TURBO_CAPACITY);
    for (let i = 0; i < TURBO_CAPACITY; i++) {
      const left = x + 38 + i * (barWidth + gap);
      ctx.fillStyle = '#5e486f'; ctx.fillRect(left, y + 28, barWidth, 9);
      if (i < G.charge) {
        ctx.fillStyle = '#32daba'; ctx.fillRect(left, y + 28, barWidth, 9);
        ctx.fillStyle = '#aefff2'; ctx.fillRect(left, y + 28, barWidth, 2);
      }
    }
    if (G.elapsed < G.potionNoticeUntil) {
      this.text('+1', iconX, y - 6, 17, '#c4ff60');
    } else if (G.passFlash > 0) {
      this.text(tr('hud.close'), x + 3, y - 7, 17, '#8dffdc');
    }
  },

  trialPanel(G, y = 66, maxWidth = this.width - 28) {
    const notice = G.trialNotice, trial = Track.trials[G.trialIndex];
    let title, detail, color = '#8bfff1';
    if (notice && G.elapsed < notice.until) {
      title = notice.title; detail = notice.text; color = notice.won ? '#ffe359' : '#ff9c9c';
    } else {
      if (!trial) return;
      const gate = trial.gates[G.trialGate], ahead = gate.seg * SEG - G.position - PLAYER_Z;
      if (!G.trialGate && ahead > TRIAL_APPROACH * SEG) return;
      const meters = Math.max(0, Math.ceil(ahead * KMH / (MAX_SPEED * 3.6) / 10) * 10);
      title = tr(trial.title);
      const distance = tr('unit.meters', { n: meters });
      if (trial.kind === 'slalom') {
        title += `   ${G.trialHits}/3`;
        detail = tr('trial.direction', { side: tr(gate.x < 0 ? 'trial.left' : 'trial.right'), distance });
        if (!G.trialGate) detail += ' · ' + tr('trial.minGates');
      } else if (trial.kind === 'radar') {
        detail = tr('trial.speedTarget', { speed: trial.kmh, distance }); color = '#ffd96a';
      } else if (trial.kind === 'clean') {
        detail = tr(G.trialGate ? 'trial.cleanActive' : 'trial.cleanStart', { distance });
      } else {
        const left = G.trialGate ? Math.max(0, trial.limit - G.elapsed + G.trialStart) : trial.limit;
        detail = tr(G.trialGate ? 'trial.sprintActive' : 'trial.sprintStart', { time: I18n.seconds(left, 1), distance });
      }
    }
    const ctx = this.ctx, x = 14;
    ctx.font = this.font(15);
    const titleW = ctx.measureText(title).width;
    ctx.font = this.font(13);
    const w = Math.min(maxWidth, Math.ceil(Math.max(titleW, ctx.measureText(detail).width)) + 21);
    ctx.fillStyle = '#160b21e8'; ctx.fillRect(x, y, w, 42);
    ctx.fillStyle = color; ctx.fillRect(x, y, 3, 42);
    this.text(title, x + 9, y + 17, 15, color, { maxWidth: w - 21 });
    this.text(detail, x + 9, y + 34, 13, '#fff5fa', { maxWidth: w - 21 });
  },

  logo(xr, y, k) {
    const w = Math.round(132 * k), h = Math.round(66 * k);
    this.ctx.drawImage(A.ui.logo, Math.round(xr - w), y, w, h);
  },

  // Countdown and start announcements.
  banner(text, sub, t) {
    const pop = Math.min(1, t * 5);
    const size = Math.round(52 * (0.6 + 0.4 * pop));
    this.text(text, W / 2, H * 0.42, size, this.yellow(H * 0.42, size), { align: 'center' });
    if (sub) this.text(sub, W / 2, H * 0.42 + 36, 22, '#ffffff', { align: 'center' });
  },

  overlay(alpha) {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(10,4,24,${alpha})`;
    ctx.fillRect(0, 0, W, H);
  },
};
