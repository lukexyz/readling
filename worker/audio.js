import { Mp3Encoder } from '@breezystack/lamejs';
import { SOUND_SPEEDS } from '../dist/sound-speeds.js';

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_SECONDS = 40;
const MAX_GENERATED_SOUND_SECONDS = 1.5;
const DIGEST = /^[a-f0-9]{64}$/;
const NO_STORE = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };

class StudioError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function json(data, status = 200) {
  return Response.json(data, { status, headers: NO_STORE });
}
async function fingerprint(bytes) {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(hash, b => b.toString(16).padStart(2, '0')).join('');
}
function decodeAsset(asset) {
  return Uint8Array.from(atob(asset.bytes), c => c.charCodeAt(0));
}
function serveBytes(request, bytes, type, tag, cache = 'no-cache') {
  const size = bytes.byteLength;
  const headers = new Headers({ 'Content-Type': type, 'Cache-Control': cache,
    'Accept-Ranges': 'bytes', 'ETag': '"' + tag + '"', 'X-Content-Type-Options': 'nosniff' });
  if (request.headers.get('If-None-Match') === headers.get('ETag')) return new Response(null, { status: 304, headers });
  let start = 0, end = size - 1, status = 200;
  const range = request.headers.get('Range');
  if (range && (!request.headers.has('If-Range') || request.headers.get('If-Range') === headers.get('ETag'))) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match && (match[1] || match[2])) {
      start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
      end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
      if (start > end || start >= size) {
        headers.set('Content-Range', 'bytes */' + size);
        return new Response(null, { status: 416, headers });
      }
      status = 206;
      headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + size);
    }
  }
  headers.set('Content-Length', String(end - start + 1));
  return new Response(request.method === 'HEAD' ? null : bytes.subarray(start, end + 1), { status, headers });
}

async function readLimited(stream, limit) {
  if (!stream) throw new StudioError(400, 'The recording or request was empty.');
  const reader = stream.getReader(), chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) { await reader.cancel(); throw new StudioError(413, 'This file or request is too large.'); }
    chunks.push(value);
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
async function readJSON(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw new StudioError(415, 'Expected JSON.');
  const data = await readLimited(request.body, 4096);
  try { return JSON.parse(new TextDecoder().decode(data)); }
  catch { throw new StudioError(400, 'Unreadable request.'); }
}

// Canonical 16-bit PCM. Measure the sounding frames, so a pause around a
// plosive cannot drive the gain up. Preserve dynamics and allow peak headroom.
export function prepareWav(pcm, rate, channels) {
  if (![1, 2].includes(channels) || !Number.isInteger(rate) || rate < 8000 || rate > 48000 ||
      !pcm.length || pcm.length % (2 * channels) || pcm.length > MAX_BYTES - 44) {
    throw new StudioError(400, 'Use a mono or stereo recording.');
  }
  const duration = pcm.length / (rate * channels * 2);
  if (duration < 0.035 || duration > MAX_SECONDS) throw new StudioError(400, 'Choose a take between 0.035 and 40 seconds.');
  const input = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let peak = 0, square = 0, count = 0;
  for (let i = 0; i < pcm.length; i += 2) {
    const level = Math.abs(input.getInt16(i, true));
    peak = Math.max(peak, level);
    if (level > 184) { square += level * level; count++; }
  }
  if (!count) throw new StudioError(422, 'This take is silent. Try a clearer recording.');
  const gain = Math.min(8, 26028 / peak, 4125 / Math.sqrt(square / count));
  const bytes = new Uint8Array(44 + pcm.length), dv = new DataView(bytes.buffer);
  const label = (offset, name) => bytes.set(new TextEncoder().encode(name), offset);
  label(0, 'RIFF'); dv.setUint32(4, bytes.length - 8, true); label(8, 'WAVE'); label(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, channels, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate * channels * 2, true);
  dv.setUint16(32, channels * 2, true); dv.setUint16(34, 16, true);
  label(36, 'data'); dv.setUint32(40, pcm.length, true);
  for (let i = 0; i < pcm.length; i += 2) dv.setInt16(i + 44, Math.round(input.getInt16(i, true) * gain), true);
  return { bytes, duration };
}

function fromUpload(bytes) {
  if (bytes.length < 46) throw new StudioError(400, 'The recording is incomplete.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const four = i => new TextDecoder().decode(bytes.subarray(i, i + 4));
  if (four(0) !== 'RIFF' || four(8) !== 'WAVE' || four(12) !== 'fmt ' || four(36) !== 'data' ||
      view.getUint32(16, true) !== 16 || view.getUint16(20, true) !== 1 || view.getUint16(34, true) !== 16 ||
      view.getUint32(40, true) !== bytes.length - 44) throw new StudioError(400, 'The studio needs a PCM recording.');
  return prepareWav(bytes.subarray(44), view.getUint32(24, true), view.getUint16(22, true));
}

function encodeMixed({ bytes, duration }, rate, channels) {
  const encoder = new Mp3Encoder(channels, rate, 128), view = new DataView(bytes.buffer, 44);
  const frames = view.byteLength / (channels * 2), chunks = [];
  for (let offset = 0; offset < frames; offset += 1152) {
    const count = Math.min(1152, frames - offset), left = new Int16Array(count);
    const right = channels === 2 ? new Int16Array(count) : undefined;
    for (let i = 0; i < count; i++) {
      const at = (offset + i) * channels * 2;
      left[i] = view.getInt16(at, true);
      if (right) right[i] = view.getInt16(at + 2, true);
    }
    chunks.push(encoder.encodeBuffer(left, right));
  }
  chunks.push(encoder.flush());
  const data = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let index = 0;
  for (const chunk of chunks) { data.set(chunk, index); index += chunk.length; }
  return { bytes: data, duration };
}

function requireOwner(request, env) {
  if (!isOwner(request, env)) throw new StudioError(403, 'Sign in with the ChatGPT account that owns Word Woods.');
  if (request.method === 'POST' && request.headers.get('Origin') !== new URL(request.url).origin) {
    throw new StudioError(403, 'Open the audio studio on the Word Woods site.');
  }
}
function isOwner(request, env) {
  const email = request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
  return Boolean(request.headers.get('oai-authenticated-user-id') && email && email === env.AUDIO_OWNER_EMAIL?.trim().toLowerCase());
}
function metadata(object) { return object?.customMetadata || {}; }
function conditional(object) {
  return object ? { etagMatches: object.etag } : new Headers({ 'If-None-Match': '*' });
}
function clipState(object) {
  const m = metadata(object);
  return { version: m.version || 'original', take: m.take || 'original', source: m.source || 'Bundled recording',
    cues: m.cues ? JSON.parse(m.cues) : null };
}
const liveKey = c => 'live/' + c.id;
const draftKey = (c, id) => 'takes/' + c.id + '/' + id;
const pendingKey = c => 'pending/' + c.id;
async function remember(bucket, clip, id) {
  await bucket.put(pendingKey(clip), id);
  return { take: id };
}

function speechRequest(clip, body) {
  if (clip.group === 'letter') {
    const pace = body?.pace ?? 'natural';
    if (!Object.hasOwn(SOUND_SPEEDS, pace)) throw new StudioError(400, 'Choose a pace from the studio.');
    const ipa = clip.text.slice(1, -1);
    return { input: { text: '<phoneme alphabet="ipa" ph="' + ipa + '">' + clip.label + '</phoneme>',
      model_id: 'eleven_flash_v2', language_code: 'en',
      voice_settings: { stability: 0.65, similarity_boost: 0.8, speed: SOUND_SPEEDS[pace] } },
      direction: clip.text + ' · ' + (pace === 'slower' ? 'Slower' : 'Natural') + ' pace' };
  }
  const note = body?.direction;
  if (typeof note !== 'string' || note.length > 200 || /[\[\]\r\n]/.test(note)) {
    throw new StudioError(400, 'Use up to 200 characters of delivery direction on one line.');
  }
  const direction = note.trim();
  return { input: { text: (direction ? '[' + direction + '] ' : '') + clip.text,
    model_id: 'eleven_v3', language_code: 'en', voice_settings: { stability: 0.5, similarity_boost: 0.8 } }, direction };
}

function unsuitableLetter(clip, m) {
  return clip.group === 'letter' && m.source === 'ElevenLabs' &&
    !(Number(m.duration) > 0 && Number(m.duration) <= MAX_GENERATED_SOUND_SECONDS);
}
function lengthMessage(clip) {
  return 'This preview is too long for a single ' + clip.text + ' sound. Try the human recording or upload a take.';
}
async function generate(env, clip, body, voice, speak) {
  if (clip.group === 'music') throw new StudioError(400, 'Upload a recording for the fanfare.');
  const { input, direction } = speechRequest(clip, body);
  const take = await fingerprint(new TextEncoder().encode(JSON.stringify([voice, input, 'pcm_24000', 'mp3-mix1'])));
  const bucket = env.BUCKET, key = draftKey(clip, take);
  if (await bucket.head(key)) return remember(bucket, clip, take);
  // Keep a failed length check so repeating the same request cannot buy it again.
  const rejectedKey = 'unsuitable/' + clip.id + '/' + take;
  if (clip.group === 'letter' && await bucket.head(rejectedKey)) throw new StudioError(422, lengthMessage(clip));
  if (!env.ELEVENLABS_API_KEY) throw new StudioError(503, 'The site owner needs to connect ElevenLabs.');
  const lockKey = 'generating/' + clip.id + '/' + take;
  const prior = await bucket.head(lockKey);
  const busy = () => new StudioError(409, 'This take is already generating. Try the same direction again in a moment.');
  if (prior && Date.now() - prior.uploaded.getTime() < 120000) throw busy();
  const lock = await bucket.put(lockKey, crypto.randomUUID(), { onlyIf: conditional(prior) });
  if (!lock) throw busy();
  try {
    if (await bucket.head(key)) return await remember(bucket, clip, take);
    if (clip.group === 'letter' && await bucket.head(rejectedKey)) throw new StudioError(422, lengthMessage(clip));
    const response = await speak('https://api.elevenlabs.io/v1/text-to-speech/' + voice + '?output_format=pcm_24000',
      { method: 'POST', headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(input), signal: AbortSignal.timeout(45000) });
    if (!response.ok) {
      const reason = (await response.json().catch(() => null))?.detail?.status;
      const detail = typeof reason === 'string' && /^[a-z_]{1,60}$/.test(reason) ? ' (' + reason + ')' : '';
      throw new StudioError(502, 'ElevenLabs returned ' + response.status + detail + '. You can still upload a recording.');
    }
    const pcm = await readLimited(response.body, MAX_BYTES);
    if (clip.group === 'letter' && pcm.length / (24000 * 2) > MAX_GENERATED_SOUND_SECONDS) {
      await bucket.put(rejectedKey, 'too long');
      throw new StudioError(422, lengthMessage(clip));
    }
    const mix = prepareWav(pcm, 24000, 1);
    const { bytes, duration } = encodeMixed(mix, 24000, 1);
    await bucket.put(key, bytes, { httpMetadata: { contentType: 'audio/mpeg' }, customMetadata:
      { source: 'ElevenLabs', duration: String(duration), direction } });
    return await remember(bucket, clip, take);
  } finally { await bucket.delete(lockKey); }
}

export function createAudioSite({ assets, artwork = {}, upload, clips, voice, cues }, speak = fetch) {
  const byId = new Map(clips.map(c => [c.id, c]));
  const byPath = new Map(clips.map(c => [c.path, c]));
  function bundled(request, path) {
    const file = Object.hasOwn(assets, path) && assets[path];
    if (!file) throw new StudioError(404, 'File not found.');
    return serveBytes(request, decodeAsset(file), file.type, file.tag);
  }
  async function handler(request, env) {
    const url = new URL(request.url), path = url.pathname;
    const read = request.method === 'GET' || request.method === 'HEAD';
    const image = Object.hasOwn(artwork,path) && artwork[path];
    if (image) {
      const bucket = env.BUCKET, key = 'celebration-art/'+image.hash;
      if (request.method === 'PUT') {
        const grant = request.headers.get('X-Readling-Release') || '';
        if (!upload || !(Date.now() < upload.until) || !/^[a-f0-9]{64}$/.test(grant) ||
            await fingerprint(new TextEncoder().encode(grant)) !== upload.hash)
          throw new StudioError(403,'Release access required.');
        if (Number(request.headers.get('Content-Length')) !== image.size)
          throw new StudioError(400,'Unexpected artwork size.');
        const body = await readLimited(request.body,image.size);
        if (body.length !== image.size || await fingerprint(body) !== image.hash)
          throw new StudioError(400,'Artwork does not match this release.');
        await bucket.put(key,body,{onlyIf:new Headers({'If-None-Match':'*'}),httpMetadata:{contentType:'image/webp'}});
        return new Response(null,{status:204});
      }
      if (!read) throw new StudioError(405,'Unsupported method.');
      const result = await (request.method === 'HEAD' ? bucket.head(key) : bucket.get(key));
      if (!result) throw new StudioError(404,'Artwork has not been uploaded.');
      const headers = {'Content-Type':'image/webp','Content-Length':String(image.size),
        ETag:'"'+image.hash+'"','Cache-Control':'public, max-age=0, must-revalidate'};
      if (request.headers.get('If-None-Match') === headers.ETag) return new Response(null,{status:304,headers});
      return new Response(request.method==='HEAD' ? null : result.body,{headers});
    }
    if (path === '/api/studio/session' && read) {
      return json({ owner: isOwner(request, env), signedIn: Boolean(request.headers.get('oai-authenticated-user-id')),
        connected: Boolean(env.ELEVENLABS_API_KEY), voice });
    }
    if (path.startsWith('/api/studio/')) {
      const match = /^\/api\/studio\/clip\/([a-z-]+)(?:\/(generate|upload|publish|draft|original)(?:\/([a-f0-9]+))?)?$/.exec(path);
      const clip = match && byId.get(match[1]);
      if (!clip) throw new StudioError(404, 'Unknown clip.');
      const [, , action, take] = match, bucket = env.BUCKET;
      if (action === 'original' && !take && read) return bundled(request, clip.path);
      if (!bucket) throw new StudioError(503, 'Audio storage is unavailable.');
      if (!action && read) {
        const live = clipState(await bucket.head(liveKey(clip)));
        let draft = null, draftNotice = '';
        if (isOwner(request, env)) {
          const pending = await bucket.get(pendingKey(clip));
          if (pending) {
            const id = await pending.text(), saved = await bucket.head(draftKey(clip, id));
            if (saved && unsuitableLetter(clip, metadata(saved))) draftNotice = 'The previous preview was too long for ' + clip.text + '.';
            else if (saved) draft = { take: id, ...metadata(saved) };
          }
        }
        return json({ live, draft, draftNotice });
      }
      requireOwner(request, env);
      if (action === 'draft' && read && DIGEST.test(take)) {
        const file = await bucket.get(draftKey(clip, take));
        if (!file) throw new StudioError(404, 'This take is unavailable.');
        return serveBytes(request, new Uint8Array(await file.arrayBuffer()), file.httpMetadata.contentType, file.etag, 'private, no-store');
      }
      if (request.method !== 'POST' || take) throw new StudioError(405, 'Unsupported action.');
      if (action === 'generate') return json(await generate(env, clip, await readJSON(request), voice, speak));
      if (action === 'upload') {
        if (request.headers.get('Content-Type') !== 'audio/wav') throw new StudioError(415, 'Upload a recording through the studio.');
        const mixed = fromUpload(await readLimited(request.body, MAX_BYTES));
        const format = new DataView(mixed.bytes.buffer);
        const { bytes, duration } = encodeMixed(mixed, format.getUint32(24, true), format.getUint16(22, true));
        const id = await fingerprint(bytes);
        await bucket.put(draftKey(clip, id), bytes, { httpMetadata: { contentType: 'audio/mpeg' },
          customMetadata: { source: 'Uploaded recording', duration: String(duration) } });
        return json(await remember(bucket, clip, id));
      }
      if (action === 'publish') {
        const body = await readJSON(request);
        const current = await bucket.head(liveKey(clip));
        if (body?.base !== clipState(current).version) throw new StudioError(409, 'This clip changed in another tab. Reload to compare the current take.');
        const id = body.take;
        let audio = new Uint8Array(0), source = 'Bundled recording', type = 'audio/mpeg', duration = 0;
        if (clip.fullTake && id === clip.fullTake.id) {
          audio = decodeAsset(assets[clip.fullTake.path]); source = 'Full human take';
        } else if (typeof id === 'string' && DIGEST.test(id)) {
          const file = await bucket.get(draftKey(clip, id));
          if (!file) throw new StudioError(404, 'The preview for this clip is unavailable.');
          if (unsuitableLetter(clip, metadata(file))) throw new StudioError(422, lengthMessage(clip));
          audio = new Uint8Array(await file.arrayBuffer()); type = file.httpMetadata.contentType;
          source = metadata(file).source; duration = Number(metadata(file).duration);
        } else if (id !== 'original') throw new StudioError(400, 'Choose a take for this clip.');
        const meta = { version: crypto.randomUUID(), take: id, source };
        if (clip.group === 'blend' && id !== 'original') {
          const points = body.cues;
          if (!Array.isArray(points) || points.length !== 2 || !points.every(Number.isFinite) ||
              !(points[0] > 0 && points[0] < points[1] && points[1] < duration)) {
            throw new StudioError(400, 'Set both letter changes inside the new take.');
          }
          meta.cues = JSON.stringify(points);
        }
        const saved = await bucket.put(liveKey(clip), audio, { onlyIf: conditional(current),
          httpMetadata: { contentType: type }, customMetadata: meta });
        if (!saved) throw new StudioError(409, 'Another tab changed this clip. Reload and try again.');
        return json({ live: clipState(saved) });
      }
      throw new StudioError(404, 'Unknown action.');
    }
    if (!read) throw new StudioError(405, 'Unsupported method.');
    if (path === '/assets/audio/blends/cues.json' && env.BUCKET) {
      const adjusted = { ...cues };
      const list = await env.BUCKET.list({ prefix: 'live/blend-', include: ['customMetadata'], limit: 100 })
        .catch(() => ({ objects: [] }));
      for (const item of list.objects) {
        const m = metadata(item);
        if (m.cues) adjusted[item.key.slice('live/blend-'.length)] = JSON.parse(m.cues);
      }
      return Response.json(adjusted, { headers: { 'Cache-Control': 'no-cache' } });
    }
    const clip = byPath.get(path);
    if (clip && env.BUCKET) {
      // The bundled classroom recordings remain playable during a storage outage.
      const file = await env.BUCKET.get(liveKey(clip)).catch(() => null);
      if (file && metadata(file).take !== 'original') {
        return serveBytes(request, new Uint8Array(await file.arrayBuffer()), file.httpMetadata.contentType, metadata(file).version);
      }
    }
    return bundled(request, path === '/' ? '/index.html' : path);
  }
  return { async fetch(request, env) {
    try { return await handler(request, env); }
    catch (err) { return json({ error: err.status ? err.message : 'The audio studio could not complete this request. Try again.' }, err.status || 503); }
  } };
}
