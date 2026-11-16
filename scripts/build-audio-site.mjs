import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { CLIPS } from '../dist/audio-library.js';
import { VOICE_ID } from '../dist/voice-lines.js';

// The small existing game is embedded in the Sites Worker. The public asset
// URLs stay stable, so an approved take also reaches older game tabs.
const root = new URL('../dist/', import.meta.url);
const types = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8', json: 'application/json', txt: 'text/plain; charset=utf-8',
  mp3: 'audio/mpeg', svg: 'image/svg+xml', webp: 'image/webp', ttf: 'font/ttf'
};
const assets = {};
async function readAssets(directory = '') {
  const entries = await readdir(new URL(directory, root), { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.') || (!directory && entry.name === 'server')) continue;
    const path = directory + entry.name;
    if (entry.isDirectory()) { await readAssets(path + '/'); continue; }
    const type = types[path.split('.').at(-1)];
    if (!type) throw new Error('Unknown public file type for ' + path);
    const data = await readFile(new URL(path, root));
    assets['/' + path] = { type, bytes: data.toString('base64'),
      tag: createHash('sha256').update(data).digest('hex').slice(0, 20) };
  }
}
await readAssets();
for (const clip of CLIPS) {
  for (const path of [clip.path, clip.fullTake?.path].filter(Boolean)) {
    if (!assets[path]) throw new Error('Missing studio audio: ' + path);
  }
}
const code = await readFile(new URL('../worker/audio.js', import.meta.url), 'utf8');
const config = { assets, clips: CLIPS, voice: VOICE_ID,
  cues: JSON.parse(await readFile(new URL('assets/audio/blends/cues.json', root), 'utf8')) };
const server = new URL('server/', root);
await mkdir(server, { recursive: true });
await build({ stdin: { contents: code + '\nexport default createAudioSite(' + JSON.stringify(config) + ');',
  resolveDir: fileURLToPath(new URL('../worker/', import.meta.url)), sourcefile: 'audio.js' },
  bundle: true, platform: 'browser', format: 'esm', target: 'es2022', legalComments: 'inline',
  outfile: fileURLToPath(new URL('index.js', server)) });
console.log('Built ' + CLIPS.length + ' game clips and the audio studio in ' + fileURLToPath(server));
