import {loadSpriteShot} from './sprite-shot.js';
export const fps = 30;
const directory = new URL('./assets/ember-orca/', import.meta.url);

// The preview crops empty camera margins only. Each shot keeps a fixed frame
// from its first ripple through the landing, including while it is scrubbed.
export const shots = [
  {
    level: 1, title: 'Surface breath', status: 'In the game', frames:72, contact:48,
    description: 'The orca peeks above the surface, exhales a plume of mist and slips under.',
    crop: [74, 32, 380, 302], poster: 32,
    beats: [['Peek', 16], ['Exhale', 32], ['Sink', 49]]
  },
  {
    level: 2, title: 'Banking breach', status: 'In the game', frames:86, contact:44,
    description: 'The orca banks on its side. Its flank sends a broad fan of spray skimming outwards.',
    crop: [47, 63, 545, 328], poster: 58,
    beats: [['Launch', 16], ['Bank', 32], ['Splash', 58]]
  },
  {
    level: 3, title: 'Full somersault', status: 'In the game', frames:126, contact:68,
    description: 'The full flip throws water out in a ring. A heartbeat later, a tower of whitewater shoots up through the middle.',
    crop: [7, 12, 617, 430], poster: 89,
    beats: [['Invert', 38], ['Impact', 78], ['Splash', 89]]
  }
];

export function loadShot(level) {
  return loadSpriteShot(new URL(`concept-${level}.json`,directory));
}
