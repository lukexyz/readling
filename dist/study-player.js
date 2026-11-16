import {drawStar, four, five} from './show-kit.js';

export function mountStudy({gallery,together,stars,surface,shots,loadShot,idPrefix='level'}) {
  const fps = 30;
  const players = [];
  const playTogetherLabel = together.textContent;
  let animation = 0;
  let comparing = false;
  let comparisonStart = 0;
  let pausedElapsed = null;

  function paint(player) {
    const {canvas, shot, asset, index} = player;
    if (!asset) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext('2d');
    ctx.resetTransform();
    ctx.clearRect(0, 0, width, height);
    if (stars.checked) {
      ctx.setTransform(width/640, 0, 0, height/480, 0, 0);
      for (let i=0; i<28; i++) {
        const t = index/fps;
        const x = (i*173+39)%640 + 6*Math.sin(t+i);
        const y = (i*97+17)%480 - 9*Math.sin(t+i*.8);
        drawStar(ctx, x, y, 4+i%5, i+t*.4, i%3 ? four : five, i%2 ? '#eac16d' : '#9bab8f');
      }
    }
    const [x, y, w, h] = shot.crop;
    const scale = Math.min(width/w, height/h);
    ctx.setTransform(scale, 0, 0, scale, (width-w*scale)/2-x*scale, (height-h*scale)/2-y*scale);
    asset.paint(ctx, index);
  }

  function displayFrame(player, index) {
    player.index = index;
    player.slider.value = index+1;
    const seconds = (index/fps).toFixed(2);
    player.clock.textContent = seconds + ' s';
    player.slider.setAttribute('aria-valuetext', `Frame ${index+1} of ${player.asset.length}, ${seconds} seconds`);
    paint(player);
  }

  function stop(player) {
    player.start = null;
    player.play.dataset.playing = 'false';
    player.play.textContent = 'Play';
  }

  function compareMode(enabled, elapsed = null) {
    comparing = enabled;
    pausedElapsed = elapsed;
    together.dataset.playing = String(enabled);
    together.textContent = enabled ? 'Pause all' : elapsed === null ? playTogetherLabel : 'Resume all';
  }

  function start(player, origin, index) {
    player.start = origin;
    player.play.dataset.playing = 'true';
    player.play.textContent = 'Pause';
    player.resume = true;
    displayFrame(player, index);
    if (!animation) animation = requestAnimationFrame(tick);
  }

  function tick(now) {
    animation = 0;
    for (const player of players) {
      if (player.start === null) continue;
      const index = Math.max(0, Math.floor((now-player.start)*fps/1000));
      if (index >= player.asset.length) {
        stop(player);
        player.resume = false;
        displayFrame(player, comparing ? player.asset.length-1 : player.shot.poster-1);
      } else if (index !== player.index) {
        displayFrame(player, index);
      }
    }
    if (players.some(player => player.start !== null)) {
      animation = requestAnimationFrame(tick);
    } else if (comparing) {
      compareMode(false);
      for (const player of players) displayFrame(player, player.shot.poster-1);
    }
  }

  function inspect(player, frame) {
    stop(player);
    compareMode(false);
    player.resume = true;
    displayFrame(player, frame-1);
  }

  for (const shot of shots) {
    const card = document.querySelector('#shot-template').content.firstElementChild.cloneNode(true);
    const get = selector => card.querySelector(selector);
    const player = {
      shot, canvas: get('canvas'), play: get('.play'), slider: get('.timeline'),
      clock: get('.clock'), start: null, index: shot.poster-1, resume: false, asset: null
    };
    players.push(player);
    card.id = `${idPrefix}-${shot.level}`;
    get('h2, h3').textContent = shot.title;
    get('.level').textContent = 'Level '+shot.level;
    if (get('.status')) get('.status').textContent = shot.status;
    get('.description').textContent = shot.description;
    player.canvas.setAttribute('aria-label', shot.description);
    player.slider.setAttribute('aria-label', shot.title+' timeline');
    get('.transport').setAttribute('role', 'group');
    get('.transport').setAttribute('aria-label', shot.title+' playback');
    get('.beats').setAttribute('aria-label', shot.title+' key poses');
    for (const [label, frame] of shot.beats) {
      const beat = document.createElement('button');
      beat.type = 'button';
      beat.textContent = label;
      beat.disabled = true;
      beat.addEventListener('click', () => inspect(player, frame));
      get('.beats').append(beat);
    }
    gallery.append(card);
    new ResizeObserver(() => paint(player)).observe(player.canvas);
    player.play.addEventListener('click', () => {
      compareMode(false);
      if (player.start !== null) {
        stop(player);
      } else {
        const index = player.resume && player.index < player.asset.length-1 ? player.index : 0;
        start(player, performance.now()-index*1000/fps, index);
      }
    });
    player.slider.addEventListener('input', () => inspect(player, Number(player.slider.value)));
    loadShot(shot.level).then(asset => {
      player.asset = asset;
      player.slider.max = asset.length;
      displayFrame(player, shot.poster-1);
      get('.load-note').hidden = true;
      for (const control of card.querySelectorAll('[disabled]')) control.disabled = false;
      together.disabled = !players.every(p => p.asset);
    }).catch(() => {
      get('.load-note').textContent = 'Couldn’t load this animation. Refresh to try again.';
    });
  }

  together.addEventListener('click', () => {
    if (comparing) {
      for (const player of players) stop(player);
      compareMode(false, performance.now()-comparisonStart);
      return;
    }
    const longest = Math.max(...players.map(player => player.asset.length))*1000/fps;
    const elapsed = pausedElapsed !== null && pausedElapsed < longest ? pausedElapsed : 0;
    compareMode(true);
    const now = performance.now();
    comparisonStart = now-elapsed;
    const frame = Math.floor(elapsed*fps/1000);
    for (const player of players) {
      if (frame < player.asset.length) start(player, comparisonStart, frame);
    }
  });
  surface.addEventListener('change', e => gallery.dataset.surface = e.target.value);
  stars.addEventListener('change', () => players.forEach(paint));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    for (const player of players) stop(player);
    cancelAnimationFrame(animation);
    animation = 0;
    compareMode(false, comparing ? performance.now()-comparisonStart : pausedElapsed);
  });
}
