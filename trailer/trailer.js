'use strict';
/* Hosts the game in an iframe, hands it to director.js and reports progress. */
const q = new URLSearchParams(location.search);
const iframe = document.getElementById('game');
const preview = document.getElementById('preview').getContext('2d');
const status = document.getElementById('status');
const say = text => { status.textContent = text; document.title = text; };
const wait = ms => new Promise(r => setTimeout(r, ms));

iframe.addEventListener('load', async () => {
  try {
    const win = iframe.contentWindow;
    while (!(win.G && win.G.state === 'shot')) await wait(100);
    // The director steps the simulation itself: stop the game's own loop,
    // force the English copy and keep the page silent.
    win.requestAnimationFrame = () => 0;
    win.eval("I18n.setLanguage('en'); Sound.muted = true; Sound.stopMusic();");
    await new Promise((resolve, reject) => {
      const s = win.document.createElement('script');
      s.src = 'trailer/director.js?' + Date.now();
      s.onload = resolve; s.onerror = () => reject(new Error('director.js'));
      win.document.body.append(s);
    });
    const T = win.Trailer, show = () => preview.drawImage(T.frame, 0, 0);

    if (q.has('t')) {
      // ?t=2,7.5 : one still per moment, saved as trailer/build/preview/tNNN.png
      const saved = [];
      for (const value of q.get('t').split(',')) {
        const f = Math.min(T.total - 1, Math.round(Number(value) * T.fps));
        await T.render({ from: f, to: f + 1, onFrame: show });
        await T.save('t' + f);
        saved.push(`t${f}.png`);
      }
      say('Images · trailer/build/preview/' + saved.join(', '));
    } else if (q.has('contact')) {
      // one thumbnail per beat (25 frames), 6 per row
      const beats = Math.floor(T.total / 25), rows = Math.ceil(beats / 6);
      const sheet = Object.assign(document.createElement('canvas'), { width: 6 * 284, height: rows * 160 });
      const g = sheet.getContext('2d');
      await T.render({
        onFrame: f => {
          if (f % 25 !== 12) return;
          const i = (f - 12) / 25;
          g.drawImage(T.frame, (i % 6) * 284, Math.floor(i / 6) * 160, 284, 160);
          show(); say(`Planche · ${i + 1}/${beats}`);
        },
      });
      await T.save('contact', sheet);
      say('Planche · trailer/build/preview/contact.png');
    } else if (q.has('run')) {
      const started = performance.now();
      await T.render({
        upload: true,
        onFrame: f => { if (f % 10 === 0) { show(); say(`Capture ${f + 1}/${T.total}`); } },
      });
      say('Encodage avec ffmpeg…');
      const res = await fetch('/encode', { method: 'POST' }).then(r => r.json());
      if (!res.ok) throw new Error(res.error);
      const seconds = ((performance.now() - started) / 1000).toFixed(0);
      say(`Terminé en ${seconds} s · ${res.frames} images → ${res.output}`);
      const video = document.getElementById('result');
      video.src = '/' + res.output + '?' + Date.now(); video.hidden = false;
    } else {
      await T.render({ from: 0, to: 1, onFrame: show });
      say('Prêt.');
    }
  } catch (err) {
    say('ERREUR ' + (err.stack || err));
    console.error(err);
  }
});
