import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAudioSite, prepareWav } from '../worker/audio.js';
import { CLIPS, FULL_B } from '../dist/audio-library.js';

const origin = 'https://studio.example', owner = { 'oai-authenticated-user-id': 'test-user', 'oai-authenticated-user-email': 'editor@example.test' };
const src = new URL('../dist/', import.meta.url);
const original = Buffer.from(await readFile(new URL('assets/audio/letters/b.mp3', src)));
const full = Buffer.from(await readFile(new URL(FULL_B.slice(1), src)));
const draftSamples = Buffer.alloc(12000);
for (let i = 0; i < draftSamples.length / 2; i++) draftSamples.writeInt16LE(Math.round(4200 * Math.sin(i * .12)), i * 2);
const wave = prepareWav(draftSamples, 24000, 1).bytes;
class Bucket {
  objects = new Map();
  async head(key) { return this.objects.get(key) ?? null; }
  async get(key) { return this.head(key); }
  async put(key, value, options = {}) {
    const previous = this.objects.get(key), guard = options.onlyIf;
    if ((guard instanceof Headers && guard.get('If-None-Match') === '*' && previous) ||
        (guard?.etagMatches && guard.etagMatches !== previous?.etag)) return null;
    const bytes = Buffer.from(value);
    const item = { key, uploaded: new Date(), etag: crypto.randomUUID(), customMetadata: options.customMetadata,
      httpMetadata: options.httpMetadata, arrayBuffer: async () => Uint8Array.from(bytes).buffer, text: async () => bytes.toString() };
    this.objects.set(key, item); return item;
  }
  async delete(key) { this.objects.delete(key); }
  async list({ prefix }) { return { objects: [...this.objects.values()].filter(obj => obj.key.startsWith(prefix)) }; }
}
function fixture(speak) {
  const bucket = new Bucket(), env = { BUCKET: bucket, AUDIO_OWNER_EMAIL: owner['oai-authenticated-user-email'], ELEVENLABS_API_KEY: 'test' };
  const audio = bytes => ({ bytes: bytes.toString('base64'), type: 'audio/mpeg', tag: 'test-asset' });
  const app = createAudioSite({ assets: { '/assets/audio/letters/b.mp3': audio(original), [FULL_B]: audio(full) },
    clips: CLIPS, voice: 'test-voice', fullB: FULL_B, cues: { bug: [.32, .77] } }, speak || (() => assert.fail('Unexpected paid request')));
  const request = (path, method = 'GET', bytes, headers = {}) => app.fetch(new Request(origin + path, { method,
    headers, body: bytes }), env);
  const mutate = (id, action, body, identity = owner, referer = origin) => request('/api/studio/clip/' + id + '/' + action, 'POST',
    action === 'upload' ? body : JSON.stringify(body),
    { ...identity, Origin: referer, 'Content-Type': action === 'upload' ? 'audio/wav' : 'application/json' });
  return { request, mutate, bucket };
}
test('the library contains every original MP3 once, across seven groups', async () => {
  const { readdir } = await import('node:fs/promises');
  const base = new URL('assets/audio/', src);
  const expected = (await readdir(base, { recursive: true })).map(p => p.replaceAll('\\', '/'))
    .filter(p => p.endsWith('.mp3') && !p.startsWith('studio/')).map(p => '/assets/audio/' + p).sort();
  assert.deepEqual(CLIPS.map(c => c.path).sort(), expected);
  assert.equal(new Set(CLIPS.map(c => c.id)).size, 79);
  assert.equal(new Set(CLIPS.map(c => c.group)).size, 7);
});
test('listening is public while generation, drafts and publication require the owner', async () => {
  const { request, mutate } = fixture();
  const session = await (await request('/api/studio/session')).json(); assert.equal(session.owner, false);
  for (const other of [{}, { ...owner, 'oai-authenticated-user-email': 'other@example.test' }]) {
    for (const action of ['generate', 'publish', 'upload']) assert.equal((await mutate('letter-b', action, action === 'upload' ? wave : {}, other)).status, 403);
    assert.equal((await request('/api/studio/clip/letter-b/draft/' + 'a'.repeat(64), 'GET', undefined, other)).status, 403);
  }
  assert.equal((await mutate('letter-b', 'generate', {}, owner, 'https://elsewhere.example')).status, 403);
  const get = await request('/assets/audio/letters/b.mp3', 'GET', undefined, { Range: 'bytes=0-15' });
  assert.equal(get.status, 206); assert.deepEqual(Buffer.from(await get.arrayBuffer()), original.subarray(0, 16));
});
test('audition, publish, stale tabs and restore all use the same public game URL', async () => {
  const { mutate, request } = fixture(), url = '/assets/audio/letters/b.mp3';
  const upload = await (await mutate('letter-b', 'upload', wave)).json();
  const draft = '/api/studio/clip/letter-b/draft/' + upload.take;
  const audition = await request(draft, 'GET', undefined, owner);
  assert.equal(audition.headers.get('Content-Type'), 'audio/mpeg');
  const encoded = Buffer.from(await audition.arrayBuffer());
  assert.deepEqual(Buffer.from(await (await request(url)).arrayBuffer()), original);
  const live = await (await mutate('letter-b', 'publish', { base: 'original', take: 'full-b' })).json();
  assert.deepEqual(Buffer.from(await (await request(url)).arrayBuffer()), full);
  assert.equal((await mutate('letter-b', 'publish', { base: 'original', take: upload.take })).status, 409);
  const published = await (await mutate('letter-b', 'publish', { base: live.live.version, take: upload.take })).json();
  const current = await request(url); assert.equal(current.headers.get('Content-Type'), 'audio/mpeg');
  assert.deepEqual(Buffer.from(await current.arrayBuffer()), encoded);
  assert.equal((await mutate('letter-b', 'publish', { base: published.live.version, take: 'original' })).status, 200);
  assert.deepEqual(Buffer.from(await (await request(url)).arrayBuffer()), original);
});
test('repeat directions reuse the take and two simultaneous submissions buy at most one generation', async () => {
  let calls = 0;
  const { mutate } = fixture(async (url, options) => {
    calls++; assert.match(url, /test-voice\?output_format=pcm_24000$/);
    assert.equal(JSON.parse(options.body).text, '[warm and clear] /b/');
    await new Promise(resolve => setTimeout(resolve, 15)); return new Response(draftSamples);
  });
  const body = { direction: 'warm and clear' };
  const pair = await Promise.all([mutate('letter-b', 'generate', body), mutate('letter-b', 'generate', body)]);
  assert.deepEqual(pair.map(r => r.status).sort(), [200, 409]);
  assert.equal((await mutate('letter-b', 'generate', body)).status, 200);
  assert.equal(calls, 1);
});
test('an upload cannot change another clip and a slow blend must carry its own letter timings', async () => {
  const { mutate, request } = fixture();
  assert.equal((await mutate('letter-b', 'upload', Buffer.from('broken'))).status, 400);
  const { take } = await (await mutate('blend-bug', 'upload', wave)).json();
  assert.equal((await mutate('letter-b', 'publish', { base: 'original', take })).status, 404);
  const body = { base: 'original', take };
  assert.equal((await mutate('blend-bug', 'publish', { ...body, cues: [.15, .12] })).status, 400);
  const saved = await (await mutate('blend-bug', 'publish', { ...body, cues: [.04, .12] })).json();
  const cuePath = '/assets/audio/blends/cues.json';
  assert.deepEqual((await (await request(cuePath)).json()).bug, [.04, .12]);
  await mutate('blend-bug', 'publish', { base: saved.live.version, take: 'original' });
  assert.deepEqual((await (await request(cuePath)).json()).bug, [.32, .77]);
});
