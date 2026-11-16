import {SHOW, SHOW_GROUPS} from './game.js';
import {icon} from './drawings.js';
import {launchFinale, prepareShow} from './finale.js';
import {flowerShots} from './gardens.js';
import {woodlandShots} from './woodland.js';
import {prismShots} from './prism.js';
import {decoratePicturePoster} from './show-prism.js';
import {dolphinShots,dolphinPoster} from './dolphins.js';

// Pick the moment that shows what each addition does, including its supporting acts.
const posters = {
  music: [1.07, 'Coloured notes float up as the fanfare plays.'],
  stars: [1.94, 'Showers of gold and coloured stars burst across the sky.'],
  fountains: [1.6, 'Two fountains spray stars from the sides of the stage.'],
  fireflies: [1.81, 'Fireflies gather to spell the word cat.'],
  hats: [1.02, 'The hopping bunnies wear hats from a word card.'],
  oak: [3.32, 'An oak tree grows and drops its acorns.'],
  whale: [1.13, 'An orca surfaces and blows a plume of mist.'],
  whale2: [1.03, 'An orca banks in the air, then lands in a broad fan of foam.'],
  whale3: [1.39, 'An orca turns a full somersault and sends a tower of whitewater into the air.'],
  splash: [2.22, 'The orca sends water flying and rain falls over the stage.']
};

const examples = ['cat', 'dog', 'hen', 'bug'];
const previewSize = {width:420, height:260, unit:.82};
const grid = document.querySelector('#cards');
const filters = document.querySelector('#filters');
const status = document.querySelector('#gallery-status');
const buttons = new Map();
const playIcon = icon('play', 14);
let playing = null;

function options(button) {
  const alone = button.dataset.id;
  return {into:button.querySelector('canvas'), alone, previewSize, finds:examples, word:'cat'};
}

function drawPoster(button) {
  if (button.classList.contains('has-poster')) return;
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
  const dolphin=dolphinShots.find(shot=>shot.id===id);
  const prism=prismShots.find(shot=>shot.id===id);
  const study=prism || flowerShots.find(shot=>shot.id===id) || woodlandShots.find(shot=>shot.id===id);
  const orcaLevel=['whale','whale2','whale3'].indexOf(id)+1;
  const poster=study ? study.still : dolphin ? dolphinPoster(dolphin) : orcaLevel ? './assets/ember-orca/concept-'+orcaLevel+'-poster.webp' :
    id==='oak' ? './assets/flower-studies/oak-3-poster.webp' : '';
  if (poster) {
    const still=new Image();
    button.classList.add('has-poster');
    still.className='still-poster';
    still.loading='lazy';
    still.alt='';
    still.src=poster;
    if (prism) {
      button.classList.add('prism-card');
      decoratePicturePoster(still,prism);
    }
    button.querySelector('.preview-screen').prepend(still);
  }
  button.querySelector('.card-title').textContent = name.replace(/Level (\d+)$/, 'Level\u00a0$1');
  setControl(button, false);
  const about = document.createElement('span');
  about.id = 'about-' + id;
  about.className = 'sr-only';
  about.textContent = study?.description ?? dolphin?.description ?? posters[id]?.[1] ?? name;
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
prepareShow([...examples, 'hat']).then(() => refresh(['hats']));

const requestedGroup=new URLSearchParams(location.search).get('group');
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
  if (filter===requestedGroup) control.click();
}

document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
window.addEventListener('pagehide', stop);
