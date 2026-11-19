'use strict';
/* =========================================================
 * audio.js — Web Audio engine, sound effects and the organ score.
 * ========================================================= */
const Sound = {
  ac: null, master: null, musicGain: null, muted: false, musicOn: true,
  playing: false, foreground: !document.hidden && document.hasFocus(), effects: new Set(),

  get audible() { return this.playing && this.foreground && !this.muted; },

  init() {
    if (this.ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ac = new AC();
    this.master = this.ac.createGain();
    this.master.gain.value = 0.55;
    this.musicGain = this.ac.createGain();
    this.musicGain.gain.value = 0.55;
    this.musicGain.connect(this.master);
    // engine: two detuned oscillators through a low-pass
    const ac = this.ac;
    this.eo1 = ac.createOscillator(); this.eo1.type = 'sawtooth';
    this.eo2 = ac.createOscillator(); this.eo2.type = 'square';
    this.ef = ac.createBiquadFilter(); this.ef.type = 'lowpass'; this.ef.frequency.value = 300; this.ef.Q.value = 4;
    this.eg = ac.createGain(); this.eg.gain.value = 0;
    this.eo1.connect(this.ef); this.eo2.connect(this.ef); this.ef.connect(this.eg); this.eg.connect(this.master);
    this.eo1.start(); this.eo2.start();
    // white noise buffer for crashes / gravel
    const len = ac.sampleRate;
    this.noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.gravel = ac.createBufferSource(); this.gravel.buffer = this.noiseBuf; this.gravel.loop = true;
    this.gf = ac.createBiquadFilter(); this.gf.type = 'bandpass'; this.gf.frequency.value = 900;
    this.gg = ac.createGain(); this.gg.gain.value = 0;
    this.gravel.connect(this.gf); this.gf.connect(this.gg); this.gg.connect(this.master);
    this.gravel.start();
  },

  toggleMute() {
    this.muted = !this.muted;
    this.syncOutput();
  },

  setForeground(value) {
    if (this.foreground === value) return;
    this.foreground = value;
    this.syncOutput();
  },

  syncOutput() {
    if (this.audible) this.init();
    const ac = this.ac;
    if (!ac || ac.state === 'closed') return;
    if (this.audible) {
      this.master.connect(ac.destination);
      ac.resume().catch(() => {}); // Browsers may require the next user gesture.
      if (this.musicOn) this.playScore();
      return;
    }
    this.master.disconnect();
    for (const source of this.effects) { source.stop(); source.disconnect(); }
    this.effects.clear();
    for (const gain of [this.eg.gain, this.gg.gain]) {
      gain.cancelScheduledValues(ac.currentTime);
      gain.setValueAtTime(0, ac.currentTime);
    }
    ac.suspend().then(() => {
      // Focus can return before the audio thread has finished suspending.
      if (this.audible && ac.state === 'suspended') return ac.resume();
    }).catch(() => {});
  },

  playEffect(source, start, end) {
    this.effects.add(source);
    source.onended = () => this.effects.delete(source);
    source.start(start); source.stop(end);
  },

  engine(pct, on, offroad) {
    if (!this.audible || !this.ac) return;
    const t = this.ac.currentTime;
    const gears = 4, g = Math.min(gears - 1, Math.floor(pct * gears)), p = pct * gears - g;
    const f = 34 + p * 62 + g * 10 + pct * 20;
    this.eo1.frequency.setTargetAtTime(f, t, 0.04);
    this.eo2.frequency.setTargetAtTime(f * 0.502, t, 0.04);
    this.ef.frequency.setTargetAtTime(260 + pct * 1500, t, 0.08);
    this.eg.gain.setTargetAtTime(on ? 0.05 + pct * 0.06 : 0, t, 0.08);
    this.gg.gain.setTargetAtTime(on && offroad ? 0.08 * pct + 0.02 : 0, t, 0.05);
  },

  tone(freq, dur, type = 'square', vol = 0.15, when = 0, slideTo = 0, dest) {
    if (!this.audible || !this.ac) return;
    const t = this.ac.currentTime + when;
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.master);
    this.playEffect(o, t, t + dur + 0.05);
  },

  noise(dur, vol, freq = 800, when = 0) {
    if (!this.audible || !this.ac) return;
    const t = this.ac.currentTime + when;
    const s = this.ac.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    this.playEffect(s, t, t + dur + 0.05);
  },

  crash() { this.noise(0.45, 0.5, 700); this.tone(120, 0.3, 'square', 0.15, 0, 40); },
  bump() { this.noise(0.18, 0.3, 1400); this.tone(220, 0.12, 'square', 0.08, 0, 90); },
  turbo() { this.noise(0.45, 0.20, 2400); this.tone(150, 0.6, 'sawtooth', 0.08, 0, 740); },
  potion() { this.tone(330, 0.10, 'sine', 0.16, 0, 600); this.tone(580, 0.15, 'triangle', 0.12, 0.08, 980); },
  closePass() { this.tone(740, 0.09, 'triangle', 0.13); this.tone(1110, 0.13, 'triangle', 0.14, 0.07); },
  gate() { this.tone(880, 0.16, 'triangle', 0.16); },
  trialResult(won) {
    const notes = won ? [740, 988, 1245] : [370, 311];
    notes.forEach((hz, i) => this.tone(hz, 0.15, 'triangle', 0.15, i * 0.10));
  },
  beep(hi) { this.tone(hi ? 1320 : 660, hi ? 0.5 : 0.22, 'square', 0.14); },
  checkpoint() { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone(f, 0.16, 'square', 0.1, i * 0.08)); },
  finish() { [392, 523, 659, 784, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'square', 0.11, i * 0.12)); },
  lose() { [392, 370, 349, 330, 196].forEach((f, i) => this.tone(f, 0.35, 'sawtooth', 0.1, i * 0.22)); },

  // Decode the score once. A looping buffer keeps the beat across the join.
  async playScore() {
    if (this.musicSource) return;
    const source = this.ac.createBufferSource();
    this.musicSource = source;
    this.score ??= fetch('audio/vespers-at-redline.mp3').then(response => {
      if (!response.ok) throw new Error('Organ score: HTTP ' + response.status);
      return response.arrayBuffer();
    }).then(data => this.ac.decodeAudioData(data)).catch(error => {
      this.score = null;
      console.warn(error);
      return null;
    });
    const buffer = await this.score;
    // Escape or a new race can arrive while the first download is in flight.
    if (this.musicSource !== source) return;
    if (!buffer) { this.musicSource = null; return; }
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.musicGain);
    source.start();
  },

  startMusic() {
    this.playing = true;
    this.syncOutput();
  },

  stopMusic() {
    this.playing = false;
    const source = this.musicSource;
    this.musicSource = null;
    if (source) {
      if (source.buffer) source.stop();
      source.disconnect();
    }
    this.syncOutput();
  },
};

let audioPageShown = true;
function refreshAudioFocus() {
  Sound.setForeground(audioPageShown && !document.hidden && document.hasFocus());
}
window.addEventListener('blur', () => Sound.setForeground(false));
window.addEventListener('focus', refreshAudioFocus);
document.addEventListener('visibilitychange', refreshAudioFocus);
window.addEventListener('pagehide', e => {
  audioPageShown = false;
  Sound.setForeground(false);
  if (!e.persisted) {
    Sound.stopMusic();
    Sound.ac?.close().catch(() => {});
  }
});
window.addEventListener('pageshow', () => { audioPageShown = true; refreshAudioFocus(); });
function unlockGameAudio() {
  if (Sound.audible && Sound.ac && Sound.ac.state !== 'running') Sound.ac.resume().catch(() => {});
}
window.addEventListener('pointerdown', unlockGameAudio);
window.addEventListener('keydown', unlockGameAudio);
