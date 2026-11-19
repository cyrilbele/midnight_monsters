'use strict';

// Physical key positions keep the four clusters separate on compact keyboards.
const SEAT_KEYS = [
  { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', turbo: 'Enter' },
  { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS', turbo: 'KeyE' },
  { left: 'KeyJ', right: 'KeyL', up: 'KeyI', down: 'KeyK', turbo: 'KeyU' },
  { left: 'KeyF', right: 'KeyH', up: 'KeyT', down: 'KeyG', turbo: 'KeyR' },
];
const SOLO_KEYS = { ArrowLeft: 'left', KeyA: 'left', KeyQ: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', KeyZ: 'up', Space: 'up', ArrowDown: 'down', KeyS: 'down' };
const KEY_GLYPHS = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Enter: '↵' };

const RaceInput = {
  held: new Set(), pads: new Map(), touch: {},

  keyLine(seat) {
    const labels = {};
    for (const [action, code] of Object.entries(SEAT_KEYS[seat])) {
      const key = this.layout?.get(code);
      const fallback = code === 'KeyA' ? 'A/Q' : code === 'KeyW' ? 'W/Z' : code.slice(3);
      labels[action] = KEY_GLYPHS[code] || key?.toLocaleUpperCase() || fallback;
    }
    return tr('multi.keys', labels);
  },

  clear() {
    this.held.clear();
    this.touch = {};
    if (G.state === 'race' || G.state === 'countdown') G.keys = {};
  },

  controls(seat, local) {
    const keys = {};
    if (local) {
      const device = Local.devices[seat];
      const pad = this.pads.get(device);
      if (pad) return pad.drive;
      for (const [action, code] of Object.entries(SEAT_KEYS[seat])) keys[action] = this.held.has(code);
      if (device === null && Local.autoThrottle && !keys.down) keys.up = true;
      return keys;
    }
    const pad = this.pads.values().next().value;
    Object.assign(keys, pad?.drive, this.touch);
    for (const code of this.held) if (SOLO_KEYS[code]) keys[SOLO_KEYS[code]] = true;
    return keys;
  },

  sample(pad) {
    const button = i => {
      const b = pad.buttons[i];
      return Math.max(b?.value || 0, b?.pressed && !b.value ? 1 : 0);
    };
    const pressed = i => button(i) > 0.5;
    const x = pad.axes[0] || 0, y = pad.axes[1] || 0;
    const axis = Math.abs(x) <= 0.18 ? 0 : Math.sign(x) * (Math.min(1, Math.abs(x)) - 0.18) / 0.82;
    const pedal = (trigger, face) => {
      const amount = Math.max(button(trigger), button(face));
      return amount > 0.08 ? amount : 0;
    };
    return {
      id: pad.id,
      drive: { axis, left: pressed(14), right: pressed(15), up: pedal(7, 0), down: pedal(6, 1) },
      actions: { left: pressed(14) || x < -0.58, right: pressed(15) || x > 0.58,
        up: pressed(12) || y < -0.58, down: pressed(13) || y > 0.58,
        accept: pressed(0), cancel: pressed(1), turbo: pressed(2), back: pressed(8), start: pressed(9) },
    };
  },

  poll() {
    if (document.hidden || this.blocked || !navigator.getGamepads) return;
    let devices;
    try { devices = navigator.getGamepads(); }
    catch { // An embedding page can disable the API through Permissions Policy.
      this.blocked = true;
      this.pads.clear();
      Local.devicesChanged();
      return;
    }
    const current = new Map(), edges = [];
    for (const pad of devices) {
      if (!pad?.connected) continue;
      const state = this.sample(pad);
      current.set(pad.index, state);
      const before = this.pads.get(pad.index);
      if (!before || before.id !== pad.id) continue; // The press that reveals a controller only registers it.
      for (const action of Object.keys(state.actions)) {
        if (state.actions[action] && !before.actions[action]) edges.push([pad.index, action]);
      }
    }
    const changed = current.size !== this.pads.size || [...current].some(([i, pad]) => pad.id !== this.pads.get(i)?.id);
    this.pads = current;
    if (changed) Local.devicesChanged();
    for (const [index, action] of edges) this.padAction(index, action);
  },

  padAction(index, action) {
    if (G.state === 'title') { Home.padAction(action); return; }
    if (G.state === 'local' && !Local.devices.slice(0, Local.count).includes(index)) return;
    if (G.state !== 'local' && index !== this.pads.keys().next().value) return;
    if (action === 'back' || (G.state === 'select' && action === 'cancel')) { Home.show(true); return; }
    if (G.state === 'local') {
      if (Local.done && (action === 'start' || action === 'accept')) Local.replay();
      else if (action === 'turbo') {
        const seat = Local.devices.indexOf(index);
        const driver = Local.drivers[seat];
        driver.keys = this.controls(seat, true);
        driver.useTurbo();
      }
      return;
    }
    if (G.state === 'online') {
      if (Local.done && (action === 'accept' || action === 'start')) Home.show(true);
      else if (action === 'turbo') Online.turbo();
      return;
    }
    if (G.state === 'select') {
      if (action === 'left' || action === 'right') Select.move(action === 'left' ? -1 : 1);
      if (action === 'up' || action === 'down') Select.rotate(action === 'up' ? 1 : -1);
      if (action === 'accept' || action === 'start') Select.confirm();
    } else if (G.state === 'race' && action === 'turbo') {
      G.keys = this.controls(0, false); G.useTurbo();
    }
    else if (resultsScreen() && (action === 'accept' || action === 'start')) G.openSelect();
  },
};
