import { CLIPS, GROUPS, FULL_B } from './audio-library.js';

const $ = id => document.getElementById(id);
const byId = new Map(CLIPS.map(c => [c.id, c]));
const player = new Audio();
player.preload = 'auto';
const decoded = new Map();
const state = { clip: null, live: {}, saved: null, preview: null, session: {}, busy: false };
let selected = 0, showing = 0, playerMode = 'game', waveData = null, context, animation;
const isFile = c => ['letter', 'blend', 'backup'].includes(c.group);
const text = (id, value) => { $(id).textContent = value; };
const visible = (id, yes) => { $(id).hidden = !yes; };
const urlFor = (c, action = '') => '/api/studio/clip/' + c.id + (action ? '/' + action : '');
const currentURL = () => state.clip.path + '?v=' + encodeURIComponent(state.live.version || 'original');
const sourceName = () => state.live.take && state.live.take !== 'original' ? state.live.source :
  isFile(state.clip) ? 'Human recording' : state.clip.group === 'music' ? 'Original music' : 'ElevenLabs narration';
const defaults = {
  letter: 'Clear, gentle phonics sound. Give the release room to be heard.',
  blend: 'Slow and connected, with the sounds flowing into one another.',
  word: 'Warm and clear, like reading to one child.',
  backup: 'Warm and clear, like reading to one child.',
  tale: 'Warm and curious, with a little smile.',
  prompt: 'Friendly, patient and encouraging.'
};
const api = async (input, options = {}) => {
  const response = await fetch(input, { cache: 'no-store', ...options });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'The studio could not reach the server.');
  return result;
};
function message(value) { text('message', value); }
function search() {
  const query = $('query').value.trim().toLowerCase(), group = $('group').value;
  const found = CLIPS.filter(c => (!group || c.group === group) &&
    [c.label, c.text, c.example, GROUPS[c.group]].some(v => v?.toLowerCase().includes(query)));
  text('count', found.length + (found.length === 1 ? ' clip' : ' clips'));
  const container = $('clip-list');
  container.replaceChildren();
  let previous;
  for (const c of found) {
    if (c.group !== previous) {
      const heading = document.createElement('p');
      heading.className = 'group-name'; heading.textContent = GROUPS[c.group];
      container.append(heading); previous = c.group;
    }
    const row = document.createElement('div'), choose = document.createElement('button'), listen = document.createElement('button');
    row.className = 'clip-row' + (c.id === state.clip?.id ? ' active' : '');
    choose.className = 'clip-choice'; choose.textContent = c.label;
    choose.setAttribute('aria-pressed', String(c.id === state.clip?.id));
    const caption = document.createElement('small');
    caption.textContent = c.example ? 'as in ' + c.example : c.group === 'tale' ? c.text : '';
    choose.append(caption);
    choose.onclick = () => {
      selectClip(c);
      if (matchMedia('(max-width:740px)').matches) $('listen').scrollIntoView();
    };
    listen.className = 'row-play'; listen.textContent = '▶';
    listen.setAttribute('aria-label', 'Play ' + c.label + ', ' + GROUPS[c.group]);
    listen.onclick = () => {
      if (state.clip?.id !== c.id) selectClip(c);
      play('game');
    };
    row.append(choose, listen); container.append(row);
  }
  if (!found.length) {
    const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'No matching recordings.'; container.append(empty);
  }
}

function draw() {
  const canvas = $('wave'), g = canvas.getContext('2d');
  if (!g) return;
  const width = canvas.width, height = canvas.height, center = height / 2;
  const fraction = Number.isFinite(player.duration) ? player.currentTime / player.duration : 0;
  g.clearRect(0, 0, width, height); g.fillStyle = '#668073'; g.fillRect(0, center, width, 1);
  if (waveData) {
    const step = width / waveData.length;
    for (let i = 0; i < waveData.length; i++) {
      const size = Math.max(2, waveData[i] * (height - 4));
      g.fillStyle = i / waveData.length < fraction ? '#f2cb81' : '#d7dfae';
      g.fillRect(i * step, center - size / 2, Math.max(1, step - 1.5), size);
    }
  }
  if (!player.paused && !player.ended) animation = requestAnimationFrame(draw);
}
function redraw() { cancelAnimationFrame(animation); draw(); }
async function analyse(url) {
  if (decoded.has(url)) return decoded.get(url);
  const response = await fetch(url);
  if (!response.ok) throw new Error('This take could not be loaded.');
  context ||= new (window.AudioContext || window.webkitAudioContext)();
  const buffer = await context.decodeAudioData(await response.arrayBuffer());
  const samples = buffer.getChannelData(0), bars = new Float32Array(160);
  let max = 0;
  for (let i = 0; i < samples.length; i++) {
    const bar = Math.floor(i * bars.length / samples.length);
    bars[bar] = Math.max(bars[bar], Math.abs(samples[i])); max = Math.max(bars[bar], max);
  }
  if (max) for (let i = 0; i < bars.length; i++) bars[i] /= max;
  const result = { bars, duration: buffer.duration };
  if (decoded.size > 90) decoded.clear();
  decoded.set(url, result);
  return result;
}
async function showTrack(url, title, mode) {
  const request = ++showing;
  playerMode = mode; waveData = null; text('track-name', title); text('duration', '—'); redraw();
  try {
    const result = await analyse(url);
    if (request !== showing) return;
    waveData = result.bars; text('duration', result.duration.toFixed(2) + ' s'); redraw();
  } catch { /* Native audio playback still works on devices without waveform decoding. */ }
}
function setPlayButtons() {
  const playing = !player.paused && !player.ended;
  text('play-game', playing && playerMode === 'game' ? '■ Stop current' : '▶ Play current');
  text('play-take', playing && playerMode === 'preview' ? '■ Stop preview' : '▶ Play preview');
}
player.addEventListener('play', () => { setPlayButtons(); redraw(); });
player.addEventListener('pause', () => { setPlayButtons(); redraw(); });
player.addEventListener('ended', setPlayButtons);
player.addEventListener('error', () => message('Couldn’t play this recording. Tap play to try again.'));
function stop() { player.pause(); player.removeAttribute('src'); player.load(); }
function play(mode) {
  if (playerMode === mode && !player.paused && !player.ended) { player.pause(); return; }
  let url = currentURL(), title = sourceName();
  if (mode === 'preview') { if (!state.preview) return; url = state.preview.url; title = state.preview.name; }
  if (mode === 'example') {
    const word = byId.get('word-' + state.clip.example);
    if (!word) return;
    url = word.path; title = 'In the word “' + word.label + '”';
  }
  player.pause(); player.src = url;
  showTrack(url, title, mode);
  const attempt = showing;
  player.play().catch(e => { if (attempt === showing && e.name !== 'AbortError') message('Couldn’t play this recording. Tap play to try again.'); });
}
function renderControls() {
  const { clip, preview, session, busy, saved } = state;
  const editor = Boolean(session.owner), music = clip.group === 'music';
  visible('play-take', Boolean(preview)); visible('comparison', Boolean(preview));
  visible('use', editor && Boolean(preview) && preview.id !== state.live.take);
  $('use').disabled = busy; $('generate').disabled = busy || !editor || !session.connected;
  $('direction').disabled = busy || !editor; $('upload').disabled = busy || !editor;
  visible('generate', !music); visible('speech-form', !music); visible('credit-note', !music);
  visible('sign-in', !editor && !session.signedIn && session.loaded);
  $('sign-in').href = '/signin-with-chatgpt?return_to=' + encodeURIComponent('/audio-studio.html#' + clip.id);
  const hint = !session.loaded ? 'Checking editor access…' : editor
    ? (session.connected ? 'Owner access · ElevenLabs voice connected' : 'Owner access · Upload a recording to make a take.')
    : session.signedIn ? 'This account can listen. The Word Woods owner can edit.' : 'Sign in as the Word Woods owner to generate, upload and use a take.';
  text('access', hint);
  visible('full-b', clip.id === 'letter-b' && preview?.id !== 'full-b' && state.live.take !== 'full-b');
  visible('original', Boolean(state.live.take && state.live.take !== 'original' && preview?.id !== 'original'));
  visible('latest', Boolean(editor && saved && preview?.id !== saved.take && saved.take !== state.live.take));
  visible('cue-box', Boolean(editor && preview && clip.group === 'blend' && preview.id !== 'original'));
  if (preview) { text('preview-title', preview.name); text('preview-note', preview.note); }
  setPlayButtons();
}
function choosePreview(take) {
  state.preview = take;
  if (state.clip.group === 'blend' && take && take.id !== 'original') {
    const cue = state.live.cues && state.live.take === take.id ? state.live.cues : [take.duration / 3, take.duration * 2 / 3];
    $('cue-two').value = cue[0].toFixed(3); $('cue-three').value = cue[1].toFixed(3);
  }
  renderControls();
}
const fullTake = () => ({ id: 'full-b', name: 'Full human take', url: FULL_B,
  note: 'The same speaker, with the complete release from the original recording.' });
function savedTake(c, saved) {
  return { id: saved.take, name: saved.source + ' preview', note: saved.direction || 'Compare this recording with the one in the game.',
    duration: Number(saved.duration), url: urlFor(c, 'draft/' + saved.take) };
}
function updateCaption() {
  const c = state.clip;
  const detail = c.group === 'letter' ? c.text + ' as in ' + c.example : c.group === 'music' ? 'Played after a discovery.' : '“' + c.text + '”';
  text('clip-caption', detail + ' · ' + sourceName());
}
async function selectClip(c) {
  const ticket = ++selected;
  stop(); state.clip = c; state.live = { take: 'original', version: 'original' }; state.saved = null; state.busy = false;
  history.replaceState(null, '', '#' + c.id);
  text('clip-group', GROUPS[c.group]); text('clip-title', c.label); text('glyph', c.group === 'letter' ? c.text : c.group === 'music' ? '♫' : '♪');
  updateCaption(); message('');
  $('direction').value = defaults[c.group] || '';
  const example = c.group === 'letter' && byId.has('word-' + c.example);
  visible('play-example', example); if (example) text('play-example', 'Hear “' + c.example + '”');
  search(); choosePreview(c.id === 'letter-b' ? fullTake() : null);
  showTrack(currentURL(), sourceName(), 'game');
  try {
    const details = await api(urlFor(c));
    if (ticket !== selected) return;
    state.live = details.live; state.saved = details.draft;
    if (details.draft && details.draft.take !== details.live.take) choosePreview(savedTake(c, details.draft));
    else if (state.preview?.id === details.live.take) choosePreview(null);
    updateCaption(); renderControls();
    if (player.paused && playerMode === 'game') showTrack(currentURL(), sourceName(), 'game');
  } catch (e) { if (ticket === selected) message(e.message); }
}

// Decode whatever the tablet or desktop records, then upload a portable WAV.
async function encodeUpload(file, music) {
  if (!file || file.size > 12 * 1024 * 1024) throw new Error('Choose an audio file under 12 MB.');
  context ||= new (window.AudioContext || window.webkitAudioContext)();
  let decoded;
  try { decoded = await context.decodeAudioData(await file.arrayBuffer()); }
  catch { throw new Error('This browser couldn’t decode that file. Try MP3 or WAV.'); }
  if (decoded.duration < 0.035 || decoded.duration > 40) throw new Error('Choose a take between 0.035 and 40 seconds.');
  const channels = music ? Math.min(2, decoded.numberOfChannels) : 1, rate = music ? 44100 : 24000;
  const frames = Math.round(decoded.duration * rate);
  const offline = new OfflineAudioContext(channels, frames, rate);
  const source = offline.createBufferSource(); source.buffer = decoded; source.connect(offline.destination); source.start();
  const rendered = await offline.startRendering(), bytes = new Uint8Array(44 + frames * channels * 2), dv = new DataView(bytes.buffer);
  const label = (i, str) => bytes.set(new TextEncoder().encode(str), i);
  label(0, 'RIFF'); dv.setUint32(4, bytes.length - 8, true); label(8, 'WAVE'); label(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, channels, true); dv.setUint32(24, rate, true);
  dv.setUint32(28, rate * channels * 2, true); dv.setUint16(32, channels * 2, true); dv.setUint16(34, 16, true);
  label(36, 'data'); dv.setUint32(40, bytes.length - 44, true);
  for (let ch = 0; ch < channels; ch++) {
    const samples = rendered.getChannelData(ch);
    for (let f = 0; f < frames; f++) dv.setInt16(44 + (f * channels + ch) * 2, Math.round(Math.max(-1, Math.min(1, samples[f])) * 32767), true);
  }
  return bytes;
}
const jsonPost = value => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
async function edit(action) {
  const c = state.clip, ticket = selected;
  if (state.busy || !state.session.owner) return;
  const direction = $('direction').value.trim(), file = $('upload').files[0], preview = state.preview, base = state.live.version;
  state.busy = true; renderControls();
  try {
    if (action === 'publish') {
      if (!preview) return;
      const cues = c.group === 'blend' && preview.id !== 'original' ? [Number($('cue-two').value), Number($('cue-three').value)] : null;
      message('Updating the game…');
      const result = await api(urlFor(c, 'publish'), jsonPost({ take: preview.id, base, cues }));
      if (ticket !== selected) return;
      stop(); state.live = result.live; choosePreview(null); updateCaption(); showTrack(currentURL(), sourceName(), 'game');
      message('Saved. The game now plays this recording.');
    } else {
      message(action === 'generate' ? 'Preparing your ElevenLabs preview…' : 'Preparing your recording…');
      const options = action === 'generate' ? jsonPost({ direction }) : { method: 'POST',
        headers: { 'Content-Type': 'audio/wav' }, body: await encodeUpload(file, c.group === 'music') };
      const made = await api(urlFor(c, action), options);
      if (ticket !== selected) return;
      const draftURL = urlFor(c, 'draft/' + made.take), data = await analyse(draftURL);
      if (ticket !== selected) return;
      const saved = { take: made.take, source: action === 'generate' ? 'ElevenLabs' : 'Uploaded recording',
        direction: action === 'generate' ? direction : '', duration: data.duration };
      state.saved = saved; choosePreview(savedTake(c, saved));
      message('Preview ready. Listen to both takes before choosing one.');
    }
  } catch (error) { if (ticket === selected) message(error.message); }
  finally {
    if (ticket === selected) { state.busy = false; $('upload').value = ''; renderControls(); }
  }
}
for (const [key, label] of Object.entries(GROUPS)) $('group').add(new Option(label, key));
$('group').onchange = search; $('query').oninput = search;
$('play-game').onclick = () => play('game'); $('play-take').onclick = () => play('preview'); $('play-example').onclick = () => play('example');
$('full-b').onclick = () => choosePreview(fullTake());
$('original').onclick = () => choosePreview({ id: 'original', name: 'Bundled original', url: urlFor(state.clip, 'original'), note: 'The recording that shipped with the game.' });
$('latest').onclick = () => choosePreview(savedTake(state.clip, state.saved));
$('generate').onclick = () => edit('generate'); $('use').onclick = () => edit('publish');
$('upload').onchange = () => { if ($('upload').files.length) edit('upload'); };
window.addEventListener('hashchange', () => {
  const target = byId.get(location.hash.slice(1));
  if (target && target.id !== state.clip?.id) selectClip(target);
});
selectClip(byId.get(location.hash.slice(1)) || byId.get('letter-b'));
api('/api/studio/session').then(session => {
  state.session = { ...session, loaded: true }; renderControls();
}).catch(() => { state.session = { loaded: true }; renderControls(); message('Editor access is unavailable. You can still listen to the library.'); });
