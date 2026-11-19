'use strict';

const SEAT_COLORS = ['#ffdc64', '#67f6dc', '#ffa2d4', '#aebdff'];
const seatName = i => tr('multi.player', { n: i + 1 });
function setText(node, value) { if (node.textContent !== value) node.textContent = value; }

function drawRideThumb(canvas, frame) {
  const scale = Math.min((canvas.width - 4) / frame.width, (canvas.height - 4) / frame.height);
  const w = Math.round(frame.width * scale), h = Math.round(frame.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  A.drawFrame(ctx, frame, (canvas.width - w) >> 1, canvas.height - h - 2, w, h);
}

const Local = {
  count: 2, rides: ['hearse', 'werewolf', 'vampire', 'mummy'], devices: [null, null, null, null],
  manualDevice: [false, false, false, false], deviceIds: [], drivers: [], done: false,

  init() {
    this.root = document.getElementById('split-race');
    this.seats = document.getElementById('lobby-seats');
    this.countButtons = [...document.querySelectorAll('#player-count button')];
    for (const button of this.countButtons) button.addEventListener('click', () => {
      this.count = Number(button.textContent);
      this.buildLobby();
    });
    document.getElementById('local-start').addEventListener('click', () => this.start());
    this.observer = new ResizeObserver(() => this.resizeViews());
  },

  async readLayout() {
    if (RaceInput.layout || !navigator.keyboard?.getLayoutMap) return;
    try {
      RaceInput.layout = await navigator.keyboard.getLayoutMap();
      this.updateKeyLabels();
    } catch { /* The fallback legend includes both QWERTY and AZERTY. */ }
  },

  devicesChanged() {
    for (const [index, pad] of RaceInput.pads) {
      if (this.devices.includes(index)) continue;
      let seat = this.devices.findIndex((v, i) => i < this.count && v !== null && !RaceInput.pads.has(v) && this.deviceIds[i] === pad.id);
      if (seat < 0) seat = this.devices.findIndex((v, i) => i < this.count && v === null && !this.manualDevice[i]);
      if (seat >= 0) this.devices[seat] = index;
    }
    this.rememberDevices();
    if (Home.page?.id === 'multi-page') this.refreshLobby();
  },

  rememberDevices() {
    this.devices.forEach((index, seat) => {
      if (index === null) this.deviceIds[seat] = null;
      else if (RaceInput.pads.has(index)) this.deviceIds[seat] = RaceInput.pads.get(index).id;
    });
  },

  buildLobby() {
    this.rows = [];
    this.seats.replaceChildren();
    for (let i = 0; i < this.count; i++) {
      const row = document.getElementById('lobby-seat').content.firstElementChild.cloneNode(true);
      row.style.setProperty('--seat', SEAT_COLORS[i]);
      row.querySelector('.seat-tag').textContent = seatName(i);
      for (const label of row.querySelectorAll('[data-i18n]')) label.textContent = tr(label.dataset.i18n);
      const ride = row.querySelector('.ride-select'), device = row.querySelector('.device-select');
      ride.setAttribute('aria-label', seatName(i) + ' · ' + tr('garage.vehicle'));
      device.setAttribute('aria-label', seatName(i) + ' · ' + tr('multi.device'));
      for (const id of Object.keys(VEHICLES)) ride.add(new Option(I18n.copy.vehicles[id].label, id));
      ride.addEventListener('change', () => {
        const old = this.rides[i], other = this.rides.indexOf(ride.value);
        if (other >= 0) this.rides[other] = old;
        this.rides[i] = ride.value;
        this.refreshLobby();
      });
      device.addEventListener('change', () => {
        const next = device.value === '' ? null : Number(device.value);
        const other = next === null ? -1 : this.devices.indexOf(next);
        if (other >= 0 && other !== i) {
          this.devices[other] = this.devices[i];
          this.manualDevice[other] = true;
        }
        this.devices[i] = next; this.manualDevice[i] = true;
        this.rememberDevices();
        this.refreshLobby();
      });
      this.rows.push({ ride, device, thumb: row.querySelector('canvas'), keys: row.querySelector('small') });
      this.seats.append(row);
    }
    for (const button of this.countButtons) button.setAttribute('aria-pressed', String(Number(button.textContent) === this.count));
    this.devicesChanged();
    this.readLayout();
  },

  refreshLobby() {
    if (!this.rows) return;
    this.rows.forEach(({ride, device, thumb}, i) => {
      ride.value = this.rides[i];
      for (const option of ride.options) option.disabled = this.rides.slice(0, this.count).some((id, j) => j !== i && id === option.value);
      device.replaceChildren(new Option(tr('multi.keyboard'), ''));
      const available = new Set(RaceInput.pads.keys());
      if (this.devices[i] !== null) available.add(this.devices[i]);
      for (const index of available) device.add(new Option(tr('multi.pad', {n: index + 1}), String(index)));
      device.value = this.devices[i] === null ? '' : String(this.devices[i]);
      drawRideThumb(thumb, A.frame(this.rides[i], VEHICLES[this.rides[i]].thumb ?? 3));
    });
    this.updateKeyLabels();
  },

  updateKeyLabels() {
    const help = document.getElementById('help-seats');
    help.replaceChildren(...SEAT_KEYS.map((_, i) => {
      const li = document.createElement('li');
      li.textContent = seatName(i) + ' · ' + RaceInput.keyLine(i);
      return li;
    }));
    this.rows?.forEach(({keys}, i) => {
      const pad = this.devices[i];
      keys.textContent = pad === null ? RaceInput.keyLine(i) :
        RaceInput.pads.has(pad) ? tr('multi.padKeys') : tr('multi.padLost') + ' · ' + RaceInput.keyLine(i);
    });
  },

  start() {
    RaceInput.clear();
    Home.page.hidden = true; Home.page = null; Home.root.hidden = true;
    canvas.setAttribute('aria-hidden', 'true');
    G.state = 'local'; G.auto = false;
    this.root.hidden = false; this.root.dataset.players = this.count;
    this.root.tabIndex = -1; this.root.focus({preventScroll: true});
    this.autoThrottle = document.getElementById('local-auto').checked;
    this.resetRace(this.rides.slice(0, this.count));
    this.drivers.forEach((driver, i) => this.addView(driver, i));
    if (this.count === 3) this.addBoard(false);
    this.resizeViews();
    Sound.startMusic();
    this.draw();
  },

  // Both multiplayer modes advance the same eight-car field at a fixed time step.
  resetRace(rides, random = Math.random, ownSeat = null) {
    this.done = false; this.countdown = 3.2; this.elapsed = 0;
    this.views = []; this.board = null; this.boardTick = -1;
    this.drivers = rides.map((vehicle, i) => {
      const driver = Object.create(G);
      Object.assign(driver, { vehicle, keys: {}, auto: false, state: 'countdown', audio: ownSeat === null || ownSeat === i ? Sound : null });
      driver.resetDriver();
      driver.position = rides.length > 2 && i < 2 ? 3 * SEG : 0;
      driver.playerX = i % 2 ? 0.44 : -0.44;
      return driver;
    });
    const field = this.drivers[0];
    field.resetField(rides, true, random);
    this.entries = field.cars.slice();
    for (const [i, driver] of this.drivers.entries()) {
      driver.cars = field.cars; driver.traffic = field.traffic;
      driver.collectedPotions = field.collectedPotions;
      const z = driver.position + PLAYER_Z;
      const car = { driver, seat: i, vehicle: driver.vehicle, w: driver.playerWorldWidth, offset: driver.playerX,
        speed: 0, z, previousZ: z, percent: U.percentRemaining(z, SEG) };
      driver.localCar = car;
      Track.find(z).cars.push(car);
      this.entries.push(car);
    }
    this.rankField();
  },

  update(dt) {
    if (this.done) return;
    this.advanceRace(dt, seat => RaceInput.controls(seat, true));
    if (this.done) {
      this.observer.disconnect(); this.root.replaceChildren(); this.views = []; this.addBoard(true);
    }
  },

  advanceRace(dt, controls, listener = null) {
    if (this.done) return;
    if (this.countdown > 0) {
      const before = Math.ceil(this.countdown);
      this.countdown = Math.max(0, this.countdown - dt);
      if (Math.ceil(this.countdown) !== before) Sound.beep(this.countdown === 0);
      if (!this.countdown) {
        for (const driver of this.drivers) if (driver.state === 'countdown') driver.state = 'race';
      }
      return;
    }
    const racing = this.drivers.filter(driver => driver.state === 'race');
    if (!racing.length) { this.done = true; return; }
    // Advance the shared field once. All human drivers see the same motion for this tick.
    const front = racing.reduce((a, b) => a.position > b.position ? a : b);
    front.updateTraffic(dt);
    front.updateCars(dt, Track.find(front.position + PLAYER_Z), this.elapsed);
    for (const driver of racing) {
      const car = driver.localCar;
      driver.keys = controls(car.seat);
      if (driver.keys.boost) driver.useTurbo();
      car.speed = driver.speed;
      driver.moveCar(car, driver.position + PLAYER_Z + driver.speed * dt);
    }
    const claims = [];
    for (const driver of racing) driver.update(dt, claims);
    // Resolve a contested pickup at the instant each nose crossed it.
    for (const {driver, potion} of claims.sort((a, b) => a.at - b.at)) driver.takePotion(potion);
    for (const driver of racing) {
      const car = driver.localCar;
      driver.moveCar(car, driver.position + PLAYER_Z);
      car.turn = (driver.playerX - car.offset) / dt;
      car.offset = driver.playerX; car.speed = driver.speed;
      if (driver.state !== 'race') {
        car.finished = driver.state === 'finish'; car.finishedAt = driver.finishedAt;
        this.parkDriver(driver);
      }
    }
    this.elapsed += dt;
    this.rankField();
    this.done = this.drivers.every(driver => driver.state !== 'race');
    const engine = listener ?? racing.reduce((a, b) => a.speed > b.speed ? a : b);
    Sound.engine(engine.speed / MAX_SPEED, !this.done, Math.abs(engine.playerX) > 1 && engine.speed > 500);
  },

  parkDriver(driver) {
    driver.frozen = true; driver.speed = 0;
    const car = driver.localCar;
    car.speed = 0;
    const bucket = Track.find(car.z).cars;
    const at = bucket.indexOf(car);
    if (at >= 0) bucket.splice(at, 1);
  },

  rankField() {
    const group = c => c.finished ? 0 : c.driver?.state === 'over' ? 2 : 1;
    this.entries.sort((a, b) => group(a) - group(b) || (a.finished && b.finished ? a.finishedAt - b.finishedAt : b.z - a.z));
    this.entries.forEach((car, i) => {
      if (!car.driver) return;
      car.driver.rank = i + 1;
      if (car.finished) car.driver.results.rank = i + 1;
    });
  },

  addView(driver, i) {
    const pane = document.getElementById('split-view').content.firstElementChild.cloneNode(true);
    pane.style.setProperty('--seat', SEAT_COLORS[i]);
    pane.setAttribute('aria-label', seatName(i) + ' · ' + I18n.copy.vehicles[driver.vehicle].label);
    pane.querySelector('.seat-tag').textContent = seatName(i);
    const renderer = Object.create(R), surface = pane.querySelector('canvas');
    renderer.ctx = surface.getContext('2d', {alpha: false}); renderer.cameraYaws = new WeakMap();
    const hud = {};
    for (const key of ['rank','clock','speed','turbo','notice','call']) hud[key] = pane.querySelector('.split-' + key);
    this.views.push({ driver, pane, renderer, surface, hud });
    this.root.append(pane); this.observer.observe(pane);
  },

  resizeViews() {
    if (G.state !== 'local' || this.done) return;
    for (const {pane, surface, renderer} of this.views) {
      if (!pane.clientHeight) continue;
      const step = G.pixel ? 2 : 1;
      const h = H / step, w = Math.max(1, Math.round(h * pane.clientWidth / pane.clientHeight));
      if (surface.width !== w || surface.height !== h) { surface.width = w; surface.height = h; }
      renderer.ctx.setTransform(1 / step, 0, 0, 1 / step, 0, 0);
      renderer.width = w * step; renderer.rowStep = step;
    }
  },

  addBoard(final, action = () => this.replay(), label = 'multi.again') {
    const board = document.getElementById('standings-panel').content.firstElementChild.cloneNode(true);
    board.classList.toggle('final-board', final);
    board.style.setProperty('--board-font', I18n.fonts);
    board.querySelector('h2').textContent = tr(final ? 'multi.results' : 'multi.standings');
    const live = board.querySelector('.standings-live');
    if (final) live.remove();
    else live.textContent = tr('multi.live');
    const list = board.querySelector('ol'), template = document.getElementById('standing-row').content.firstElementChild;
    this.boardRows = this.entries.map((_, i) => {
      const row = template.cloneNode(true);
      row.querySelector('.standing-place').textContent = String(i + 1);
      list.append(row);
      return { row, icon: row.querySelector('canvas'), seat: row.querySelector('.standing-seat'),
        name: row.querySelector('.standing-name'), fill: row.querySelector('.standing-fill'), status: row.querySelector('.standing-status') };
    });
    this.root.append(board); this.board = board;
    if (final) {
      const again = document.createElement('button'); again.type = 'button'; again.textContent = tr(label);
      again.addEventListener('click', action);
      board.querySelector('.standings-cabinet').append(again); again.focus({preventScroll: true});
    }
    this.drawBoard();
  },

  drawBoard() {
    this.boardOrder = this.entries.slice();
    this.entries.forEach((car, i) => {
      const { row, icon, seat, name, fill, status } = this.boardRows[i];
      if (row.dataset.vehicle !== car.vehicle) {
        row.dataset.vehicle = car.vehicle;
        row.dataset.seat = car.driver ? String(car.seat + 1) : '';
        row.style.setProperty('--seat', SEAT_COLORS[car.seat] || '');
        seat.textContent = car.driver ? seatName(car.seat) : '';
        name.textContent = I18n.copy.vehicles[car.vehicle].label;
        const profile = A.frame(car.vehicle, 4);
        icon.width = profile.width + 4; icon.height = profile.height + 4;
        drawRideThumb(icon, profile);
      }
      const out = car.driver?.state === 'over';
      const progress = car.finished ? 100 : U.limit(Math.floor(100 * car.z / (Track.finishSeg * SEG)), 0, 99);
      const percent = progress + '%';
      if (fill.style.width !== percent) fill.style.width = percent;
      row.toggleAttribute('data-result', !!car.finished || out);
      setText(status, car.finished ? I18n.seconds(car.finishedAt, 2) : out ? tr('multi.dnf') : percent);
    });
  },

  draw() {
    if (this.done) return;
    for (const {driver, renderer, hud} of this.views) {
      renderer.frame(driver);
      if (driver.state === 'race') renderer.trialPanel(driver);
      setText(hud.rank, tr('hud.pos') + ' ' + driver.rank + '/8');
      setText(hud.clock, tr('hud.time') + ' ' + Math.max(0, Math.ceil(driver.time)));
      setText(hud.speed, Math.round(driver.speed * KMH / MAX_SPEED) + ' ' + tr('hud.speedUnit'));
      setText(hud.turbo, tr('hud.turbo') + ' ' + '◆'.repeat(driver.charge) + '◇'.repeat(TURBO_CAPACITY - driver.charge));
      const device = this.devices[driver.localCar.seat];
      let notice = '';
      if (device !== null && !RaceInput.pads.has(device)) notice = tr('multi.padLost');
      else if (driver.offroadNoticeUntil > driver.elapsed) notice = tr('hud.offroad', {time: I18n.seconds(OFFROAD_PENALTY)});
      else if (driver.checkpointNoticeUntil > driver.elapsed) notice = tr('race.checkpoint', {time: I18n.seconds(CHECKPOINT_BONUS[driver.zone])});
      else if (driver.passFlash > 0) notice = tr('hud.close');
      setText(hud.notice, notice);
      setText(hud.call, this.countdown > 0 ? String(Math.min(3, Math.ceil(this.countdown))) :
        driver.state === 'finish' ? tr('result.finish') : driver.state === 'over' ? driver.results.text : this.elapsed < .75 ? tr('race.go') : '');
    }
    if (this.board && (Math.floor(this.elapsed * 6) !== this.boardTick || this.entries.some((c, i) => c !== this.boardOrder[i]))) {
      this.boardTick = Math.floor(this.elapsed * 6); this.drawBoard();
    }
  },

  replay() {
    Home.show(); Home.openPage('multi', document.getElementById('open-multi'));
  },

  leave() {
    this.observer.disconnect();
    this.root.hidden = true; this.root.replaceChildren();
    this.drivers = []; this.views = []; this.entries = []; this.board = null; this.done = false;
    this.boardOrder = []; this.boardRows = [];
    RaceInput.clear();
  },
};
