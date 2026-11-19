'use strict';
/* =========================================================
 * game.js — game state, physics, rivals AI, timers, input.
 * ========================================================= */
const ACCEL = MAX_SPEED / 5;
const BRAKE = -MAX_SPEED;
const DECEL = -MAX_SPEED / 5;
const OFFROAD_DECEL = -MAX_SPEED / 1.8;
const OFFROAD_LIMIT = MAX_SPEED / 4;
const OFFROAD_PENALTY = 2;     // checkpoint seconds per excursion
const OFFROAD_REARM = 0.94;    // return inside the edge before another excursion can count
const CENTRIFUGAL = 0.3;
const START_TIME = 50;
const CHECKPOINT_BONUS = [0, 40, 40, 42];
const DAWN_MAX = 165;
const VEHICLE_OVERLAP = 0.8;   // fraction of sprite width used for a vehicle bump
const PLAYER_NOSE = 1.55 * SEG; // ahead of the chase-camera tyre anchor
const NEAR_MISS_GAP = 215;  // space between the two hitboxes, in world units
const TURBO_CAPACITY = 2;
const TURBO_DURATION = 2.2;
const TRIAL_APPROACH = 195; // advance notice in road segments

const params = new URLSearchParams(location.search);

function trafficName(id) {
  return I18n.copy.vehicles[id]?.label ?? tr('traffic.' + id);
}

const G = {
  state: 'loading', audio: Sound,
  position: 0, playerX: 0, speed: 0, steer: 0,
  time: START_TIME, dawn: DAWN_MAX, dawnT: 0, elapsed: 0,
  rank: 8, stage: 0, cars: [], traffic: [], keys: {}, shake: 0, pixel: params.get('px') === '1',
  hillOffset: 0,
  msg: null, countdown: 0, results: null, auto: params.has('auto'),
  vehicle: Object.hasOwn(VEHICLES, params.get('car')) ? params.get('car') : 'hearse', yawS: 0,
  topSpeed: MAX_SPEED, accel: ACCEL, centrifugal: CENTRIFUGAL, armor: 3, playerW: 0.3,

  get clockSeconds() {
    return Math.max(0, Math.ceil(Math.min(this.time, this.dawn)));
  },

  // Checkpoints and penalties change the checkpoint deadline. Sunrise is fixed.
  adjustCheckpointTime(seconds) {
    const before = this.clockSeconds;
    this.time += seconds;
    return this.clockSeconds - before;
  },

  // the 4 stats (1..5) of the chosen vehicle tune the physics around the
  // hearse, which is the reference (speed 3, accel 2, grip 4, armor 5)
  setVehicle(id) {
    this.vehicle = id;
    const s = VEHICLES[id].stats;
    this.topSpeed = MAX_SPEED * (1 + (s.speed - 3) * 0.025);
    this.accel = ACCEL * (1 + (s.accel - 2) * 0.15);
    this.centrifugal = CENTRIFUGAL * (1 + (4 - s.grip) * 0.07);
    this.armor = s.armor;
    this.playerWorldWidth = A.vehicleWidth(id) * (VEHICLES[id].chaseScale ?? 1) * 0.87;
    this.playerW = this.playerWorldWidth / Track.find(this.position + PLAYER_Z).halfWidth;
  },

  reset(withTraffic = true, random = Math.random) {
    this.resetDriver();
    this.resetField([this.vehicle], withTraffic, random);
  },

  resetDriver() {
    this.position = 0; this.playerX = 0; this.speed = 0; this.steer = 0;
    this.time = START_TIME; this.dawn = DAWN_MAX; this.dawnT = 0; this.elapsed = 0;
    this.rank = 8; this.stage = 0; this.shake = 0; this.msg = null; this.results = null;
    this.iceLeft = 0; this.slide = 0; this.caughtBySnow = false;
    this.hillOffset = 0.19;
    this.frozen = false; this.finishedAt = 0; this.finishCar = null; this.yawS = 0;
    this.bumpedCar = null;
    this.offCourse = false; this.offroadNoticeUntil = 0; this.checkpointNoticeUntil = 0;
    this.offroadMessage = ''; this.checkpointMessage = '';
    this.charge = TURBO_CAPACITY; this.turboLeft = 0; this.turboStart = 0;
    this.collectedPotions = new Set(); this.potionNoticeUntil = 0;
    this.passedTraffic = new Set();
    this.nearMisses = 0; this.passFlash = 0;
    this.trialIndex = 0; this.trialGate = 0; this.trialHits = 0; this.trialsWon = 0;
    this.trialStart = 0; this.trialNotice = null;
    this.setVehicle(this.vehicle);
  },

  resetField(players, withTraffic = true, random = Math.random) {
    Track.segments.forEach(s => (s.cars.length = 0));
    this.cars = rivalGrid(players, random).map((r, i) => {
      const car = {
        name: r.name, vehicle: r.vehicle, w: A.vehicleWidth(r.vehicle), base: r.speed, gridSlot: players.length + i,
        offset: (i % 2 ? 0.45 : -0.45) + (i % 3 === 2 ? 0.1 : 0),
        z: (17 + i * 5) * SEG, speed: 0, percent: 0, finished: false, launch: 0.6 + i * 0.12,
      };
      Track.find(car.z).cars.push(car);
      return car;
    });
    this.traffic = [];
    if (withTraffic) this.placeTraffic(random, players);
  },

  addTraffic(vehicle, z, offset) {
    const model = TRAFFIC_MODELS[vehicle];
    const kmh = model?.kmh ?? 80 + 8 * VEHICLES[vehicle].stats.speed;
    const cruise = kmh / KMH * MAX_SPEED;
    const w = model?.w ?? A.vehicleWidth(vehicle);
    const car = { vehicle, traffic: true, w, z, previousZ: z, offset, cruise, speed: cruise,
      percent: U.percentRemaining(z, SEG) };
    this.traffic.push(car);
    Track.find(z).cars.push(car);
    return car;
  },

  placeTraffic(random = Math.random, players = [this.vehicle]) {
    const layout = mulberry32(31913), slots = [];
    let lane = 2;
    for (let seg = 68; seg < Track.finishSeg; seg += 104 + Math.floor(layout() * 70)) {
      slots.push({ z: seg * SEG, offset: (lane - 1) * 0.55 + (layout() - 0.5) * 0.10 });
      lane = (lane + 1 + Math.floor(layout() * 2)) % 3;
    }
    const racing = new Set([...players, ...this.cars.map(car => car.vehicle)]);
    const guests = U.shuffled(Object.keys(VEHICLES).filter(id => !racing.has(id)), random).slice(0, slots.length);
    // At cruising speed, traffic covers roughly half the course during a race.
    // Stagger its guests across that first half so overtakes run through the finish.
    const guestSlotCount = Math.max(guests.length, Math.ceil(slots.length / 2));
    guests.forEach((id, i) => {
      const first = Math.floor(i * guestSlotCount / guests.length);
      const end = Math.floor((i + 1) * guestSlotCount / guests.length);
      slots[first + Math.floor(random() * (end - first))].vehicle = id;
    });
    const regulars = U.shuffled(Object.keys(TRAFFIC_MODELS), random);
    let regular = 0;
    for (const slot of slots) {
      this.addTraffic(slot.vehicle ?? regulars[regular++ % regulars.length], slot.z, slot.offset);
    }
  },

  updateArrival(dt) {
    const car = this.finishCar;
    if (!this.localCar && this.cars.some(other => !other.parked)) {
      this.updateTraffic(dt);
      this.updateCars(dt, Track.find(car.z), this.elapsed);
    }
    Track.brakeIntoBay(car, dt);
    this.position = car.z - PLAYER_Z; this.playerX = car.offset; this.speed = car.speed;
    this.frozen = car.parked; this.elapsed += dt;
    if (!this.localCar) this.audio?.engine(car.speed / MAX_SPEED, !car.parked, false);
  },

  useTurbo() {
    if (this.state !== 'race' || this.charge < 1 || Math.abs(this.playerX) > 1 || (!this.auto && this.keys.down)) return;
    if (this.turboLeft === 0) this.turboStart = this.elapsed;
    this.charge--;
    this.turboLeft += TURBO_DURATION;
    this.audio?.turbo();
  },

  collectPotions(startZ, endZ, startX, claims) {
    if (endZ <= startZ) return;
    // Test the car's lateral position when its nose crosses each pickup, even at boost speed.
    for (let i = Math.ceil(startZ / SEG); i <= Math.floor(endZ / SEG); i++) {
      const seg = Track.segments[i];
      for (const sp of seg.sprites) {
        if (sp.name !== 'turbo_potion' || this.collectedPotions.has(sp)) continue;
        const at = (seg.p1.world.z - startZ) / (endZ - startZ);
        const x = U.lerp(startX, this.playerX, at);
        if (!U.overlap(x, this.playerWorldWidth / seg.halfWidth, sp.offset, sp.w / seg.halfWidth)) continue;
        if (claims) claims.push({driver: this, potion: sp, at});
        else this.takePotion(sp);
      }
    }
  },

  takePotion(potion) {
    if (this.collectedPotions.has(potion)) return;
    this.collectedPotions.add(potion);
    if (this.charge >= TURBO_CAPACITY) return;
    this.charge++;
    this.potionNoticeUntil = this.elapsed + 1.2;
    this.audio?.potion();
  },

  autoControls(seg, driving) {
    const z = this.position + PLAYER_Z, ahead = Track.find(z + 12 * SEG);
    const speedPct = this.speed / MAX_SPEED;
    let target = U.limit(ahead.curve * 0.10, -0.55, 0.55);
    let brake = !driving && speedPct > 0.15;
    if (driving) {
      const trial = Track.trials[this.trialIndex], gate = trial?.gates[this.trialGate];
      const distance = gate ? gate.seg - seg.index : Infinity;
      if (trial?.kind === 'slalom' && distance >= 0 && distance < 55) target = gate.x;

      // Pick a gap in the whole group. Looking only at the closest bumper can
      // steer the demo back across a second vehicle during the same overtake.
      const obstacles = [];
      for (let n = Math.max(0, seg.index - 1); n <= Math.min(seg.index + 55, Track.segments.length - 1); n++) {
        const road = Track.segments[n];
        for (const sp of road.hazards || []) {
          const seconds = (n * SEG - z) / Math.max(this.speed, 1);
          if (seconds < 0 || seconds > 1.4) continue;
          const pose = Track.hazardPose(sp, this.elapsed + seconds);
          if (!pose.active) continue;
          for (const [center, span] of sp.obstacle.bands || BODY_BAND) {
            const x = pose.offset + center * sp.w / road.halfWidth;
            const margin = (this.playerWorldWidth + sp.w * span) * .52 / road.halfWidth;
            obstacles.push({ x, margin, seconds });
          }
        }
        for (const car of road.cars) {
          if (car === this.localCar) continue;
          const gap = car.z - z, closing = this.speed - car.speed;
          if (closing <= 0 || gap < -SEG * 0.3) continue;
          const seconds = Math.max(0, gap - PLAYER_NOSE) / closing;
          if (seconds > (car.traffic ? 1.25 : 0.45)) continue;
          const margin = (car.w + this.playerWorldWidth) * 0.5 / road.halfWidth + 0.14;
          obstacles.push({ x: car.offset, margin, seconds });
        }
      }
      if (obstacles.length) {
        const ideal = target;
        let best = Infinity;
        for (const lane of [ideal, -0.85, -0.58, -0.30, 0, 0.30, 0.58, 0.85]) {
          let cost = Math.abs(lane - ideal) * 0.45 + Math.abs(lane - this.playerX) * 0.70;
          for (const o of obstacles) cost += 9 * Math.max(0, o.margin - Math.abs(lane - o.x)) / (0.18 + o.seconds);
          if (cost < best) { best = cost; target = lane; }
        }
        const bend = Math.max(Math.abs(ahead.curve), Math.abs(seg.curve));
        brake = bend * this.centrifugal * speedPct > 0.90 ||
          obstacles.some(o => o.seconds < 0.50 && Math.abs(this.playerX - o.x) < o.margin - 0.05 && Math.abs(target - this.playerX) > 0.19);
      }
      if (!brake && this.turboLeft === 0) {
        const radar = trial?.kind === 'radar' && distance >= 0 && distance < 76;
        const sprint = trial?.kind === 'sprint' && this.trialGate && !obstacles.length && Math.abs(ahead.curve) < 1.2;
        if (radar || sprint) this.useTurbo();
      }
    }
    const steer = (target - this.playerX) * 3 + seg.curve * this.centrifugal * speedPct;
    return { left: steer < -0.08, right: steer > 0.08, up: driving && !brake, down: brake };
  },

  // ------------------------------------------------------------- update ---
  update(dt, potionClaims) {
    if (this.state === 'finish') { this.updateArrival(dt); return; }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.5);
    if (this.msg) { this.msg.t += dt; if (this.msg.t > this.msg.life) this.msg = null; }

    if (this.state === 'countdown') {
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      const after = Math.ceil(this.countdown);
      if (after !== before && after > 0) this.audio?.beep(false);
      if (this.countdown <= 0) {
        this.state = 'race'; this.audio?.beep(true);
        this.msg = { text: tr('race.go'), sub: tr('race.beatDawn'), t: 0, life: 1.4 };
      }
      this.audio?.engine(0.05 + (this.keys.up ? 0.25 : 0), true, false);
      return;
    }
    if (this.state !== 'race' && this.state !== 'over') return;

    const playerSeg = Track.find(this.position + PLAYER_Z);
    this.playerW = this.playerWorldWidth / playerSeg.halfWidth;
    const startSpeed = this.speed, speedPct = startSpeed / MAX_SPEED;
    const dx = dt * 2 * speedPct;
    const startPos = this.position, startX = this.playerX;
    const driving = this.state === 'race';

    // Inputs for a live driver, the demo, or the game-over coast.
    const controls = driving && !this.auto ? this.keys : this.autoControls(playerSeg, driving);
    const { left, right, up, down } = controls;
    if (!this.localCar) {
      this.updateTraffic(dt);
      this.updateCars(dt, playerSeg);
    }
    this.position = Math.min(this.position + dt * this.speed, Track.length - (DRAW_DIST + 5) * SEG);

    this.steer = left ? -1 : right ? 1 : (controls.axis || 0);
    if (this.iceLeft > 0) {
      this.slide = U.lerp(this.slide, this.steer, Math.min(1, 2.3 * dt));
      this.iceLeft = Math.max(0, this.iceLeft - dt);
    } else this.slide = this.steer;
    this.playerX += this.slide * dx;
    this.playerX -= dx * speedPct * playerSeg.curve * this.centrifugal;
    // view of the car: 1 frame when steering, 2 when leaning into a fast curve
    const lean = this.steer && Math.sign(playerSeg.curve) === Math.sign(this.steer) && Math.abs(playerSeg.curve) > 1.5 && speedPct > 0.6 ? 2 : 1;
    this.yawS += (this.steer * lean - this.yawS) * Math.min(1, dt * 10);

    const lateral = Math.abs(this.playerX), offroad = lateral > 1;
    if (!driving || down || offroad) this.turboLeft = 0;
    const boosting = this.turboLeft > 0;
    if (boosting) this.speed += (this.accel + MAX_SPEED * 0.65) * dt;
    else if (down) this.speed = U.accelerate(this.speed, BRAKE * down, dt);
    else if (up) this.speed = U.accelerate(this.speed, this.accel * up, dt);
    else this.speed = U.accelerate(this.speed, DECEL, dt);

    if (playerSeg.surface === 'sand' && lateral > .62) this.speed *= 1 - .36 * dt;
    const startZ = startPos + PLAYER_Z, endZ = this.position + PLAYER_Z;
    const hazard = driving && Track.hazardContact(startZ, endZ, startX, this.playerX, this.playerWorldWidth, this.elapsed, dt);
    const wave = Track.avalancheZ(this.elapsed);
    const snow = driving && !this.caughtBySnow && wave !== null && endZ >= Track.avalanche.from * SEG && endZ <= wave;
    let impact = !!(hazard || snow);
    if (impact) {
      if (snow) this.caughtBySnow = true;
      if (hazard?.obstacle.effect === 'ice') {
        this.iceLeft = 1.45;
        this.slide = this.steer || (this.playerX < 0 ? -.62 : .62);
        this.speed *= .91;
      } else {
        this.speed *= snow ? .68 : .58;
        this.shake = .54; this.audio?.bump();
      }
    }
    if (offroad) {
      if (this.speed > OFFROAD_LIMIT) this.speed = U.accelerate(this.speed, OFFROAD_DECEL, dt);
      for (const sp of playerSeg.sprites) {
        if (!sp.hit) continue;
        const wU = sp.w / playerSeg.halfWidth;
        const left0 = sp.offset - sp.anchor * wU;
        const cx = left0 + (sp.flip ? 1 - sp.hit[0] : sp.hit[0]) * wU;
        if (U.overlap(this.playerX, this.playerW, cx, sp.hit[1] * wU)) {
          impact = true;
          if (this.speed > MAX_SPEED * 0.12) { this.audio?.crash(); this.shake = 1; }
          this.speed = Math.min(this.speed, MAX_SPEED * (0.08 + this.armor * 0.03));
          this.position = playerSeg.p1.world.z - PLAYER_Z;
          this.playerX += this.playerX > 0 ? -0.08 : 0.08;
          break;
        }
      }
    }
    impact = impact || this.bumpVehicle(startPos + PLAYER_Z, this.position + PLAYER_Z, startX);
    this.playerX = U.limit(this.playerX, -3, 3);
    if (impact) this.turboLeft = 0;
    const speedLimit = boosting && !impact ? this.topSpeed * 1.22 : Math.max(this.topSpeed, startSpeed - MAX_SPEED * 0.40 * dt);
    this.speed = U.limit(this.speed, 0, speedLimit);
    this.turboLeft = Math.max(0, this.turboLeft - dt);

    // parallax follows the curve under the car
    const moved = (this.position - startPos) / SEG;
    this.hillOffset += 0.00074 * playerSeg.curve * moved;

    if (!this.localCar) this.audio?.engine(this.speed / MAX_SPEED, true, offroad && this.speed > 500);

    // ranking
    const pz = this.position + PLAYER_Z;
    if (driving && !this.localCar) this.rank = 1 + this.cars.filter(c => c.z > pz).length;

    if (!driving) return;
    // timers
    this.elapsed += dt;
    this.passFlash = Math.max(0, this.passFlash - dt);
    this.time -= dt;
    this.dawn -= dt;
    this.dawnT = U.limit(1 - this.dawn / DAWN_MAX, 0, 1);

    // checkpoints
    const zNow = Track.find(pz).stage;
    if (zNow > this.stage) {
      this.stage = zNow;
      const gain = this.adjustCheckpointTime(CHECKPOINT_BONUS[zNow]);
      this.checkpointMessage = tr('race.checkpoint', { time: I18n.seconds(gain) });
      this.checkpointNoticeUntil = gain ? this.elapsed + 1.8 : 0;
      this.audio?.checkpoint();
    }
    // Sample the excursion before a roadside impact can nudge the car back in.
    if (lateral <= OFFROAD_REARM) this.offCourse = false;
    if (offroad && !this.offCourse) {
      this.offCourse = true;
      const loss = -this.adjustCheckpointTime(-OFFROAD_PENALTY);
      this.offroadMessage = loss ? tr('hud.offroad', { time: I18n.seconds(loss) }) : tr('trial.offroad');
      this.offroadNoticeUntil = this.elapsed + 1.7;
    }
    const closePasses = this.countClosePasses(startPos + PLAYER_Z, pz, startX);
    if (closePasses && !impact) {
      this.nearMisses += closePasses;
      this.charge = Math.min(TURBO_CAPACITY, this.charge + closePasses);
      this.passFlash = 1.25;
      this.audio?.closePass();
    }
    if (!impact) {
      this.collectPotions(startPos + PLAYER_Z + PLAYER_NOSE, pz + PLAYER_NOSE, startX, potionClaims);
    }
    this.advanceTrial(startPos + PLAYER_Z, pz, startX, startSpeed, dt, impact);
    // finish
    if (pz >= Track.finishSeg * SEG) {
      this.state = 'finish';
      this.turboLeft = 0;
      const stepDistance = this.position - startPos;
      this.finishedAt = this.elapsed - (stepDistance > 0 ? dt * U.limit((pz - Track.finishSeg * SEG) / stepDistance, 0, 1) : 0);
      const car = this.finishCar = this.localCar || { vehicle: this.vehicle, gridSlot: 0, w: this.playerWorldWidth, z: pz };
      if (!this.localCar) Track.find(pz).cars.push(car);
      Track.moveCar(car, pz);
      car.offset = this.playerX; car.speed = this.speed;
      Track.enterFinishArea(car, this.finishedAt);
      this.audio?.finish();
      const order = this.cars.filter(c => c.finished && c.finishedAt <= this.finishedAt).length;
      this.results = { rank: order + 1, time: this.finishedAt };
      this.rank = order + 1;
      return;
    }
    if (this.time <= 0) this.gameOver(tr('race.timeout'), tr('race.closed'));
    else if (this.dawn <= 0) this.gameOver(tr('race.sunrise'), tr('race.dust'));
  },

  gameOver(text, sub) {
    this.time = Math.max(0, this.time);
    this.dawn = Math.max(0, this.dawn);
    this.state = 'over';
    this.turboLeft = 0;
    this.results = { text, sub };
    this.audio?.lose();
  },

  finishTrial(trial, bonus, detail) {
    let gain = 0;
    if (bonus) {
      gain = this.adjustCheckpointTime(bonus);
      this.trialsWon++;
    }
    this.audio?.trialResult(bonus > 0);
    this.trialNotice = { title: tr(trial.title), text: detail + (gain ? '   +' + I18n.seconds(gain) : ''), won: bonus > 0, until: this.elapsed + 2.6 };
    this.trialIndex++;
    this.trialGate = 0; this.trialHits = 0;
  },

  advanceTrial(startZ, endZ, startX, startSpeed, dt, impact) {
    const trial = Track.trials[this.trialIndex];
    if (!trial) return;
    const gate = trial.gates[this.trialGate], line = gate.seg * SEG;
    const crossed = startZ <= line && endZ >= line && endZ > startZ;
    const fraction = crossed ? (line - startZ) / (endZ - startZ) : 1;
    const x = U.lerp(startX, this.playerX, fraction);
    const at = this.elapsed - dt * (1 - fraction);
    const active = this.trialGate > 0;

    if (trial.kind === 'clean' && (active || crossed) && (impact || Math.abs(x) > 1)) {
      this.finishTrial(trial, 0, tr(impact ? 'trial.contact' : 'trial.offroad'));
      return;
    }
    if (trial.kind === 'sprint' && active && at - this.trialStart > trial.limit) {
      this.finishTrial(trial, 0, tr('trial.timeout'));
      return;
    }
    if (!crossed) return;
    this.trialGate++;
    if (trial.kind === 'slalom') {
      const width = Track.segments[gate.seg].halfWidth;
      const room = SLALOM_HALF - (this.playerWorldWidth + SPRITES.trial_lantern.w) * 0.44 / width;
      if (!impact && Math.abs(x - gate.x) <= room) {
        this.trialHits++;
        this.audio?.gate();
      }
      if (this.trialGate === trial.gates.length) {
        const bonus = this.trialHits === 3 ? trial.bonus + 2 : this.trialHits === 2 ? trial.bonus : 0;
        this.finishTrial(trial, bonus, tr('trial.gates', { hits: this.trialHits }));
      }
    } else if (trial.kind === 'radar') {
      const kmh = Math.round(U.lerp(startSpeed, this.speed, fraction) / MAX_SPEED * KMH);
      const clean = Math.abs(x) <= 1 && !impact;
      const detail = clean ? tr('trial.speedResult', { speed: kmh, target: trial.kmh }) : tr(impact ? 'trial.radarContact' : 'trial.missed');
      this.finishTrial(trial, clean && kmh >= trial.kmh ? trial.bonus : 0, detail);
    } else if (Math.abs(x) > 1) {
      this.finishTrial(trial, 0, tr('trial.missed'));
    } else if (!active) {
      this.trialStart = at;
      this.audio?.gate();
    } else {
      const detail = trial.kind === 'sprint' ? I18n.seconds(at - this.trialStart, 1) : tr('trial.cleared');
      this.finishTrial(trial, trial.bonus, detail);
    }
  },

  updateTraffic(dt) {
    const playerZ = this.position + PLAYER_Z;
    for (let j = this.traffic.length - 1; j >= 0; j--) {
      const car = this.traffic[j], seg = Track.find(car.z);
      let target = car.cruise;
      // Leave braking room behind a slower vehicle or a player stopped in our lane.
      const follow = (z, x, w, speed) => {
        const gap = z - car.z;
        if (gap > 0 && U.overlap(car.offset, car.w / seg.halfWidth, x, w / seg.halfWidth)) {
          target = Math.min(target, speed + Math.max(0, gap - SEG * 3) * 0.8);
        }
      };
      if (playerZ > car.z && playerZ - car.z < SEG * 18) follow(playerZ, this.playerX, this.playerWorldWidth, this.speed);
      for (let k = seg.index; k <= seg.index + 18 && k < Track.segments.length; k++) {
        for (const other of Track.segments[k].cars) {
          if (other.speed < target) follow(other.z, other.offset, other.w, other.speed);
        }
      }
      car.speed = Math.min(target, car.speed + MAX_SPEED * 0.12 * dt);
      const z = car.z + car.speed * dt;
      if (seg.index >= Track.finishSeg - 24) car.offset = U.lerp(car.offset, 1.32, Math.min(1, 2 * dt));
      if (z >= Track.finishSeg * SEG) {
        seg.cars.splice(seg.cars.indexOf(car), 1);
        this.traffic.splice(j, 1);
      } else Track.moveCar(car, z);
    }
  },

  bumpVehicle(startZ, endZ, startX) {
    const first = Track.find(startZ), last = Track.find(endZ);
    const previous = this.bumpedCar;
    if (previous && (Math.abs(previous.previousZ - startZ) > SEG ||
        !U.overlap(startX, this.playerW, previous.offset, previous.w / first.halfWidth))) {
      this.bumpedCar = null;
    }
    if (endZ <= startZ) return false;
    let hit = null;
    // Keep the racers' same-segment contact and also check segments crossed at turbo speed.
    for (let i = first.index; i <= last.index; i++) {
      const road = Track.segments[i];
      for (const car of road.cars) {
        if (car === this.localCar) continue;
        const before = car.previousZ - startZ, after = car.z - endZ;
        if (car.speed >= this.speed || before < 0 || (i !== first.index && after > 0)) continue;
        const t = after < 0 ? before / (before - after) : 1;
        const x = U.lerp(startX, this.playerX, t);
        if (U.overlap(x, this.playerWorldWidth / road.halfWidth, car.offset, car.w / road.halfWidth, VEHICLE_OVERLAP) &&
            (!hit || car.z < hit.z)) hit = car;
      }
    }
    if (!hit) return false;
    this.position = Math.min(endZ, hit.z - 10) - PLAYER_Z;
    if (hit === this.bumpedCar) {
      this.speed = hit.speed;
    } else {
      this.bumpedCar = hit;
      const baseSpeed = hit.speed * (hit.speed / this.speed);
      this.speed = U.lerp(baseSpeed, hit.speed, (this.armor - 1) / 8);
      if (hit.traffic) this.passedTraffic.add(hit);
      this.audio?.bump(); this.shake = 0.5;
    }
    return true;
  },

  countClosePasses(startZ, endZ, startX) {
    const tail = -SEG * 0.3;
    let count = 0;
    for (const car of this.traffic) {
      const before = car.previousZ - startZ, after = car.z - endZ;
      if (this.passedTraffic.has(car) || before < tail || after >= tail) continue;
      this.passedTraffic.add(car);
      const x = U.lerp(startX, this.playerX, (before - tail) / (before - after));
      const clearance = Math.abs(x - car.offset) * Track.find(car.z).halfWidth -
        (this.playerWorldWidth + car.w) * VEHICLE_OVERLAP / 2;
      if (clearance > 0 && clearance <= NEAR_MISS_GAP && Math.abs(x) <= 1 && this.speed > car.speed + MAX_SPEED * 0.12) count++;
    }
    return count;
  },

  updateCars(dt, playerSeg, elapsed = this.elapsed) {
    const pz = this.position + PLAYER_Z;
    if (Track.avalanche?.started === null) Track.advanceAvalanche(Math.max(pz, ...this.cars.map(car => car.z)), elapsed);
    for (const car of this.cars) {
      if (car.finished) { Track.brakeIntoBay(car, dt); continue; }
      const old = Track.find(car.z);
      // Racing speed follows the launch delay, the field and the bend.
      let target = car.base * MAX_SPEED;
      const gap = (car.z - pz) / SEG;
      if (gap > 160) target *= 0.84;
      else if (gap > 80) target *= 0.93;
      else if (gap < -60) target *= 1.06;
      target = Math.min(target, MAX_SPEED * 0.95) * (1 - Math.min(0.08, Math.abs(old.curve) * 0.012));
      if (car.launch > 0) { car.launch -= dt; target = 0; }
      car.speed += (target - car.speed) * Math.min(1, dt * 0.55);
      const prevOffset = car.offset;
      car.offset += this.steerCar(car, old, playerSeg);
      car.offset = U.limit(car.offset, -0.85, 0.85);
      car.turn = (car.offset - prevOffset) / dt;
      const destination = Math.min(car.z + dt * car.speed, Track.length - (DRAW_DIST + 20) * SEG);
      if (Track.hazardContact(car.z, destination, prevOffset, car.offset, car.w, elapsed, dt)) car.speed *= .64;
      Track.moveCar(car, destination);
      car.bounce = (Math.random() - 0.5) * (car.speed / MAX_SPEED) * 1.2;
      if (car.z >= Track.finishSeg * SEG) {
        const fraction = U.limit((Track.finishSeg * SEG - car.previousZ) / (car.z - car.previousZ || 1), 0, 1);
        Track.enterFinishArea(car, elapsed + fraction * dt);
      }
    }
  },

  steerCar(car, carSeg, playerSeg) {
    const carW = car.w / carSeg.halfWidth;
    if (!this.localCar && Math.abs(carSeg.index - playerSeg.index) > DRAW_DIST) return 0;
    for (let i = 1; i < 20; i++) {
      const seg = Track.segments[carSeg.index + i];
      if (!seg) break;
      for (const sp of seg.hazards || []) {
        const pose = Track.hazardPose(sp, this.elapsed + i * SEG / Math.max(car.speed, 1));
        if (!pose.active) continue;
        const w = sp.w / seg.halfWidth;
        for (const [center, span] of sp.obstacle.bands || BODY_BAND) {
          const x = pose.offset + center * w;
          if (U.overlap(car.offset, carW, x, span * w)) return (x >= car.offset ? -1 : 1) * .042;
        }
      }
      if (seg === playerSeg && car.speed > this.speed && U.overlap(this.playerX, this.playerW, car.offset, carW, 1.2)) {
        const dir = this.playerX > 0.5 ? -1 : this.playerX < -0.5 ? 1 : (car.offset > this.playerX ? 1 : -1);
        return dir * (1 / i) * (car.speed - this.speed) / MAX_SPEED;
      }
      for (const o of seg.cars) {
        if (o !== car && car.speed > o.speed && U.overlap(car.offset, carW, o.offset, o.w / seg.halfWidth, 1.2)) {
          const dir = o.offset > 0.5 ? -1 : o.offset < -0.5 ? 1 : (car.offset > o.offset ? 1 : -1);
          return dir * (1 / i) * (car.speed - o.speed) / MAX_SPEED;
        }
      }
    }
    return 0;
  },

  // car select screen (between the title / results and the race)
  openSelect() {
    Sound.startMusic();
    Sound.engine(0, false, false);
    Select.open(this.vehicle);
    this.state = 'select';
  },

  start() {
    Sound.startMusic();
    Track.startRace();
    this.reset();
    this.state = 'countdown';
    this.countdown = 3.2;
  },
};

// ------------------------------------------------------------------ input ---
const resultsScreen = () => G.state === 'over' || (G.state === 'finish' && G.finishCar.parked);
addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (G.state === 'title') { Home.keydown(e); return; }
  if (e.code === 'Escape' && Home.root) {
    e.preventDefault();
    if (params.has('compare') || params.has('sheet') || G.state === 'shot') location.assign(location.pathname);
    else Home.show(true);
    return;
  }
  if (params.has('compare')) return;
  if (G.state === 'online') {
    if (e.code === 'KeyV') {
      e.preventDefault();
      if (!e.repeat) Online.session?.voice.toggleMic();
      return;
    }
    if (Online.voiceBar.contains(e.target) && (e.code === 'Space' || e.code === 'Enter')) return;
  }
  if (G.state === 'online' && Local.done) return;
  if (G.state === 'local') {
    if (e.code === 'KeyM' && !e.repeat) Home.toggleSound();
    if (e.code === 'KeyP' && !e.repeat) Home.togglePixel();
    if (Local.done) {
      if (e.code === 'Enter' && !e.repeat) { e.preventDefault(); Local.replay(); }
      return;
    }
    const seat = SEAT_KEYS.findIndex((keys, i) => i < Local.count && Object.values(keys).includes(e.code));
    if (seat < 0) return;
    e.preventDefault();
    RaceInput.held.add(e.code);
    if (e.code === SEAT_KEYS[seat].turbo && !e.repeat && !RaceInput.pads.has(Local.devices[seat])) {
      Local.drivers[seat].keys = RaceInput.controls(seat, true);
      Local.drivers[seat].useTurbo();
    }
    return;
  }
  if (G.state === 'select') {
    if (e.code === 'PageUp' || e.code === 'PageDown') {
      e.preventDefault();
      Select.turnPage(e.code === 'PageUp' ? -1 : 1);
      return;
    }
    if (e.repeat && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); return; }
    const k = SOLO_KEYS[e.code];
    if (k === 'left') Select.move(-1);
    else if (k === 'right') Select.move(1);
    else if (k === 'up' && e.code !== 'Space') Select.rotate(1);
    else if (k === 'down') Select.rotate(-1);
    else if (e.code === 'Enter' || e.code === 'Space') Select.confirm();
    if (k || e.code === 'Enter') e.preventDefault();
    if (e.code === 'KeyM' && !e.repeat) Home.toggleSound();
    if (e.code === 'KeyP' && !e.repeat) Home.togglePixel();
    return;
  }
  if (SOLO_KEYS[e.code]) { RaceInput.held.add(e.code); G.keys = RaceInput.controls(0, false); e.preventDefault(); }
  const soloSpaceBoost = G.state === 'race' && e.code === 'Space';
  if (!e.repeat && (e.code === 'KeyX' || soloSpaceBoost)) {
    e.preventDefault();
    if (G.state === 'online') Online.turbo(); else G.useTurbo();
  }
  if (e.code === 'Enter' && resultsScreen()) G.openSelect();
  if (e.code === 'KeyM' && !e.repeat) Home.toggleSound();
  if (e.code === 'KeyP' && !e.repeat) Home.togglePixel();
});
addEventListener('keyup', e => {
  if (RaceInput.held.delete(e.code)) {
    if (G.state === 'race' || G.state === 'countdown') G.keys = RaceInput.controls(0, false);
    e.preventDefault();
  }
});
addEventListener('blur', () => RaceInput.clear());
document.addEventListener('visibilitychange', () => { if (document.hidden) RaceInput.clear(); });
for (const event of ['gamepadconnected', 'gamepaddisconnected']) {
  addEventListener(event, () => { if (Home.root) RaceInput.poll(); });
}
// mouse / touch on the canvas: menus and the select screen
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height];
}
function overTurbo(x, y) {
  const b = TURBO_BUTTON;
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}
addEventListener('pointerdown', e => {
  if (e.target !== canvas) return;
  if (G.state === 'select') { Select.click(...canvasPoint(e)); return; }
  if (resultsScreen()) G.openSelect();
  else if (G.state === 'online' && overTurbo(...canvasPoint(e))) Online.turbo();
  else if (G.state === 'race' && overTurbo(...canvasPoint(e))) G.useTurbo();
});
// The second thumb can fire the turbo while the first keeps steering.
function touchDrive(e) {
  if (G.state !== 'race' && G.state !== 'online') return;
  let left = false, right = false;
  for (const touch of e.touches) {
    if (touch.target !== canvas) continue;
    const [x, y] = canvasPoint(touch);
    if (overTurbo(x, y)) continue;
    if (x < W / 2) left = true; else right = true;
  }
  RaceInput.touch = {};
  if (left) RaceInput.touch.left = true;
  if (right) RaceInput.touch.right = true;
  if (left || right) RaceInput.touch.up = true;
  G.keys = RaceInput.controls(0, false);
}
for (const event of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) addEventListener(event, touchDrive, { passive: true });

// --------------------------------------------------------------- screens ---
function drawScreens() {
  if (G.state === 'loading' || G.state === 'title') return;
  if (G.state === 'finish') { R.finishHud(G, true); return; }
  R.hud(G);
  if (G.state === 'countdown') {
    const n = Math.ceil(G.countdown);
    if (n <= 3) R.banner(String(n), tr('race.ready'), 1 - (G.countdown % 1));
  }
  if (G.msg) R.banner(G.msg.text, G.msg.sub, G.msg.t);
  if (G.state === 'over' && G.results) {
    R.overlay(0.45);
    R.text(G.results.text, W / 2, 180, 56, R.yellow(180, 56), { align: 'center' });
    R.text(G.results.sub, W / 2, 222, 20, '#ffffff', { align: 'center' });
    if (Math.floor(performance.now() / 500) % 2) R.text(tr('result.continue'), W / 2, 320, 26, R.yellow(320, 26), { align: 'center' });
  }
}

// A short, playable approach to the actual line for checking the finish camera.
function previewFinish() {
  G.reset(false, mulberry32(93));
  G.auto = true; G.state = 'race'; G.stage = STAGE_COUNT - 1;
  G.trialIndex = Track.trials.length; G.elapsed = 116; G.time = 26; G.dawn = 49;
  G.position = (Track.finishSeg - 84) * SEG - PLAYER_Z; G.speed = G.topSpeed * .88;
  G.cars.forEach((car, i) => {
    Track.moveCar(car, (Track.finishSeg - 30 - 17 * i) * SEG);
    car.speed = car.base * MAX_SPEED; car.launch = 0;
  });
}

// -------------------------------------------- reference "screenshot" mode ---
// Stable world indices for art review, independent of the randomly drawn race.
const SHOTS = [
  { cars: [['vampire', 7, -0.44, 2], ['werewolf', 10.5, 0.66, 1]], traffic: ['frankenstein', 17, 0.05], dawnT: 0.03, playerX: 0.14, hill: 0.15 },
  { cars: [['werewolf', 3.4, -0.42, 2], ['kappa', 22, 0.36, -1]], traffic: ['lagoon', 10, 0.56], dawnT: 0.10, playerX: -0.04, hill: 0.11 },
  { cars: [['mummy', 1, -0.38, 2], ['dokkaebi', 14, -0.02, 1], ['werewolf', 65, 0.12, 0]], traffic: ['freddy', 6, 0.60], dawnT: 0.04, playerX: 0, hill: 0.895 },
  { cars: [['baba_yaga', 10, -0.62, 1], ['iku_turso', 16, 0.50, -1], ['vampire', 36, 0.18, 0], ['werewolf', 60, -0.2, 1]], traffic: ['frankenstein', 7, 0.30], dawnT: 0.92, playerX: 0.04, hill: 0.20 },
  { cars: [['jiangshi', 15, -.44, 1], ['mummy', 38, .40, 0]], traffic: ['rakshasa', 62, .18], dawnT: .12, playerX: .12, hill: .14 },
  { cars: [['baba_yaga', 14, -.48, -1], ['kappa', 36, .38, 0]], traffic: ['werewolf', 57, .18], dawnT: .18, playerX: .04, hill: .06 },
  { cars: [['vampire', 15, .45, -1], ['tokoloshe', 34, -.54, 0]], traffic: ['freddy', 58, .45], dawnT: .13, playerX: -.08, hill: .19 },
  { cars: [['ankou', 16, -.46, 1], ['dokkaebi', 39, .48, 0]], traffic: ['frankenstein', 56, .16], dawnT: .16, playerX: .06, hill: .12 },
];
function previewGroup() {
  const shot = Number(params.get('shot'));
  if (params.has('shot') && Number.isFinite(shot)) return Math.floor(U.limit(shot, 0, SHOTS.length - 1) / STAGE_COUNT);
  return params.get('compare') === '2' ? 1 : 0;
}
function setupShot(i, segment = params.get('seg'), playerX = SHOTS[i].playerX, focusTraffic = '') {
  const s = SHOTS[i];
  G.reset(false, mulberry32(13));
  Track.segments.forEach(sg => (sg.cars.length = 0));
  const requested = segment === null || segment === '' ? NaN : Number(segment);
  const stage = Track.route.indexOf(WORLD_IDS[i]);
  const seg = Number.isFinite(requested) ? U.limit(Math.trunc(requested), 0, Track.segments.length - DRAW_DIST - 1) : Track.landmarks[stage];
  G.position = seg * SEG;
  G.playerX = playerX;
  const rivals = focusTraffic ? s.cars.filter(([id, ahead]) => ahead > 14 && id !== focusTraffic) : s.cars;
  const substitute = G.cars.find(car => car.vehicle !== focusTraffic && !rivals.some(([id]) => id === car.vehicle));
  G.cars = rivals.map(([rival, ahead, offset, pose]) => {
    const vehicle = rival === G.vehicle ? substitute.vehicle : rival;
    const car = { vehicle, w: A.vehicleWidth(vehicle), offset, pose, z: G.position + PLAYER_Z + ahead * SEG, speed: 0, percent: 0, base: 0.8 };
    car.percent = U.percentRemaining(car.z, SEG);
    Track.find(car.z).cars.push(car);
    return car;
  });
  const [model, distance, lane] = s.traffic;
  const nearLane = U.limit(playerX + (playerX > 0.55 ? -0.48 : 0.48), -0.78, 0.78);
  G.addTraffic(focusTraffic || model, G.position + PLAYER_Z + (focusTraffic ? 3 : distance) * SEG, focusTraffic ? nearLane : lane);
  G.rank = 3; G.time = 57.6; G.speed = MAX_SPEED * 186 / KMH; G.dawnT = s.dawnT;
  G.hillOffset = s.hill; G.elapsed = 5; G.stage = Track.find(G.position + PLAYER_Z).stage;
  G.frozen = true; G.state = 'shot';
}

// Read-only gallery of the loaded PNGs, 30 per page (?sheet=1, ?sheet=2, ...).
function drawSheet() {
  const ctx = R.ctx;
  const list = Object.keys(SPRITES).map(n => [n, A.img[n]]);
  for (const id of Object.keys(VEHICLES)) {
    A.veh[id].forEach((img, f) => list.push([`${id} ${f}`, img]));
    if (A.raceRear[id]) list.push([`${id} rear`, A.raceRear[id]]);
  }
  for (const key of Object.keys(UI_SPRITES)) list.push([key, A.ui[key]]);
  BACKGROUNDS.forEach((zone, i) => {
    for (const key of Object.keys(zone)) list.push([`${ZONES[i].id} ${key}`, A.bg[i][key]]);
  });
  for (const id of Object.keys(TRAFFIC_MODELS)) {
    A.traffic[id].forEach((img, f) => list.push([`${id} ${TRAFFIC_VIEWS[f]}`, img]));
  }
  const page = +params.get('sheet') || 1, per = 30, cols = 6, cw = W / cols, ch = H / 5;
  ctx.fillStyle = '#3a3050'; ctx.fillRect(0, 0, W, H);
  list.slice((page - 1) * per, page * per).forEach(([n, img], i) => {
    const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
    const k = Math.min((cw - 8) / img.width, (ch - 16) / img.height);
    ctx.fillStyle = (i + Math.floor(i / cols)) % 2 ? '#2a2240' : '#463c62'; ctx.fillRect(x, y, cw, ch);
    A.drawFrame(ctx, img, x + (cw - img.width * k) / 2, y + 2, img.width * k, img.height * k);
    ctx.font = '10px monospace'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(n, x + cw / 2, y + ch - 4);
  });
}

// ?compare=1 : the 4 reference compositions in a 2x2 grid (like the brief)
function drawCompare() {
  const big = document.createElement('canvas');
  big.width = W * 2 + 6; big.height = H * 2 + 6;
  const b = big.getContext('2d');
  b.fillStyle = '#000'; b.fillRect(0, 0, big.width, big.height);
  for (let i = 0; i < Track.route.length; i++) {
    setupShot(WORLD_IDS.indexOf(Track.route[i]), Track.landmarks[i]);
    R.frame(G); if (G.pixel) R.pixelate(); R.hud(G);
    b.drawImage(R.ctx.canvas, (i % 2) * (W + 6), Math.floor(i / 2) * (H + 6));
  }
  canvas.width = big.width; canvas.height = big.height;
  canvas.getContext('2d').drawImage(big, 0, 0);
}

function openComparison() {
  const form = document.getElementById('compare-controls');
  const { shot, car, side, seg, traffic } = form.elements;
  const group = previewGroup();
  const requested = params.get('shot');
  const zone = Number(requested);
  const single = requested !== null && requested !== '' && Number.isInteger(zone) && zone >= 0 && zone < SHOTS.length;
  shot.value = single ? String(zone) : group ? 'new' : '';
  for (const id of Object.keys(VEHICLES)) car.add(new Option(I18n.copy.vehicles[id].label, id));
  const models = [...Object.keys(TRAFFIC_MODELS), ...Object.keys(VEHICLES).filter(id => id !== G.vehicle)];
  for (const id of models) traffic.add(new Option(trafficName(id), id));
  traffic.value = models.includes(params.get('traffic')) ? params.get('traffic') : '';
  car.value = G.vehicle;
  form.hidden = false;
  side.parentElement.hidden = seg.parentElement.hidden = traffic.parentElement.hidden = !single;

  // A comparison is fully described by its URL, including the exact bend and shoulder.
  function change(key, value) {
    const next = new URLSearchParams(params);
    if (key === 'shot') {
      next.delete('seg');
      next.set('compare', value === 'new' || Number(value) >= STAGE_COUNT ? '2' : '1');
      if (value === 'new') value = '';
      if (value === '') { next.delete('side'); next.delete('traffic'); }
    }
    if (key === 'car' && value === next.get('traffic')) next.delete('traffic');
    if (value === '') next.delete(key); else next.set(key, value);
    location.search = next.toString();
  }
  function applySegment() {
    const value = seg.valueAsNumber;
    change('seg', Number.isFinite(value) ? String(U.limit(Math.trunc(value), Number(seg.min), Number(seg.max))) : '');
  }
  form.addEventListener('submit', e => e.preventDefault());
  form.addEventListener('change', ({target}) => {
    if (target === seg) applySegment(); else change(target.name, target.value);
  });
  seg.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); applySegment(); }
  });
  addEventListener('keydown', e => {
    if (form.contains(e.target)) return;
    if (e.code === 'KeyP') change('px', G.pixel ? '0' : '1');
  });
  if (single) {
    const stage = Track.route.indexOf(WORLD_IDS[zone]);
    seg.min = Track.zoneStart[stage];
    seg.max = Track.zoneStart[stage + 1] - 1 - Math.ceil(PLAYER_Z / SEG);
    const raw = params.get('seg')?.trim(), n = Number(raw);
    seg.value = raw && Number.isFinite(n) ? U.limit(Math.trunc(n), Number(seg.min), Number(seg.max)) : Track.landmarks[stage];
    const edge = params.get('side');
    side.value = edge === 'left' || edge === 'right' ? edge : '';
    const x = side.value === 'left' ? -1.19 : side.value === 'right' ? 1.19 : SHOTS[zone].playerX;
    setupShot(zone, seg.valueAsNumber, x, traffic.value);
    R.frame(G); if (G.pixel) R.pixelate(); R.hud(G);
  } else {
    drawCompare();
    canvas.classList.add('compare-grid');
    canvas.title = tr('compare.zoom');
    canvas.addEventListener('click', e => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * canvas.width / rect.width;
      const y = (e.clientY - rect.top) * canvas.height / rect.height;
      if ((x >= W && x < W + 6) || (y >= H && y < H + 6)) return;
      change('shot', String(group * STAGE_COUNT + (y >= H + 6 ? 2 : 0) + (x >= W + 6 ? 1 : 0)));
    });
  }
  fit();
}

// ------------------------------------------------------------------- boot ---
const canvas = document.getElementById('game');
function fit() {
  const area = canvas.parentElement;
  const k = Math.min(area.clientWidth / canvas.width, area.clientHeight / canvas.height);
  canvas.style.width = Math.floor(canvas.width * k) + 'px';
  canvas.style.height = Math.floor(canvas.height * k) + 'px';
}
addEventListener('resize', fit);
new ResizeObserver(fit).observe(canvas.parentElement);
fit();

(async function boot() {
  Home.restoreOptions();
  R.init(canvas);
  const ctx = R.ctx;
  const loading = p => {
    ctx.fillStyle = '#0b0614'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff4fd8'; ctx.fillRect(W / 2 - 150, H / 2, 300 * p, 10);
    ctx.strokeStyle = '#fff'; ctx.strokeRect(W / 2 - 151, H / 2 - 1, 302, 12);
  };
  loading(0);
  const firstWorld = previewGroup() * STAGE_COUNT;
  Track.build(WORLD_IDS.slice(firstWorld, firstWorld + STAGE_COUNT));
  try {
    await A.load(loading);
  } catch (err) {
    ctx.fillStyle = '#0b0614'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff6a8a'; ctx.font = 'bold 14px ' + I18n.fonts; ctx.textAlign = 'left';
    String(err.message).split('\n').slice(0, 24).forEach((l, i) => ctx.fillText(l, 20, 40 + i * 18));
    console.error(err);
    return;
  }
  Local.init();
  Online.init();
  Home.init();
  G.reset();
  if (params.has('sheet')) { drawSheet(); return; }
  if (params.has('compare')) { openComparison(); return; }
  if (params.has('shot')) setupShot(U.limit(Math.trunc(Number(params.get('shot'))) || 0, 0, SHOTS.length - 1));
  else if (params.has('finish')) previewFinish();
  else if (G.auto) G.start();
  else if (params.has('select')) { Select.open(G.vehicle); G.state = 'select'; }
  else {
    Home.show();
    const players = Number(params.get('players'));
    if (Online.invitation() !== null || params.has('online')) {
      Online.open();
      if (Online.invitation() !== null) Online.connect(Online.invitation());
    } else if ([2, 3, 4].includes(players)) {
      Local.count = players;
      Home.openPage('multi', document.getElementById('open-multi'));
    }
  }
  window.G = G;

  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    RaceInput.poll();
    if (G.state === 'race' || G.state === 'countdown') G.keys = RaceInput.controls(0, false);
    acc += dt;
    while (acc >= STEP) {
      if (G.state === 'online') Online.update();
      else if (G.state === 'local') Local.update(STEP);
      else if (G.state === 'select') Select.update(STEP);
      else G.update(STEP);
      acc -= STEP;
    }
    if (G.state === 'online') Online.draw();
    else if (G.state === 'local') Local.draw();
    else if (G.state === 'select') Select.draw(G.pixel);
    else if (G.state !== 'title') {
      R.frame(G);
      if (G.pixel) R.pixelate();
      if (G.state === 'shot') R.hud(G); else drawScreens();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
