export const STAR_PIANO_NOTES = [1, 2, 3, 4, 5].map(n => 'star-piano-' + n);

const samples = new Map();
const voices = new Set();
const mediaNotes = [];
let context;
let resumed;
let loaded;
let generation = 0;
let nextStart = 0;

function noteURL(note) {
  return new URL('./assets/audio/music/' + note + '.mp3', import.meta.url).href;
}

// Some WebKit browsers expose HTML audio without a Web Audio context. Give each
// note its own unlocked player so its decay can overlap the following note.
function prepareMediaNotes() {
  STAR_PIANO_NOTES.forEach((note, i) => {
    if (mediaNotes[i]) return;
    const player = new window.Audio(noteURL(note));
    player.preload = 'auto';
    player.muted = true;
    const ready = player.play().then(() => {
      player.pause();
      player.currentTime = 0;
      player.muted = false;
      return player;
    }).catch(() => { mediaNotes[i] = null; return null; });
    mediaNotes[i] = ready;
  });
}

// The reveal and round buttons call this during the tap. Safari can then play
// the delayed notes when the stars arrive, even while the word audio is playing.
export function prepareStarPiano() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return prepareMediaNotes();
  try {
    context ??= new Audio();
    resumed = context.state === 'running' ? Promise.resolve() : context.resume().catch(() => {});
  } catch { return prepareMediaNotes(); }

  for (const note of STAR_PIANO_NOTES) {
    if (samples.has(note)) continue;
    const sample = fetch(noteURL(note)).then(async response => {
      if (!response.ok) throw Error(response.statusText);
      return context.decodeAudioData(await response.arrayBuffer());
    }).catch(() => { samples.delete(note); return null; });
    samples.set(note, sample);
  }
  loaded = Promise.all(STAR_PIANO_NOTES.map(note => samples.get(note)));
}

export async function playStarNote(index, delay = 0) {
  const turn = generation;
  if (!loaded) {
    if (!mediaNotes[index]) return;
    if (delay) await new Promise(resolve => setTimeout(resolve, delay * 1000));
    const player = await mediaNotes[index];
    if (!player || turn !== generation) return;
    if (player.currentTime) player.currentTime = 0;
    player.play().catch(() => {});
    return;
  }
  const [buffers] = await Promise.all([loaded, resumed]);
  const buffer = buffers[index];
  if (!buffer || turn !== generation || context.state !== 'running') return;

  const voice = context.createBufferSource();
  voice.buffer = buffer;
  voice.connect(context.destination);
  voices.add(voice);
  voice.onended = () => { voices.delete(voice); voice.disconnect(); };
  // A slow frame can deliver two arrivals together. Keep both notes distinct.
  const when = Math.max(context.currentTime + delay, nextStart);
  nextStart = when + 0.075;
  voice.start(when);
}

export function stopStarPiano() {
  generation++;
  nextStart = 0;
  for (const voice of voices) voice.stop();
  voices.clear();
  for (const note of mediaNotes) note?.then(player => player?.pause());
}
