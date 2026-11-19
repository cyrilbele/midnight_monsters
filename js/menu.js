'use strict';

const Home = {
  readOptions() {
    try {
      const saved = JSON.parse(localStorage.getItem('midnight-monsters.options'));
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) return saved;
    } catch { /* Storage can be disabled. */ }
    return {};
  },

  restoreOptions() {
    const saved = this.readOptions();
    if (typeof saved.muted === 'boolean') Sound.muted = saved.muted;
    if (!params.has('px') && typeof saved.pixel === 'boolean') G.pixel = saved.pixel;
    I18n.setLanguage(saved.language);
  },

  init() {
    this.root = document.getElementById('home');
    this.scene = this.root.querySelector('.title-art');
    this.nav = document.getElementById('title-actions');
    this.sound = document.getElementById('option-sound');
    this.pixel = document.getElementById('option-pixel');
    this.language = document.getElementById('option-language');
    this.playButton = document.getElementById('play');
    this.localize();
    new ResizeObserver(() => this.drawScene()).observe(this.scene);
    this.playButton.addEventListener('click', () => this.play());
    for (const id of ['multi', 'controls', 'options']) {
      const button = document.getElementById('open-' + id);
      button.addEventListener('click', () => this.openPage(id, button));
    }
    for (const button of this.root.querySelectorAll('.menu-back')) button.addEventListener('click', () => this.back());
    this.sound.addEventListener('click', () => this.toggleSound());
    this.pixel.addEventListener('click', () => this.togglePixel());
    this.language.addEventListener('change', () => {
      I18n.setLanguage(this.language.value);
      this.localize();
      this.saveOption('language', I18n.language);
    });
  },

  localize() {
    for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = tr(el.dataset.i18n);
    for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', tr(el.dataset.i18nAria));
    this.language.value = I18n.language;
    this.syncOptions();
    this.drawActions();
    Local.updateKeyLabels();
  },

  drawScene() {
    if (this.root.hidden) return;
    const box = this.scene.getBoundingClientRect();
    if (!box.width || !box.height) return;
    // Keep the race's horizontal pixel grid even when the portrait layout crops the sides.
    const height = 2 * Math.round(W * box.height / box.width / 2);
    if (this.scene.height !== height) this.scene.height = height;
    const ctx = this.scene.getContext('2d', { alpha: false }), art = A.ui.titleScene;
    const scale = Math.max(W / art.width, height / art.height);
    const w = Math.round(art.width * scale), h = Math.round(art.height * scale);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(R.sourceAtSize(art, w), Math.round((W - w) / 2), Math.round((height - h) / 2), w, h);
    if (G.pixel) R.pixelate(ctx);
  },

  drawActions() {
    // Menu lettering uses the native HUD resolution, including with the 320 × 240 filter.
    for (const canvas of this.nav.querySelectorAll('canvas')) {
      const button = canvas.parentElement, art = A.ui[canvas.dataset.menuArt];
      const ctx = canvas.getContext('2d');
      const play = button === this.playButton;
      const label = button.getAttribute('aria-label').toLocaleUpperCase(I18n.language);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      if (!art) {
        ctx.font = 'bold 11px ' + I18n.fonts; ctx.letterSpacing = '1px'; ctx.textAlign = 'center';
        ctx.fillStyle = '#150d21'; ctx.fillText(label, canvas.width / 2, 14, canvas.width - 2);
        ctx.fillStyle = '#ffd675'; ctx.fillText(label, canvas.width / 2, 13, canvas.width - 2);
        continue;
      }
      if (play && I18n.language !== 'fr') {
        // The original French button includes an illustrated Return key at its right edge.
        ctx.save();
        ctx.font = R.font(30); ctx.lineJoin = 'round'; ctx.lineWidth = 3.5;
        const keyW = 44, gap = 7, textW = Math.min(canvas.width - keyW - gap - 6, Math.ceil(ctx.measureText(label).width));
        const left = Math.round((canvas.width - textW - gap - keyW) / 2);
        const gold = ctx.createLinearGradient(0, 3, 0, 27);
        gold.addColorStop(0, '#fff586'); gold.addColorStop(0.45, '#ffd72d'); gold.addColorStop(1, '#ff9200');
        ctx.strokeStyle = '#100516'; ctx.fillStyle = '#100516';
        ctx.strokeText(label, left, 29, textW); ctx.fillText(label, left, 29, textW);
        ctx.strokeText(label, left, 26, textW); ctx.fillStyle = gold; ctx.fillText(label, left, 26, textW);
        const keyX = 308; // source pixels in title_play.png
        ctx.drawImage(art, keyX, 0, art.width - keyX, art.height, left + textW + gap, 0, keyW, canvas.height);
        ctx.restore();
        continue;
      }
      const scale = Math.min((play ? canvas.width : 25) / art.width, canvas.height / art.height);
      const w = Math.round(art.width * scale), h = Math.round(art.height * scale);
      const left = play ? Math.round((canvas.width - w) / 2) : 0;
      ctx.drawImage(R.sourceAtSize(art, w), left, Math.round((canvas.height - h) / 2), w, h);
      if (play) continue;
      ctx.font = 'bold 11px ' + I18n.fonts; ctx.letterSpacing = '1.2px';
      const x = w + 7, y = Math.round(canvas.height / 2) + 4;
      ctx.fillStyle = '#150d21'; ctx.fillText(label, x, y + 1, canvas.width - x - 1);
      ctx.fillStyle = '#f0b8e8'; ctx.fillText(label, x, y, canvas.width - x - 1);
    }
  },

  show(focusPlay = false) {
    if (G.state === 'local') Local.leave();
    if (this.page) { this.page.hidden = true; this.page = null; }
    RaceInput.clear();
    G.state = 'title'; G.keys = {}; G.auto = false;
    Sound.stopMusic();
    this.root.hidden = false;
    this.nav.hidden = false;
    this.drawScene();
    canvas.blur();
    canvas.setAttribute('aria-hidden', 'true');
    if (focusPlay) this.playButton.focus({ preventScroll: true });
  },

  play() {
    this.root.hidden = true;
    canvas.removeAttribute('aria-hidden');
    canvas.focus({ preventScroll: true });
    G.openSelect();
  },

  openPage(id, button) {
    this.opener = button;
    this.page = document.getElementById(id + '-page');
    this.nav.hidden = true;
    this.page.hidden = false;
    if (id === 'multi') Local.buildLobby();
    if (id === 'controls') Local.readLayout();
    this.page.querySelector('h1').focus({ preventScroll: true });
  },

  back() {
    this.page.hidden = true;
    this.page = null;
    this.nav.hidden = false;
    this.opener.focus({ preventScroll: true });
  },

  keydown(e) {
    if (e.code === 'Escape' && this.page) { e.preventDefault(); this.back(); return; }
    if (e.target === this.language) return;
    if (e.code === 'KeyM' && !e.repeat) this.toggleSound();
    if (e.code === 'KeyP' && !e.repeat) this.togglePixel();
    if (this.page) return;
    const buttons = [...this.nav.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    if (e.code === 'Enter' && index < 0 && !e.repeat) { e.preventDefault(); this.play(); }
    if (['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(e.code)) {
      e.preventDefault();
      const dir = e.code === 'ArrowLeft' || e.code === 'ArrowUp' ? -1 : 1;
      buttons[index < 0 ? 0 : (index + dir + buttons.length) % buttons.length].focus();
    }
  },

  padAction(action) {
    if (action === 'back' || action === 'cancel') { if (this.page) this.back(); return; }
    if (action === 'start' && this.page?.id === 'multi-page') { Local.start(); return; }
    const scope = this.page || this.nav;
    const items = [...scope.querySelectorAll('button, select, summary, input')].filter(el => el.getClientRects().length);
    const focused = document.activeElement, at = items.indexOf(focused);
    if (!items.length) return;
    const change = dir => {
      const choices = [...focused.options].filter(opt => !opt.disabled);
      const index = choices.findIndex(opt => opt.selected);
      focused.value = choices[(index + dir + choices.length) % choices.length].value;
      focused.dispatchEvent(new Event('change', {bubbles: true}));
    };
    if (action === 'accept' || action === 'start') {
      if (at >= 0 && focused.tagName === 'SELECT') change(1);
      else (items[at] || items[0]).click();
    } else if (['left','right','up','down'].includes(action)) {
      const dir = action === 'left' || action === 'up' ? -1 : 1;
      if (at >= 0 && focused.tagName === 'SELECT' && (action === 'left' || action === 'right')) change(dir);
      else items[at < 0 ? 0 : (at + dir + items.length) % items.length].focus();
    }
  },

  toggleSound() {
    Sound.toggleMute();
    this.saveOption('muted', Sound.muted);
    this.syncOptions();
  },
  togglePixel() {
    G.pixel = !G.pixel; this.drawScene();
    if (G.state === 'local') Local.resizeViews();
    this.saveOption('pixel', G.pixel);
    this.syncOptions();
  },
  saveOption(key, value) {
    try { localStorage.setItem('midnight-monsters.options', JSON.stringify({ ...this.readOptions(), [key]: value })); } catch {}
  },
  syncOptions() {
    if (!this.sound) return;
    this.sound.textContent = tr(Sound.muted ? 'options.off' : 'options.on');
    this.sound.setAttribute('aria-pressed', String(!Sound.muted));
    this.pixel.textContent = tr(G.pixel ? 'options.on' : 'options.off');
    this.pixel.setAttribute('aria-pressed', String(G.pixel));
  },
};
