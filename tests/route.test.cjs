'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

function loadGame() {
  const scripts = ['util', 'worlds', 'sprites', 'track', 'render', 'input', 'local', 'online'];
  const code = scripts.map(name => readFileSync(join(__dirname, '..', 'js', name + '.js'), 'utf8')).join('\n');
  return vm.runInNewContext(code + '\n;({ Track, ZONES, RaceRoom, Local, RaceInput, packInput, unpackInput, validInput, validRoute, mulberry32, SEG, STEP, MAX_SPEED })', { crypto: webcrypto });
}

test('only a held press begun on the displayed 2 arms a start, including with auto-throttle or network delay', () => {
  const { RaceInput, Local, packInput, unpackInput, validInput } = loadGame();
  Local.autoThrottle = true;
  const sample = (seat, countdown) => RaceInput.controls(seat, true, countdown);
  RaceInput.held.add('ArrowUp');
  assert.equal(sample(0, 2.01).startBoost, false);
  assert.equal(sample(0, 2).startBoost, false);
  assert.equal(sample(1, 2).up, false);
  RaceInput.held.add('KeyW');
  assert.equal(sample(1, 2).startBoost, true);
  assert.equal(sample(0, .1).startBoost, false);
  assert.equal(sample(1, .1).startBoost, true);
  RaceInput.held.delete('KeyW');
  assert.equal(sample(1, .05).startBoost, false);
  assert.equal(sample(1, 0).up, true);
  RaceInput.held.add('KeyI');
  assert.equal(sample(2, 1).startBoost, false);

  // The receiver can already show 1 when it processes a guest's qualifying press.
  RaceInput.held.clear(); Local.countdown = 1.05; packInput();
  RaceInput.held.add('Space');
  const packet = packInput();
  assert.ok(validInput(packet));
  Local.countdown = .90;
  assert.equal(packInput(), packet);
  assert.ok(unpackInput(packet).startBoost);
  assert.equal(unpackInput(packet).boost, false);
  RaceInput.held.delete('Space');
  assert.equal(unpackInput(packInput()).startBoost, false);
});

test('each world can occupy every slot, and a replay differs from the last race played', () => {
  const { Track, ZONES, validRoute, mulberry32 } = loadGame();
  const slots = new Map(ZONES.map(world => [world.id, new Set()]));
  assert.equal(slots.size, 8);
  const random = mulberry32(597);
  for (let n = 0; n < 200; n++) {
    const route = Track.drawRoute(random);
    assert.ok(validRoute(route));
    route.forEach((id, slot) => slots.get(id).add(slot));
  }
  for (const positions of slots.values()) assert.equal(positions.size, 4);

  const fixed = () => .5;
  const received = Track.drawRoute(fixed);
  Track.startRace(received);
  Track.build(); // Opening an art preview does not count as another race.
  const replay = Track.drawRoute(fixed);
  assert.ok(validRoute(replay));
  assert.notDeepEqual(replay, received);
});

test('checkpoints, challenges, objects and the finish follow the chosen order', () => {
  const { Track, ZONES } = loadGame();
  for (const route of [['foundry', 'motel', 'city', 'swamp'], ['cemetery', 'alpine', 'carnival', 'desert']]) {
    Track.startRace(route);
    const finishes = [];
    route.forEach((id, stage) => {
      const zone = ZONES.findIndex(world => world.id === id);
      const world = ZONES[zone], start = Track.zoneStart[stage];
      const segments = Track.segments.slice(start, Track.zoneStart[stage + 1]);
      assert.ok(segments.every(s => s.zone === zone && s.stage === stage));
      const arch = segments[stage === 0 ? 15 : 0].sprites.find(s => s.sign === 'zone.' + id);
      assert.equal(arch?.start, stage === 0);
      const gates = Array.from(Track.trials[stage].gates, g => g.seg - start);
      assert.deepEqual(gates, Array.from(world.trial.gates, ([distance]) => distance));
      for (const [distance] of world.potions) assert.ok(segments[distance].sprites.some(s => s.name === 'turbo_potion'));
      for (const [distance, name] of world.events || []) assert.ok(segments[distance].hazards.some(h => h.name === name));
      for (const s of segments) if (s.sprites.some(p => p.name === 'arch_finish')) finishes.push(s);
    });
    assert.equal(finishes.length, 1);
    assert.equal(finishes[0].stage, 3);
    assert.equal(finishes[0].index, Track.finishSeg);
  }
});

test('the host sends its ordered route and guests only start with a complete, valid one', () => {
  const host = loadGame(), guest = loadGame();
  const rides = ['hearse', 'mummy', 'vampire', 'werewolf'];
  let packet, started;
  host.RaceRoom.prototype.start.call({
    canStart: true, rides,
    broadcast(message) { packet = structuredClone(message); },
    begin(seed, route) { started = { seed, route: Array.from(route) }; },
  });
  assert.equal(packet.t, 'start');
  assert.ok(host.validRoute(packet.route));
  assert.equal(packet.seed, started.seed);
  assert.deepEqual(packet.route, started.route);
  guest.Track.drawRoute = () => assert.fail('A guest must use the host route');
  const client = {
    phase: 'waiting', count: rides.length,
    begin(seed, route) { assert.equal(seed, started.seed); guest.Track.startRace(route); },
    fail: assert.fail,
  };
  guest.RaceRoom.prototype.fromHost.call(client, packet);
  assert.deepEqual(Array.from(guest.Track.route), started.route);

  const rejected = { ...client, begin: () => assert.fail('Invalid route started'), fail: reason => reason };
  for (const route of [null, [], ['city', 'city', 'swamp', 'motel'], ['city', 'moon', 'swamp', 'motel'], ['city', , 'swamp', 'motel']]) {
    assert.equal(guest.validRoute(route), false);
    assert.equal(guest.RaceRoom.prototype.fromHost.call(rejected, { ...packet, route }), 'version');
  }
});

test('all eight finishers roll to separate bays and stay there at rest, from a crawl to turbo speed', () => {
  const { Track, ZONES, SEG, STEP, MAX_SPEED } = loadGame();
  for (const last of ZONES) {
    const route = ZONES.filter(world => world !== last).slice(0, 3).map(world => world.id);
    Track.startRace([...route, last.id]);
    const line = Track.finishSeg;
    assert.ok(Track.segments[line + 50].halfWidth > Track.segments[line].halfWidth);
    const cars = Array.from({ length: 8 }, (_, slot) => ({
      gridSlot: slot, speed: slot / 7 * MAX_SPEED * 1.22, offset: slot % 2 ? -.8 : .8,
      z: (line + slot / 8) * SEG,
    }));
    for (const car of cars) {
      Track.find(car.z).cars.push(car);
      Track.enterFinishArea(car, 100 + car.gridSlot);
    }
    const poses = cars.map(() => new Set()), turnedBack = new Set();
    for (let tick = 0; tick < 720; tick++) {
      for (const car of cars) {
        const previous = car.z;
        Track.brakeIntoBay(car, STEP);
        poses[car.gridSlot].add(Math.abs(car.pose));
        if (car.z < previous) turnedBack.add(car.gridSlot);
        assert.ok(car.z >= line * SEG && car.z < (line + 106) * SEG);
      }
    }
    assert.equal(turnedBack.size, 8);
    const slots = new Set();
    for (const car of cars) {
      const { z, x } = Track.finishBay(car.gridSlot);
      slots.add([z, x].join(','));
      assert.ok(car.parked && z === car.z && Math.abs(x - car.offset) < 1e-10);
      assert.equal(car.speed, 0);
      assert.equal(car.turn, 0);
      assert.equal(car.pose, x < 0 ? 7 : -7);
      assert.deepEqual([...poses[car.gridSlot]].sort(), [0, 1, 2, 3, 4, 5, 6, 7]);
      assert.equal(Track.find(z).cars.filter(c => c === car).length, 1);
      Track.enterFinishArea(car, 888);
      Track.brakeIntoBay(car, STEP);
      assert.equal(car.finishedAt, 100 + car.gridSlot);
      assert.equal(car.z, z);
    }
    assert.equal(slots.size, 8);
  }
});
