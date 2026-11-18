import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createAudioSite, prepareWav } from '../worker/audio.js';
import { CLIPS } from '../dist/audio-library.js';

const origin = 'https://studio.example', owner = { 'oai-authenticated-user-id': 'test-user', 'oai-authenticated-user-email': 'editor@example.test' };
test('a release can populate only its exact artwork, which is then publicly readable', async () => {
  const path='/assets/flower-studies/oak-3-1.webp', bytes=Buffer.from('example image');
  const sha=value=>createHash('sha256').update(value).digest('hex');
  const grant='1'.repeat(64), upload={hash:sha(grant),until:Date.now()+60000};
  const art={hash:sha(bytes),size:bytes.length}, files=new Map();
  const bucket={get:key=>files.get(key), head:key=>files.get(key),
    put:(key,body)=>files.set(key,{body})};
  const site=createAudioSite({assets:{},artwork:{[path]:art},upload,clips:[],cues:{}});
  const call=(method,payload,token)=>site.fetch(new Request(origin+path,{method,body:payload,
    headers:token?{'X-Readling-Release':token,'Content-Length':String(payload.length)}:{}}),{BUCKET:bucket});
  assert.equal((await call('GET')).status,404);
  assert.equal((await call('PUT',bytes,'2'.repeat(64))).status,403);
  assert.equal((await call('PUT',Buffer.alloc(bytes.length),grant)).status,400);
  assert.equal((await call('PUT',bytes,grant)).status,204);
  assert.equal((await call('HEAD')).headers.get('ETag'),'"'+art.hash+'"');
  assert.deepEqual(Buffer.from(await (await call('GET')).arrayBuffer()),bytes);
  upload.until=0;
  assert.equal((await call('PUT',bytes,grant)).status,403);
});
const src = new URL('../dist/', import.meta.url);
const original = Buffer.from(await readFile(new URL('assets/audio/letters/b.mp3', src)));
const fullClips = CLIPS.filter(c => c.fullTake);
const fullAssets = {};
for (const c of fullClips) fullAssets[c.fullTake.path] = await readFile(new URL(c.fullTake.path.slice(1), src));
const full = fullAssets[CLIPS.find(c => c.id === 'letter-b').fullTake.path];
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
  const assets = Object.fromEntries(Object.entries(fullAssets).map(([path, bytes]) => [path, audio(bytes)]));
  assets['/assets/audio/letters/b.mp3'] = audio(original);
  const app = createAudioSite({ assets, clips: CLIPS, voice: 'test-voice', cues: { bug: [.32, .77] } }, speak || (() => assert.fail('Unexpected paid request')));
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
  assert.equal(new Set(CLIPS.map(c => c.id)).size, expected.length);
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
test('a letter sends only the phoneme, and old instructions cannot trigger another charge', async () => {
  let calls = 0;
  const { mutate } = fixture(async (url, options) => {
    calls++; assert.match(url, /test-voice\?output_format=pcm_24000$/);
    const input = JSON.parse(options.body);
    assert.equal(input.text, '<phoneme alphabet="ipa" ph="d">d</phoneme>');
    assert.equal(input.model_id, 'eleven_flash_v2'); assert.equal(input.voice_settings.speed, 1);
    await new Promise(resolve => setTimeout(resolve, 15)); return new Response(draftSamples);
  });
  const old = { direction: '"d" (Clear, gentle phonics sound. Do not include this text.)' };
  const pair = await Promise.all([mutate('letter-d', 'generate', old), mutate('letter-d', 'generate', { pace: 'natural' })]);
  assert.deepEqual(pair.map(r => r.status).sort(), [200, 409]);
  assert.equal((await mutate('letter-d', 'generate', {direction:'a different sentence'})).status, 200);
  assert.equal(calls, 1);
});
test('the phoneme comes from the shelf for every spelling and slower pace changes only synthesis settings', async () => {
  let input;
  const { mutate } = fixture(async (_url, options) => { input = JSON.parse(options.body); return new Response(draftSamples); });
  for (const c of CLIPS.filter(c => c.group === 'letter')) {
    assert.equal((await mutate(c.id, 'generate', { pace: 'slower', text: 'wrong', direction: 'wrong' })).status, 200);
    assert.equal(input.text, '<phoneme alphabet="ipa" ph="' + c.text.slice(1,-1) + '">' + c.label + '</phoneme>');
    assert.equal(input.voice_settings.speed, 0.8);
  }
  assert.equal((await mutate('letter-d','generate',{pace:'unknown'})).status,400);
});
test('overlong generated sounds are rejected once; older long drafts cannot replace a game sound', async () => {
  let calls = 0;
  const { mutate, request, bucket } = fixture(async () => { calls++; return new Response(Buffer.alloc(9 * 24000 * 2, 65)); });
  for (let i = 0; i < 2; i++) assert.equal((await mutate('letter-d','generate',{ pace:'natural' })).status,422);
  assert.equal(calls, 1); assert.equal(await bucket.get('pending/letter-d'), null);
  const previous = 'e'.repeat(64);
  await bucket.put('takes/letter-d/' + previous, wave, { customMetadata:{ source:'ElevenLabs', duration:'9.02', direction:'old' } });
  await bucket.put('pending/letter-d', previous);
  const status = await (await request('/api/studio/clip/letter-d','GET',undefined,owner)).json();
  assert.equal(status.draft, null); assert.match(status.draftNotice, /too long/);
  assert.equal((await mutate('letter-d','publish',{ take:previous, base:'original' })).status,422);
  assert.equal((await mutate('letter-d','publish',{ take:'full-b', base:'original' })).status,400);
  assert.equal((await mutate('letter-d','publish',{ take:'full-d', base:'original' })).status,200);
  const played = await (await request('/assets/audio/letters/d.mp3')).arrayBuffer();
  assert.deepEqual(Buffer.from(played), fullAssets[CLIPS.find(c => c.id === 'letter-d').fullTake.path]);
});
test('story narration keeps voice directions and its own duration limits', async () => {
  const { mutate } = fixture(async (_url, options) => {
    const input = JSON.parse(options.body); assert.equal(input.model_id, 'eleven_v3');
    assert.match(input.text, /^\[warm and curious\] A little cat/);
    return new Response(Buffer.alloc(2 * 24000 * 2, 40));
  });
  assert.equal((await mutate('tale-cat','generate',{direction:'warm and curious'})).status,200);
});
test('an upload cannot change another clip and a slow blend must carry its own sound timings', async () => {
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

test('replacement blend timings use the sound count, including digraphs and longer words',async()=>{
  const {mutate,request}=fixture();
  for(const [word,cues] of [['ship',[.04,.12]],['stamp',[.03,.07,.12,.18]]]) {
    const id='blend-'+word,{take}=await (await mutate(id,'upload',wave)).json();
    assert.equal((await mutate(id,'publish',{base:'original',take,cues:cues.slice(1)})).status,400);
    assert.equal((await mutate(id,'publish',{base:'original',take,cues})).status,200);
    assert.deepEqual((await (await request('/assets/audio/blends/cues.json')).json())[word],cues);
  }
});
