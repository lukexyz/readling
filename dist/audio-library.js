import { ALPHABET, TALES, WORDS } from './game.js';
import { PROMPTS } from './voice-lines.js';
import { voiceFiles } from './assets/audio/narrator/catalogue.js';

export const GROUPS = {
  letter: 'Letter sounds', blend: 'Slow blends', word: 'Spoken words',
  tale: 'Story lines', prompt: 'Game prompts', backup: 'Backup words', music: 'Music'
};

const sounds = [
  ['æ','cat'], ['b','bug'], ['k','cat'], ['d','dog'], ['ɛ','hen'], ['f','fan'],
  ['ɡ','log'], ['h','hat'], ['ɪ','pig'], ['dʒ','jam'], ['k','kit'], ['l','log'],
  ['m','mat'], ['n','hen'], ['ɒ','pot'], ['p','pen'], ['kw','quit'], ['ɹ','red'],
  ['s','sun'], ['t','cat'], ['ʌ','cup'], ['v','van'], ['w','wet'], ['ks','box'],
  ['j','yes'], ['z','zip']
];
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
  ...[...ALPHABET].map((letter, i) => {
    const [ipa, example] = sounds[i];
    return clip('letter', letter, letter === 'q' ? 'qu' : letter, '/' + ipa + '/',
      '/assets/audio/letters/' + letter + '.mp3', { example, fullTake: fullHuman[letter] });
  }),
  ...WORDS.map(w => clip('blend', w, w, w, '/assets/audio/blends/' + w + '.mp3')),
  ...WORDS.map(w => clip('word', w, w, w, voiceFiles['word-' + w])),
  ...WORDS.map(w => clip('tale', w, w, TALES[w], voiceFiles['tale-' + w])),
  ...Object.entries(PROMPTS).map(([id, line]) => clip('prompt', id, promptNames[id], line, voiceFiles[id])),
  ...WORDS.map(w => clip('backup', w, w, w, '/assets/audio/words/' + w + '.mp3')),
  clip('music', 'fanfare', 'Victory fanfare', '', '/assets/audio/music/fanfare.mp3')
];
