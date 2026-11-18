import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { CLIPS } from '../dist/audio-library.js';
import { VOICE_ID } from '../dist/voice-lines.js';
import {checkWordMedia,laterPictures} from './word-media.mjs';

// The small existing game is embedded in the Sites Worker. The public asset
// URLs stay stable, so an approved take also reaches older game tabs.
const root = new URL('../dist/', import.meta.url);
const types = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8', json: 'application/json', toml:'text/plain; charset=utf-8', txt: 'text/plain; charset=utf-8',
  mp3: 'audio/mpeg', svg: 'image/svg+xml', webp: 'image/webp', png: 'image/png', ttf: 'font/ttf'
};
const assets = {};
const artwork = {};
async function readAssets(directory = '') {
  const entries = await readdir(new URL(directory, root), { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.') || (!directory && entry.name === 'server')) continue;
    const path = directory + entry.name;
    if (entry.isDirectory()) { await readAssets(path + '/'); continue; }
    const type = types[path.split('.').at(-1)];
    if (!type) throw new Error('Unknown public file type for ' + path);
    const data = await readFile(new URL(path, root));
    const hash = createHash('sha256').update(data).digest('hex');
    if (laterPictures.has(path) || /^assets\/(dolphins|ember-orca|flower-studies|woodland|prism)\/.*\.webp$/.test(path)) {
      artwork['/'+path] = {hash, size:data.length};
      continue;
    }
    assets['/' + path] = { type, bytes: data.toString('base64'),
      tag: hash.slice(0, 20) };
  }
}
await readAssets();
for (const clip of CLIPS) {
  for (const path of [clip.path, clip.fullTake?.path].filter(Boolean)) {
    if (!assets[path]) throw new Error('Missing studio audio: ' + path);
  }
}
const code = await readFile(new URL('../worker/audio.js', import.meta.url), 'utf8');
// The release helper supplies a short-lived verifier while populating the
// project's R2 bucket. Ordinary local builds have read-only asset routes.
const upload = process.env.READLING_ART_VERIFIER ? {
  hash:process.env.READLING_ART_VERIFIER, until:Number(process.env.READLING_ART_UNTIL)
} : null;
const config = { assets, artwork, upload, clips: CLIPS, voice: VOICE_ID,
  cues: await checkWordMedia() };
const server = new URL('server/', root);
await mkdir(server, { recursive: true });
await build({ stdin: { contents: code + '\nexport default createAudioSite(' + JSON.stringify(config) + ');',
  resolveDir: fileURLToPath(new URL('../worker/', import.meta.url)), sourcefile: 'audio.js' },
  bundle: true, platform: 'browser', format: 'esm', target: 'es2022', legalComments: 'inline',
  outfile: fileURLToPath(new URL('index.js', server)) });
console.log('Built ' + CLIPS.length + ' game clips and the audio studio in ' + fileURLToPath(server));
