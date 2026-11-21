import { TALES, WORDS, unitsOf } from './catalogue.js';
import { AUDIO_SOUNDS, SOUNDS, displaySound } from './phonics.js';
import { PROMPTS } from './voice-lines.js';
import { voiceFiles } from './assets/audio/narrator/catalogue.js';
import { STAR_PIANO_NOTES } from './star-piano.js';

export const GROUPS = {
  letter: 'Letter sounds', blend: 'Slow blends', word: 'Spoken words',
  tale: 'Story lines', prompt: 'Game prompts', backup: 'Backup words', music: 'Music'
};

const promptNames = {
  'sound-write':'Say the sound', 'blend-word':'Slide under the letters',
  'memory-start':'Turn the card', 'round-done':'Round complete'
};
export {SOUND_SPEEDS} from './sound-speeds.js';
const fullHuman = {
  b: { id: 'full-b', path: '/assets/audio/studio/b-full.mp3' },
  d: { id: 'full-d', path: '/assets/audio/studio/d-full.mp3' }
};

function clip(group, key, label, text, path, extra = {}) {
  return { id: group + '-' + key, group, label, text, path: path.replace(/^\.\//, '/'), ...extra };
}

export const CLIPS = [
  ...AUDIO_SOUNDS.map(letter => {
    const {ipa,example} = SOUNDS[letter];
    return clip('letter', letter, letter === 'q' ? 'qu' : displaySound(letter), '/' + ipa + '/',
      '/assets/audio/letters/' + letter + '.mp3', { example, fullTake: fullHuman[letter] });
  }),
  ...WORDS.map(w => clip('blend', w, w, w, '/assets/audio/blends/' + w + '.mp3', {units:unitsOf(w).map(u=>u.letters)})),
  ...WORDS.map(w => clip('word', w, w, w, voiceFiles['word-' + w] || '/assets/audio/words/'+w+'.mp3',
    {source:voiceFiles['word-'+w]?'ElevenLabs narration':'Human recording'})),
  ...Object.entries(TALES).map(([w,line]) => clip('tale', w, w, line, voiceFiles['tale-' + w] || '/assets/audio/tales/'+w+'.mp3',
    {source:voiceFiles['tale-'+w]?'ElevenLabs narration':'CMU SLT narration'})),
  ...Object.entries(PROMPTS).map(([id, line]) => clip('prompt', id, promptNames[id], line, voiceFiles[id])),
  ...WORDS.filter(w=>voiceFiles['word-'+w]).map(w => clip('backup', w, w, w, '/assets/audio/words/' + w + '.mp3')),
  clip('music', 'fanfare', 'Victory fanfare', '', '/assets/audio/music/fanfare.mp3'),
  ...STAR_PIANO_NOTES.map((note, i) => clip('music', note, 'Felt piano · star ' + (i+1), '', '/assets/audio/music/' + note + '.mp3'))
];
