'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

function loadGame() {
  const scripts = ['util', 'worlds', 'sprites', 'track', 'online'];
  const code = scripts.map(name => readFileSync(join(__dirname, '..', 'js', name + '.js'), 'utf8')).join('\n');
  return vm.runInNewContext(code + '\n;({ Track, ZONES, RaceRoom, validRoute, mulberry32 })', { crypto: webcrypto });
}

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
