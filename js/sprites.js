'use strict';
/* =========================================================
 * sprites.js — list of every image the game loads. All files
 * live in /sprites, sorted by kind:
 *   background/  parallax layers, one folder per zone
 *   players/     playable racers and their turntable sheets
 *   traffic/     slower road users, 3 rear views each
 *   roadside/    scenery (a folder only when it has variants)
 *   track/       road texture and arches
 *   ui/          car select screen
 * Edit the PNGs freely: pixel sizes are read from the files.
 *
 *  w      width of the sprite in world units. Course widths
 *         are defined per zone in track.js. The height follows
 *         the PNG's aspect ratio.
 *  hit    [centre, width] of the solid part, as fractions of
 *         the image width (no hit = you drive through it).
 *  center true = the sprite is centred on its position
 *         (arches, gates) instead of standing beside it.
 * ========================================================= */

// ------------------------------------------------------ roadside scenery ---
const ART_VERSION = 19;
const SPRITES = {
  palm_0: { file: 'roadside/palm/palm_0.png', w: 2600, hit: [0.5, 0.12] },
  palm_1: { file: 'roadside/palm/palm_1.png', w: 2600, hit: [0.36, 0.12] },
  palm_2: { file: 'roadside/palm/palm_2.png', w: 2900, hit: [0.45, 0.12] },
  motel_0: { file: 'roadside/motel/motel_0.png', w: 5200, hit: [0.5, 1] },
  motel_1: { file: 'roadside/motel/motel_1.png', w: 5200, hit: [0.5, 1] },
  motel_sign: { file: 'roadside/motel_sign.png', w: 2300, anchor: 0.5, hit: [0.5, 0.15], sign: 'motel' },
  lamp: { file: 'roadside/lamp.png', w: 520, hit: [0.5, 0.2] },
  bush_0: { file: 'roadside/bush/bush_0.png', w: 1500 },
  bush_1: { file: 'roadside/bush/bush_1.png', w: 1500 },
  bush_2: { file: 'roadside/bush/bush_2.png', w: 1500 },
  rock: { file: 'roadside/rock.png', w: 3200, hit: [0.5, 0.9] },
  gas_pump: { file: 'roadside/gas_pump.png', w: 590, hit: [0.40, 0.55] },
  lighthouse: { file: 'roadside/lighthouse.png', w: 3150, hit: [0.5, 0.72] },
  swamp_tree_0: { file: 'roadside/swamp_tree/swamp_tree_0.png', w: 4900, hit: [0.29, 0.13], center: true },
  swamp_tree_1: { file: 'roadside/swamp_tree/swamp_tree_1.png', w: 3700, hit: [0.32, 0.12], center: true },
  swamp_tree_2: { file: 'roadside/swamp_tree/swamp_tree_2.png', w: 5400, hit: [0.30, 0.13], center: true },
  mushrooms: { file: 'roadside/mushrooms.png', w: 900 },
  croc_sign: { file: 'roadside/croc_sign.png', w: 1100, hit: [0.5, 0.15] },
  gator: { file: 'roadside/gator.png', w: 2000 },
  eyes_bush: { file: 'roadside/eyes_bush.png', w: 1500 },
  reeds: { file: 'roadside/reeds.png', w: 800 },
  stilt_shack: { file: 'roadside/stilt_shack.png', w: 2800, hit: [0.50, 0.84] },
  ghost_skiff: { file: 'roadside/ghost_skiff.png', w: 1650, hit: [0.48, 0.78] },
  tent_red: { file: 'roadside/tent/tent_red.png', w: 4200, hit: [0.5, 0.85] },
  tent_purple: { file: 'roadside/tent/tent_purple.png', w: 4200, hit: [0.5, 0.85] },
  ferris: { file: 'roadside/ferris.png', w: 7200, hit: [0.5, 0.5] },
  clown_gate: { file: 'roadside/clown_gate.png', w: 11000, center: true },
  carnival_sign: { file: 'roadside/carnival_sign.png', w: 3600, hit: [0.5, 0.75], sign: 'carnival' },
  billboard: { file: 'roadside/billboard.png', w: 2400, hit: [0.5, 0.6] },
  light_pole: { file: 'roadside/light_pole.png', w: 1100, hit: [0.4, 0.1] },
  pumpkin: { file: 'roadside/pumpkin.png', w: 700 },
  fortune_wagon: { file: 'roadside/fortune_wagon.png', w: 2190, hit: [0.52, 0.80] },
  high_striker: { file: 'roadside/high_striker.png', w: 840, hit: [0.46, 0.56] },
  tomb_rip: { file: 'roadside/tomb_rip.png', w: 1600, hit: [0.5, 0.8], sign: 'epitaph' },
  tomb_cross: { file: 'roadside/tomb_cross.png', w: 1100, hit: [0.5, 0.3] },
  tomb_small: { file: 'roadside/tomb_small.png', w: 1000, hit: [0.5, 0.8] },
  carved_cross: { file: 'roadside/carved_cross.png', w: 900, hit: [0.49, 0.54] },
  ivy_headstone: { file: 'roadside/ivy_headstone.png', w: 960, hit: [0.5, 0.78] },
  coffin: { file: 'roadside/coffin.png', w: 620, hit: [0.5, 0.8] },
  skeleton_flag: { file: 'roadside/skeleton_flag.png', w: 1500, anchor: 0.25, hit: [0.25, 0.35] },
  grave_bank: { file: 'roadside/grave_bank.png', w: 4600 },
  grave_pines: { file: 'roadside/grave_pines.png', w: 3300 },
  gate: { file: 'roadside/gate.png', w: 3600, hit: [0.5, 0.95] },
  fence: { file: 'roadside/fence.png', w: 2400, hit: [0.5, 1] },
  dead_tree_0: { file: 'roadside/dead_tree/dead_tree_0.png', w: 3600, hit: [0.5, 0.15] },
  dead_tree_1: { file: 'roadside/dead_tree/dead_tree_1.png', w: 3600, hit: [0.5, 0.15] },
  fog: { file: 'roadside/fog.png', w: 5200 },
  mausoleum: { file: 'roadside/mausoleum.png', w: 2820, hit: [0.50, 0.86] },
  stone_angel: { file: 'roadside/stone_angel.png', w: 1030, hit: [0.50, 0.72] },
  arch_start: { file: 'track/arch/arch_start.png', w: 6200, center: true, sign: 'sign.rally' },
  arch_swamp: { file: 'track/arch/arch_swamp.png', w: 6200, center: true, sign: 'zone.swamp' },
  arch_carnival: { file: 'track/arch/arch_carnival.png', w: 6200, center: true, sign: 'zone.carnival' },
  arch_cemetery: { file: 'track/arch/arch_cemetery.png', w: 6200, center: true, sign: 'zone.cemetery' },
  arch_finish: { file: 'track/arch/arch_finish.png', w: 6200, center: true, sign: 'sign.finish' },
  trial_lantern: { file: 'track/trial_lantern.png', w: 230, center: true },
  speed_camera: { file: 'track/speed_camera.png', w: 420, center: true },
  turbo_potion: { file: 'track/turbo_potion.png', w: 320, center: true },
};

// Each road is one overhead painting, repeated along the direction of travel.
const ROAD_FILES = {
  motel: 'track/road.png',
  swamp: 'track/road_swamp.png',
  carnival: 'track/road_carnival.png',
  cemetery: 'track/road_cemetery.png',
};
const BACKGROUNDS = Object.entries(ROAD_FILES).map(([z, road]) => ({
  panorama: `background/${z}/${z}_panorama.png`,
  ground: `track/ground_${z}.png`,
  road,
  ...(z === 'motel' ? { pavement: 'track/motel_pavement.png' } : {}),
}));

// --------------------------------------------------------- select screen ---
const UI_SPRITES = {
  titleScene: 'ui/title_scene.png',
  titlePlay: 'ui/title_play.png',
  titleKeyboard: 'ui/title_keyboard.png',
  titleGear: 'ui/title_gear.png',
  turbo: 'ui/turbo.png',
  garage: 'ui/garage_stage.png',
  logo: 'ui/logo.png',
  raceLabels: 'ui/race_labels.png',
  raceDigits: 'ui/race_digits.png',
  rotate_arrow: 'ui/rotate_arrow.png',
  badge_hearse: 'ui/badge/badge_hearse.png',
  badge_werewolf: 'ui/badge/badge_werewolf.png',
  badge_vampire: 'ui/badge/badge_vampire.png',
  badge_mummy: 'ui/badge/badge_mummy.png',
  badge_kappa: 'ui/badge/badge_kappa.png',
  badge_dokkaebi: 'ui/badge/badge_dokkaebi.png',
  badge_baba_yaga: 'ui/badge/badge_baba_yaga.png',
  badge_iku_turso: 'ui/badge/badge_iku_turso.png',
};

// -------------------------------------------------------------- vehicles ---
// Every racer uses players/<id>/turntable.png + turntable.json (4 × 4 cuts).
//   00 = seen from behind, 04 = right side, 08 = front, 12 = left side.
// In the race: 00 straight, 01-03 turning right, 15-13 turning left.
// Size: world width = frame width x VEHICLE_PX x scale (same for every frame,
// so a side view is naturally longer than the rear view).
// framePadding includes a transparent rim in the calibrated frame dimensions.
// On the turntable, display.width and length are half-axes of the footprint
// in stage pixels. A registered sheet gives the floor pivot in cell pixels.
// Otherwise height is measured from the centre pin to the roof/rider.
const VEHICLE_PX = 3.47;
const TURNTABLE_FRAMES = 16;
const VEHICLES = {
  hearse: {
    scale: 1.15, thumb: 3, raceRear: 'players/hearse/race_rear.png',
    display: { width: 73, length: 111, pivot: [160, 236] },
    stats: { speed: 3, accel: 2, grip: 4, armor: 5 },
  },
  werewolf: {
    scale: 1.28, chaseScale: 0.60, thumb: 4, display: { width: 35, length: 105, pivot: [160, 236] },
    stats: { speed: 4, accel: 5, grip: 2, armor: 2 },
  },
  vampire: {
    scale: 1.20, thumb: 4, display: { width: 59, length: 104, pivot: [160, 236] },
    stats: { speed: 4, accel: 3, grip: 5, armor: 2 },
  },
  mummy: {
    scale: 1.12, thumb: 4, display: { width: 58, length: 105, pivot: [160, 236] },
    stats: { speed: 5, accel: 4, grip: 1, armor: 3 },
  },
  kappa: {
    scale: 1, chaseScale: 0.93, thumb: 6, framePadding: 1, display: { width: 58, length: 99, height: 108 },
    stats: { speed: 3, accel: 4, grip: 5, armor: 2 },
  },
  dokkaebi: {
    scale: 1, chaseScale: 0.91, thumb: 6, framePadding: 1, display: { width: 66, length: 98, height: 128 },
    stats: { speed: 4, accel: 3, grip: 3, armor: 4 },
  },
  baba_yaga: {
    scale: 1, chaseScale: 0.83, thumb: 6, framePadding: 1, display: { width: 62, length: 77, height: 143 },
    stats: { speed: 3, accel: 5, grip: 3, armor: 3 },
  },
  iku_turso: {
    scale: 1, chaseScale: 0.92, thumb: 6, framePadding: 1, display: { width: 68, length: 90, height: 122 },
    stats: { speed: 4, accel: 2, grip: 4, armor: 5 },
  },
  jiangshi: {
    scale: 1.28, chaseScale: 0.94, thumb: 6,
    display: { width: 53, length: 95, height: 108 },
    stats: { speed: 4, accel: 4, grip: 2, armor: 3 },
  },
  rakshasa: {
    scale: 1.25, chaseScale: 0.90, thumb: 6,
    display: { width: 54, length: 84, height: 126 },
    stats: { speed: 3, accel: 3, grip: 5, armor: 4 },
  },
  ankou: {
    scale: 1.26, chaseScale: 0.94, thumb: 6,
    display: { width: 55, length: 95, height: 120 },
    stats: { speed: 3, accel: 2, grip: 5, armor: 4 },
  },
  tokoloshe: {
    scale: 1.17, chaseScale: 0.95, thumb: 6,
    display: { width: 55, length: 78, height: 100 },
    stats: { speed: 3, accel: 5, grip: 4, armor: 1 },
  },
  ahuizotl: {
    scale: 1.24, chaseScale: 0.93, thumb: 6,
    display: { width: 57, length: 93, height: 113 },
    stats: { speed: 4, accel: 3, grip: 5, armor: 3 },
  },
  olgoi_khorkhoi: {
    scale: 1.30, chaseScale: 0.95, thumb: 6,
    display: { width: 66, length: 94, height: 108 },
    stats: { speed: 3, accel: 2, grip: 3, armor: 5 },
  },
  krasue: {
    scale: 1.15, chaseScale: 0.83, thumb: 6,
    display: { width: 30, length: 77, height: 131 },
    stats: { speed: 5, accel: 5, grip: 2, armor: 1 },
  },
  amaru: {
    scale: 1.28, chaseScale: 0.94, thumb: 6,
    display: { width: 57, length: 99, height: 123 },
    stats: { speed: 5, accel: 3, grip: 4, armor: 2 },
  },
};

// Traffic keeps its lane. Width is measured across the rear, speed in HUD km/h.
const TRAFFIC_MODELS = {
  frankenstein: { w: 670, kmh: 96 },
  freddy: { w: 580, kmh: 128 },
  lagoon: { w: 615, kmh: 110 },
};
const TRAFFIC_VIEWS = ['left', 'rear', 'right']; // direction of the nose on screen
