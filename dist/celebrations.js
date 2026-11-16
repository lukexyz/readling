import {SHOW, SHOW_GROUPS} from './game.js';
import {icon} from './drawings.js';
import {launchFinale, prepareShow} from './finale.js';
import {preparePoppy} from './poppy.js';
import {snailImage} from './show-creatures.js';

// Pick the moment that shows what each addition does, including its supporting acts.
const posters = {
  rainbow: [1.12, 'Seven bands of colour arc across the stage.'],
  music: [1.07, 'Coloured notes float up as the fanfare plays.'],
  stars: [1.94, 'Showers of gold and coloured stars burst across the sky.'],
  flowers: [2.18, 'A scarlet poppy opens above grass and tiny leaves, beside a nodding bud.'],
  bunnies: [1.02, 'Three paper bunnies hop up from below.'],
  fountains: [1.6, 'Two fountains spray stars from the sides of the stage.'],
  rainbow2: [1.86, 'A smaller rainbow forms underneath the first.'],
  blooms: [1.65, 'Fireworks burst into flowers and petals.'],
  parade: [1.55, 'The animals from the word cards march across the stage.'],
  mushrooms: [1.76, 'Spotted mushrooms pop up among unfurling ferns.'],
  dolphins: [.89, 'Two dolphins leap towards one another.'],
  paint: [2.18, 'Bright blobs of paint land and drip.'],
  slide: [1.62, 'A gold star rides the outer edge of the rainbow.'],
  fireflies: [1.81, 'Fireflies gather to spell the word cat.'],
  vines: [3.24, 'Leafy vines climb the edges and meet in a flower.'],
  elephants: [1.65, 'A line of elephants marches trunk to tail.'],
  hats: [1.02, 'The hopping bunnies wear hats from a word card.'],
  picture: [1.06, 'A burst of stars draws the shape of a cat.'],
  oak: [3.32, 'An oak tree grows and drops its acorns.'],
  snail: [2.08, 'A snail with a little flag inches across the stage.'],
  whale: [1.16, 'A whale breaches, then falls back in a splash.'],
  ribbon: [2.83, 'A rainbow ribbon curls into a bow.'],
  splash: [2.52, 'The whale sends water flying and rain falls over the stage.']
};

const examples = ['cat', 'dog', 'hen', 'bug'];
const previewSize = {width:420, height:260, unit:.82};
const processionSize = {width:520, height:322, unit:.53};
const grid = document.querySelector('#cards');
const filters = document.querySelector('#filters');
const status = document.querySelector('#gallery-status');
const buttons = new Map();
const playIcon = icon('play', 14);
let playing = null;

function options(button) {
  const alone = button.dataset.id;
  const size = alone === 'elephants' || alone === 'parade' ? processionSize : previewSize;
  return {into:button.querySelector('canvas'), alone, previewSize:size, finds:examples, word:'cat'};
}

function drawPoster(button) {
  if (button.clientWidth) launchFinale(null, {...options(button), freeze:posters[button.dataset.id]?.[0] ?? 1});
}

function setControl(button, active) {
  button.classList.toggle('is-playing', active);
  const name = button.querySelector('.card-title').textContent;
  const action = active ? 'Stop' : 'Play';
  button.setAttribute('aria-label', action + ' ' + name);
  button.querySelector('.play-label').innerHTML =
    (active ? '<i class="stop-mark"></i>' : playIcon) + '<span class="play-word">' + action + '</span>';
}

function stop() {
  if (!playing) return;
  const {button, show, sound} = playing;
  playing = null;
  show?.stop();
  sound?.pause();
  setControl(button, false);
  drawPoster(button);
}

function toggle(button) {
  const same = playing?.button === button;
  stop();
  if (same) return;
  const clip = {button, show:null, sound:null};
  playing = clip;
  setControl(button, true);

  // The original fanfare has a slightly longer tail than the animated notes.
  if (button.dataset.id === 'music') {
    const sound = clip.sound = new Audio('./assets/audio/music/fanfare.mp3');
    const audioDone = () => {
      if (playing !== clip) return;
      clip.sound = null;
      if (!clip.show) stop();
    };
    sound.onended = audioDone;
    sound.play().catch(audioDone);
    sound.onerror = audioDone;
  }
  clip.show = launchFinale(null, {...options(button), loop:false, onEnd(finished) {
    if (!finished || playing !== clip) return;
    clip.show = null;
    if (clip.sound) drawPoster(button);
    else stop();
  }});
  if (!clip.show && !clip.sound) stop();
}

const resize = new ResizeObserver(entries => {
  for (const {target} of entries) {
    const button = target.closest('button');
    if (button !== playing?.button) drawPoster(button);
  }
});

for (const {id, name} of SHOW) {
  const group = SHOW_GROUPS.find(([, ids]) => ids.includes(id))?.[0] ?? '';
  const item = document.createElement('li');
  item.id = id;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'gallery-card';
  button.dataset.id = id;
  button.dataset.group = group;
  button.setAttribute('aria-describedby', 'about-' + id);
  button.innerHTML = `<span class="preview-screen"><canvas width="420" height="260" aria-hidden="true"></canvas></span>
    <span class="card-footer"><span class="card-title"></span><span class="play-label" aria-hidden="true"></span></span>`;
  button.querySelector('.card-title').textContent = name;
  setControl(button, false);
  const about = document.createElement('span');
  about.id = 'about-' + id;
  about.className = 'sr-only';
  about.textContent = posters[id]?.[1] ?? name;
  item.append(button, about);
  grid.append(item);
  buttons.set(id, button);
  resize.observe(button.querySelector('.preview-screen'));
  button.addEventListener('click', () => toggle(button));
}

// Repaint the few posters that use an image once its pixels can be drawn.
function refresh(ids) {
  for (const id of ids) {
    const button = buttons.get(id);
    if (button && playing?.button !== button) drawPoster(button);
  }
}
prepareShow([...examples, 'hat']).then(() => refresh(['parade', 'picture', 'hats']));
preparePoppy().then(() => refresh(['flowers']));
snailImage().decode().then(() => refresh(['snail'])).catch(() => {});

for (const filter of ['All', ...SHOW_GROUPS.map(([name]) => name)]) {
  const control = document.createElement('button');
  control.type = 'button';
  control.textContent = filter;
  control.setAttribute('aria-pressed', String(filter === 'All'));
  control.addEventListener('click', () => {
    let visible = 0;
    for (const button of buttons.values()) {
      const hide = filter !== 'All' && button.dataset.group !== filter;
      if (hide && playing?.button === button) stop();
      button.closest('li').hidden = hide;
      if (!hide) visible++;
    }
    for (const other of filters.children) other.setAttribute('aria-pressed', String(other === control));
    status.textContent = visible + ' celebrations shown.';
  });
  filters.append(control);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
window.addEventListener('pagehide', stop);
