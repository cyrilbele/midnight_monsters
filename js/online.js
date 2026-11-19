'use strict';

// Each guest sends its controls to the host. Everyone advances the same seeded field
// from the host's ordered 60 Hz inputs, sent two steps at a time over WebRTC.
const ROOM_VERSION = 2;
const ROOM_ID = /^mm-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const BOOST_BIT = 1 << 16;
const IDLE_INPUT = 100;
const validCount = n => Number.isInteger(n) && n >= 2 && n <= 4;
const validRide = id => typeof id === 'string' && Object.hasOwn(VEHICLES, id);
const validInput = bits => Number.isInteger(bits) && bits >= 0 && bits < BOOST_BIT && (bits & 255) <= 200;

function packInput() {
  const k = RaceInput.controls(0, false);
  const steer = k.left ? -1 : k.right ? 1 : k.axis || 0;
  return Math.round(100 + 100 * steer) | (Math.round(15 * (k.up || 0)) << 8) | (Math.round(15 * (k.down || 0)) << 12);
}

function unpackInput(bits) {
  return { axis: ((bits & 255) - 100) / 100, up: ((bits >> 8) & 15) / 15,
    down: ((bits >> 12) & 15) / 15, boost: !!(bits & BOOST_BIT) };
}

class RaceRoom {
  constructor(target, count) {
    this.target = target;
    this.isHost = target === null;
    this.count = this.isHost ? count : 0;
    this.seat = this.isHost ? 0 : -1;
    this.phase = 'connecting';
    this.rides = this.isHost ? Array(count).fill(null) : [];
    if (this.isHost) this.rides[0] = Online.preferred;
    this.links = new Set();
    this.seats = new Map();
    this.inputs = Array(4).fill(IDLE_INPUT);
    this.boosts = Array(4).fill(0);
    this.lastInput = Array(4).fill(0);
    this.dropped = new Set();
    this.frames = [];
    this.microphones = new Set();
    this.voice = new RoomVoice(this);
  }

  get roomId() { return this.isHost ? this.id : this.target; }

  get canStart() {
    return this.isHost && this.phase === 'waiting' && this.seats.size === this.count - 1 &&
      this.rides.every(Boolean) && [...this.seats.keys()].every(c => c.open);
  }

  start() {
    if (!this.canStart) return;
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    this.broadcast({ t: 'start', seed, rides: this.rides });
    this.begin(seed);
  }

  async connect() {
    this.deadline = setTimeout(() => this.fail(this.hostLink ? 'directFailed' : 'network'), 30000);
    try {
      await import('../vendor/peerjs-1.5.5/peerjs.min.js');
      if (this.closed) return;
      if (!window.RTCPeerConnection || !window.crypto?.randomUUID) return this.fail('unsupported');
      const peer = this.peer = new window.Peer('mm-' + crypto.randomUUID(), { secure: true });
      peer.on('error', err => {
        if (this.closed || this.phase === 'finished') return;
        if (err.type === 'peer-unavailable' || err.type === 'webrtc') {
          if (!this.isHost && this.phase === 'connecting') return this.fail(err.type === 'peer-unavailable' ? 'missing' : 'directFailed');
          // After admission a failed media call must not take down the race connection.
          return;
        }
        if (this.phase === 'race' && !peer.destroyed && !['browser-incompatible','invalid-key'].includes(err.type)) return;
        this.fail(err.type === 'browser-incompatible' ? 'unsupported' : 'network');
      });
      peer.on('disconnected', () => {
        if (this.closed || this.phase === 'finished' || this.phase === 'race') return;
        this.fail('network');
      });
      peer.on('connection', c => { if (this.isHost && !this.closed) this.listen(c); else c.close(); });
      peer.on('call', call => this.voice.accept(call));
      peer.on('open', id => {
        if (this.closed) return;
        if (this.isHost) {
          this.id = id;
          this.phase = 'waiting';
          clearTimeout(this.deadline);
          this.syncVoiceMembers();
          Online.render();
        } else {
          this.hostLink = peer.connect(this.target, { reliable: true, serialization: 'json' });
          this.listen(this.hostLink);
        }
      });
    } catch { this.fail('network'); }
  }

  listen(c) {
    this.links.add(c);
    // A connection only occupies a seat after the loaded game sends its version and ride.
    const handshake = this.isHost ? setTimeout(() => { if (!this.seats.has(c)) c.close(); }, 20000) : null;
    c.on('open', () => {
      if (this.closed) return;
      if (!this.isHost) c.send({ t: 'hello', version: ROOM_VERSION, ride: Online.preferred });
    });
    c.on('data', m => {
      if (this.closed || !this.links.has(c) || !m || typeof m !== 'object') return;
      if (this.isHost) this.fromGuest(c, m);
      else this.fromHost(m);
    });
    const lost = () => {
      clearTimeout(handshake);
      if (!this.links.delete(c) || this.closed) return;
      if (!this.isHost) {
        if (this.phase === 'finished') this.voice.close();
        else if (this.results) { this.finish(this.results); this.voice.close(); }
        else this.fail(this.phase === 'connecting' ? 'directFailed' : 'hostLeft');
        return;
      }
      const seat = this.seats.get(c);
      if (seat === undefined) return;
      this.seats.delete(c);
      this.microphones.delete(c.peer);
      this.syncVoiceMembers();
      if (this.phase === 'race') this.dropped.add(seat);
      else if (this.phase === 'waiting') { this.rides[seat] = null; this.lobby(); }
    };
    c.on('close', lost);
    c.on('error', () => { lost(); c.close(); });
  }

  fromGuest(c, m) {
    let seat = this.seats.get(c);
    if (seat === undefined) {
      if (m.t !== 'hello' || !c.open) return;
      seat = this.rides.indexOf(null);
      if (m.version !== ROOM_VERSION || this.phase !== 'waiting' || seat < 1) {
        c.send({ t: 'refused', version: m.version !== ROOM_VERSION, started: this.phase !== 'waiting' });
        setTimeout(() => c.close(), 600);
        return;
      }
      this.seats.set(c, seat);
      this.rides[seat] = validRide(m.ride) && !this.rides.includes(m.ride)
        ? m.ride : Object.keys(VEHICLES).find(id => !this.rides.includes(id));
      this.lobby();
      this.syncVoiceMembers();
      return;
    }
    if (m.t === 'mic' && typeof m.enabled === 'boolean') { this.setMic(c.peer, m.enabled); return; }
    if (m.t === 'listen' && typeof m.enabled === 'boolean') { this.routeListener(c.peer, m.to, m.enabled); return; }
    if (m.t === 'ride' && this.phase === 'waiting') this.changeRide(seat, m.ride);
    if (this.phase !== 'race') return;
    if (m.t === 'input' && validInput(m.bits)) {
      this.inputs[seat] = m.bits;
      this.lastInput[seat] = performance.now();
      if (m.boost === true) this.boosts[seat] = Math.min(TURBO_CAPACITY, this.boosts[seat] + 1);
    }
  }

  fromHost(m) {
    if (m.t === 'refused') return this.fail(m.version ? 'version' : m.started ? 'started' : 'full');
    if (m.t === 'voiceMembers' && this.phase !== 'connecting') {
      if (Array.isArray(m.members) && m.members.length <= this.count && m.members.every(row =>
        Array.isArray(row) && row.length === 2 && typeof row[0] === 'string' && ROOM_ID.test(row[0]) && typeof row[1] === 'boolean')) {
        this.voice.setMembers(m.members);
      }
      return;
    }
    if (m.t === 'listener' && typeof m.enabled === 'boolean') { this.voice.sendTo(m.id, m.enabled); return; }
    if (m.t === 'lobby' && ['connecting','waiting'].includes(this.phase)) {
      if (!Array.isArray(m.rides) || !validCount(m.rides.length) || !m.rides.every(id => id === null || validRide(id)) ||
          !Number.isInteger(m.seat) || m.seat < 1 || !m.rides[m.seat]) return this.fail('version');
      clearTimeout(this.deadline);
      this.seat = m.seat; this.rides = m.rides; this.count = m.rides.length; this.phase = 'waiting';
      Online.render();
    } else if (m.t === 'start' && this.phase === 'waiting') {
      if (!Number.isInteger(m.seed) || !Array.isArray(m.rides) || m.rides.length !== this.count ||
          !m.rides.every(validRide) || new Set(m.rides).size !== this.count) return this.fail('version');
      this.rides = m.rides;
      this.begin(m.seed);
    } else if (m.t === 'steps' && this.phase === 'race') {
      if (!Array.isArray(m.frames) || m.frames.length > 2 || !m.frames.every(frame =>
        Array.isArray(frame) && frame.length === this.count && frame.every(bits => bits === -1 ||
          (Number.isInteger(bits) && bits >= 0 && bits < 2 * BOOST_BIT && validInput(bits & (BOOST_BIT - 1)))))) return this.fail('version');
      this.lastFrame = performance.now();
      this.frames.push(...m.frames);
      if (this.frames.length > 18000) this.fail('network');
    } else if (m.t === 'results' && this.phase === 'race') {
      if (!Array.isArray(m.rows) || m.rows.length !== 8 || new Set(m.rows.map(r => r?.id)).size !== 8 ||
          !m.rows.every(r => r && validRide(r.id) && Local.entries.some(c => c.vehicle === r.id) &&
            Number.isFinite(r.z) && (r.time === null || Number.isFinite(r.time)))) return this.fail('version');
      this.results = m.rows;
      if (!this.frames.length) this.finish(this.results);
    }
  }

  changeRide(seat, ride) {
    if (!validRide(ride) || this.rides.includes(ride)) return;
    this.rides[seat] = ride;
    this.lobby();
  }

  lobby() {
    for (const [c, seat] of this.seats) if (c.open) c.send({ t: 'lobby', rides: this.rides, seat });
    Online.render();
  }

  broadcast(m) {
    for (const c of this.seats.keys()) if (c.open) c.send(m);
  }

  syncVoiceMembers() {
    const ids = [this.id, ...Array.from(this.seats.keys(), c => c.peer)];
    const members = ids.map(id => [id, this.microphones.has(id)]);
    this.broadcast({ t: 'voiceMembers', members });
    this.voice.setMembers(members);
  }

  setMic(id, enabled) {
    if (this.microphones.has(id) === enabled) return;
    if (enabled) this.microphones.add(id); else this.microphones.delete(id);
    this.syncVoiceMembers();
  }

  micChanged(enabled) {
    if (this.isHost) this.setMic(this.id, enabled);
    else if (this.hostLink.open) this.hostLink.send({ t: 'mic', enabled });
  }

  requestVoice(speaker, enabled = true) {
    if (this.isHost) this.routeListener(this.id, speaker, enabled);
    else if (this.hostLink.open) this.hostLink.send({ t: 'listen', to: speaker, enabled });
  }

  routeListener(listener, speaker, enabled) {
    if (listener === speaker || !this.microphones.has(speaker)) return;
    if (speaker === this.id) this.voice.sendTo(listener, enabled);
    else for (const c of this.seats.keys()) {
      if (c.peer === speaker && c.open) c.send({ t: 'listener', id: listener, enabled });
    }
  }

  begin(seed) {
    this.phase = 'race';
    Local.resetRace(this.rides, mulberry32(seed), this.seat);
    Home.page.hidden = true; Home.page = null; Home.root.hidden = true;
    G.state = 'online'; G.auto = false;
    Online.updateVoice();
    RaceInput.clear();
    canvas.removeAttribute('aria-hidden'); canvas.focus({ preventScroll: true });
    this.lastFrame = this.lastHiddenTick = performance.now();
    this.sentAt = -Infinity;
    Sound.startMusic();
    // Background tabs can stop animation frames. Keep a hidden host ticking when the browser allows it.
    this.clock = setInterval(() => {
      if (this.phase !== 'race') return;
      const now = performance.now();
      if (this.isHost && document.hidden) {
        const ticks = Math.min(120, Math.floor((now - this.lastHiddenTick) / (STEP * 1000)));
        for (let i = 0; i < ticks && this.phase === 'race'; i++) this.hostStep();
        this.lastHiddenTick += ticks * STEP * 1000;
        if (now - this.lastHiddenTick > 2000) this.lastHiddenTick = now;
      } else if (!this.isHost && !document.hidden && !this.results && now - this.lastFrame > 30000) this.fail('hostLeft');
    }, 250);
  }

  turbo() {
    if (this.phase !== 'race' || Local.drivers[this.seat].state !== 'race') return;
    if (this.isHost) this.boosts[0] = Math.min(TURBO_CAPACITY, this.boosts[0] + 1);
    else this.sendInput(true);
  }

  sendInput(boost = false) {
    const bits = packInput(), now = performance.now();
    if (this.hostLink.open && (boost || this.sentBits !== bits || now - this.sentAt >= 250)) {
      this.hostLink.send({ t: 'input', bits, boost });
      this.sentBits = bits; this.sentAt = now;
    }
  }

  update() {
    if (this.phase !== 'race') return;
    if (this.isHost) {
      if (!document.hidden) { this.lastHiddenTick = performance.now(); this.hostStep(); }
      return;
    }
    this.sendInput();
    // Keep a normally paced camera, but catch up after a delayed batch or a background tab.
    const steps = this.frames.length > 6 ? Math.min(this.frames.length - 2, 30) : Math.min(1, this.frames.length);
    for (let i = 0; i < steps; i++) this.apply(this.frames.shift());
    if (!this.frames.length && this.results) this.finish(this.results);
  }

  hostStep() {
    const now = performance.now();
    this.inputs[0] = packInput();
    const frame = this.rides.map((_, seat) => {
      if (this.dropped.has(seat)) return -1;
      const bits = seat > 0 && now - this.lastInput[seat] > 1200 ? IDLE_INPUT : this.inputs[seat];
      if (!this.boosts[seat]) return bits;
      this.boosts[seat]--;
      return bits | BOOST_BIT;
    });
    this.apply(frame);
    this.frames.push(frame);
    if (this.frames.length === 2 || Local.done) {
      this.broadcast({ t: 'steps', frames: this.frames });
      this.frames = [];
    }
    if (Local.done) {
      const rows = Local.entries.map(c => ({ id: c.vehicle, z: c.z, time: c.finished ? c.finishedAt : null, out: c.driver?.state === 'over' }));
      this.broadcast({ t: 'results', rows });
      this.finish(rows);
    }
  }

  apply(frame) {
    frame.forEach((bits, seat) => {
      const driver = Local.drivers[seat];
      if (bits === -1 && (driver.state === 'race' || driver.state === 'countdown')) {
        driver.state = 'over'; driver.results = { text: tr('multi.dnf') };
        Local.parkDriver(driver);
      }
    });
    Local.advanceRace(STEP, seat => unpackInput(frame[seat]), Local.drivers[this.seat]);
  }

  finish(rows) {
    this.phase = 'finished';
    clearInterval(this.clock);
    Local.done = true;
    Local.entries = rows.map(r => {
      const car = Local.entries.find(c => c.vehicle === r.id);
      car.z = r.z; car.finished = r.time !== null; car.finishedAt = r.time;
      if (car.driver && r.out) car.driver.state = 'over';
      return car;
    });
    Sound.engine(0, false, false);
    Local.root.hidden = false;
    canvas.setAttribute('aria-hidden', 'true');
    Local.addBoard(true, () => Home.show(true), 'menu.back');
    Online.updateVoice();
  }

  fail(key) { if (!this.closed) Online.failed(this, key); }

  close() {
    this.closed = true;
    clearTimeout(this.deadline); clearInterval(this.clock);
    this.voice.close();
    this.peer?.destroy();
    this.links.clear(); this.seats.clear();
  }
}

const Online = {
  count: 2, session: null, error: '', retryRoom: null,

  init() {
    const el = id => document.getElementById(id);
    this.setup = el('online-setup'); this.status = el('online-status'); this.grid = el('online-grid');
    this.invite = el('online-invite'); this.link = el('invite-link'); this.copy = el('copy-invite');
    this.create = el('online-create'); this.vehicle = el('online-vehicle'); this.ride = el('online-ride');
    this.startButton = el('online-start');
    this.voiceBar = el('room-voice'); this.mic = el('voice-mic'); this.speakers = el('voice-speakers');
    this.voiceFeedback = el('voice-feedback');
    this.lobbyDock = el('lobby-voice-dock'); this.raceDock = el('race-voice-dock');
    this.countButtons = [...el('online-count').querySelectorAll('button')];
    const saved = Home.readOptions().onlineRide;
    this.preferred = validRide(saved) ? saved : G.vehicle;
    el('open-online').addEventListener('click', () => this.open());
    el('open-local').addEventListener('click', () => {
      this.leave(); Home.openPage('multi', el('open-multi'));
    });
    for (const button of this.countButtons) button.addEventListener('click', () => {
      this.count = Number(button.textContent); this.render();
    });
    this.ride.addEventListener('change', () => {
      this.preferred = this.ride.value; Home.saveOption('onlineRide', this.preferred);
      const s = this.session;
      if (s?.phase !== 'waiting') return;
      if (s.isHost) s.changeRide(0, this.preferred);
      else if (s.hostLink.open) s.hostLink.send({ t: 'ride', ride: this.preferred });
    });
    this.create.addEventListener('click', () => this.connect(this.retryRoom));
    this.startButton.addEventListener('click', () => this.session?.start());
    this.mic.addEventListener('click', () => this.session?.voice.toggleMic());
    this.speakers.addEventListener('click', () => {
      const voice = this.session?.voice;
      if (voice) voice.listen(!voice.listening || voice.playbackBlocked);
    });
    this.voiceBar.addEventListener('click', e => {
      if (e.detail > 0 && this.session?.phase === 'race') canvas.focus({ preventScroll: true });
    });
    document.addEventListener('visibilitychange', () => this.session?.voice.visibility());
    this.copy.addEventListener('click', async () => {
      const link = this.link.value;
      try {
        await navigator.clipboard.writeText(link);
        if (this.link.value === link) this.copy.textContent = tr('online.copied');
      } catch { this.link.focus(); this.link.select(); }
    });
    addEventListener('hashchange', () => {
      const room = this.invitation();
      if (room === null || room === this.session?.target || room === this.session?.id) return;
      const url = location.href;
      Home.show(); // Following a new invitation can be a same-document navigation.
      history.replaceState(null, '', url);
      this.open(); this.connect(room);
    });
    addEventListener('pagehide', () => {
      if (!this.session) return;
      if (G.state === 'online') Home.show();
      else { this.leave(); this.render(); }
    });
  },

  invitation() { return new URLSearchParams(location.hash.slice(1)).get('room'); },
  open() { Home.openPage('online', document.getElementById('open-multi')); },

  connect(target = null) {
    if (this.session) return;
    this.retryRoom = target;
    if (target !== null && !ROOM_ID.test(target)) {
      this.error = 'missing'; this.retryRoom = null; this.render(); return;
    }
    if (target === null && this.invitation() !== null) history.replaceState(null, '', location.pathname + location.search);
    this.error = '';
    this.session = new RaceRoom(target, this.count);
    this.render();
    this.session.connect();
  },

  failed(room, key) {
    if (room !== this.session) return;
    this.session = null; room.close();
    if (G.state === 'online') { Home.show(); this.open(); }
    this.error = key; this.retryRoom = room.target;
    this.render();
  },

  leave() {
    const s = this.session;
    this.session = null; s?.close(); this.error = ''; this.retryRoom = null;
    this.updateVoice();
    if (this.invitation() !== null) history.replaceState(null, '', location.pathname + location.search);
  },

  render() {
    const s = this.session;
    const waiting = s?.phase === 'waiting';
    const setup = !s && !this.retryRoom;
    this.setup.hidden = !setup;
    this.vehicle.hidden = !setup && !waiting;
    this.invite.hidden = !waiting || !s.isHost || s.rides.every(Boolean);
    document.getElementById('open-local').hidden = !!s;
    this.create.hidden = !!s;
    this.startButton.hidden = !s?.canStart;
    this.create.textContent = tr(this.retryRoom ? 'online.retry' : 'online.create');
    for (const button of this.countButtons) button.setAttribute('aria-pressed', String(Number(button.textContent) === this.count));
    if (!this.vehicle.hidden) {
      this.ride.replaceChildren(...Object.keys(VEHICLES).map(id => {
        const option = new Option(I18n.copy.vehicles[id].label, id);
        option.disabled = !!waiting && s.rides.some((other, seat) => seat !== s.seat && id === other);
        return option;
      }));
      this.ride.value = waiting ? s.rides[s.seat] : this.preferred;
    }
    this.grid.hidden = !waiting;
    let message = tr('online.hint');
    if (this.error) message = tr('online.' + this.error);
    else if (s && !waiting) message = tr('online.connecting');
    else if (waiting) {
      message = tr('online.waiting', { n: s.rides.filter(Boolean).length, total: s.count });
      if (s.rides.every(Boolean)) message = tr(s.isHost ? 'online.gridFull' : 'online.waitHost');
      this.grid.replaceChildren(...s.rides.map((id, seat) => {
        const li = document.createElement('li');
        li.style.setProperty('--seat', SEAT_COLORS[seat]);
        li.toggleAttribute('data-empty', !id);
        if (id) {
          const icon = document.createElement('canvas'); icon.width = 72; icon.height = 48;
          drawRideThumb(icon, A.frame(id, 4)); li.append(icon);
        }
        const name = id ? I18n.copy.vehicles[id].label : tr('online.empty');
        li.append(seatName(seat) + ' · ' + name + (seat === s.seat ? ' (' + tr('online.you') + ')' : ''));
        return li;
      }));
      if (s.isHost) {
        const url = new URL(location.href); url.search = ''; url.hash = 'room=' + s.id;
        if (this.link.value !== url.href) {
          this.link.value = url.href; this.copy.textContent = tr('online.copy');
        }
      }
    }
    setText(this.status, message);
    this.updateVoice();
  },

  updateVoice() {
    const s = this.session, voice = s?.voice;
    const enabled = !!voice && !voice.closed && s.phase !== 'connecting';
    const onTrack = enabled && s.phase !== 'waiting';
    const dock = onTrack ? this.raceDock : this.lobbyDock;
    if (this.voiceBar.parentElement !== dock) dock.append(this.voiceBar);
    document.body.classList.toggle('online-results', s?.phase === 'finished');
    this.voiceBar.hidden = !enabled;
    if (!enabled) return;
    this.mic.disabled = voice.pending;
    this.mic.setAttribute('aria-pressed', String(!!voice.stream));
    setText(this.mic, tr(voice.pending ? 'voice.pending' : voice.stream ? 'voice.micOn' : 'voice.micOff'));
    this.mic.title = this.mic.textContent + ' (V · Y/△)';
    const audible = voice.listening && !voice.playbackBlocked;
    this.speakers.setAttribute('aria-pressed', String(audible));
    setText(this.speakers, tr(audible ? 'voice.speakersOn' : 'voice.speakersOff'));
    setText(this.voiceFeedback, voice.error ? tr(voice.error) : voice.playbackBlocked ? tr('voice.blocked') : '');
  },

  turbo() { this.session?.turbo(); },
  update() { this.session?.update(); },

  draw() {
    const s = this.session;
    if (!s || s.phase !== 'race') return;
    const own = Local.drivers[s.seat], watching = own.state === 'finish' || own.state === 'over';
    const driver = watching ? Local.entries.find(car => car.driver?.state === 'race')?.driver || own : own;
    R.frame(driver);
    if (G.pixel) R.pixelate();
    R.hud(driver);
    const count = Math.ceil(Local.countdown);
    if (count > 0 && count <= 3) R.banner(String(count), tr('race.ready'), 1 - Local.countdown % 1);
    else if (!Local.countdown && Local.elapsed < .75) R.banner(tr('race.go'), '', Local.elapsed);
    if (watching) R.text(tr('online.spectating', { result: tr(own.state === 'finish' ? 'result.finish' : 'multi.dnf'), player: seatName(driver.localCar.seat) }),
      W / 2, H - 12, 17, '#ffdf79', { align: 'center', maxWidth: W * .65 });
  },
};
