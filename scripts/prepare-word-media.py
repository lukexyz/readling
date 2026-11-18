"""Prepare later-stage assets from public, pinned sources. See README.md for dependencies.

No network access is needed by the game, npm test, or npm run build.
"""
import argparse
import hashlib
import json
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import subprocess
import tomllib
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
CACHE = ROOT / "scripts" / ".voice-cache-rl4"
ASSETS = DIST / "assets"
GCOMPRIS = "https://raw.githubusercontent.com/KDE/gcompris-data/5cfd4e4a4236701ec5e9d04a1796b6837d945403/"
STAGES = tomllib.loads((DIST / "words.toml").read_text(encoding="utf-8"))["stages"]


def fetch(url, path):
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(url, headers={"User-Agent": "Readling word media/1"})
        for attempt in range(3):
            try:
                with urllib.request.urlopen(request, timeout=25) as src:
                    data = src.read()
                path.write_bytes(data)
                break
            except OSError:
                if attempt == 2:
                    raise RuntimeError(f"Could not fetch {url}")
    return path


def source(entry):
    w = entry["word"]
    voice = entry.get("voice", "en_GB")
    if voice == "commons":
        filename = f"En-us-{w}.ogg"
        shard = hashlib.md5(filename.encode()).hexdigest()
        url = (f"https://upload.wikimedia.org/wikipedia/commons/{shard[0]}/{shard[:2]}/{filename}"
               "?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=original")
        return fetch(url, CACHE / "voice" / f"{w}.ogg")
    return fetch(GCOMPRIS + f"voices/{voice}/words/{w}.ogg", CACHE / "voice" / f"{w}.ogg")


def prepare_sources(entry):
    from PIL import Image, ImageOps
    w = entry["word"]
    if entry.get("art") != "woodcut":
        src = fetch(GCOMPRIS + f"words/words-webp/{w}.webp", CACHE / "images" / f"{w}.webp")
        # Keep the whole picture and its proportions on the same cream paper as the starter cards.
        with Image.open(src) as im:
            im = ImageOps.contain(im.convert("RGBA"), (288, 288))
            paper = Image.new("RGB", (320, 320), "#fbf8ed")
            paper.paste(im, ((320 - im.width) // 2, (320 - im.height) // 2), im)
            paper.save(ASSETS / "words" / f"{w}.webp", quality=82, method=6)
    source(entry)


def entries():
    return [entry for stage in STAGES if stage["number"] > 1 for entry in stage["words"]]


def ffmpeg(args, pcm=None):
    return subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args],
                          input=pcm, capture_output=True, check=True).stdout


def encode(samples, file, slow=1):
    import numpy as np
    pcm = np.asarray(samples, dtype="<i2").tobytes()
    ffmpeg(["-f", "s16le", "-ar", "16000", "-ac", "1", "-i", "pipe:0",
            "-af", f"atempo={slow}", "-map_metadata", "-1", "-c:a", "libmp3lame",
            "-b:a", "48k", "-ar", "24000", str(file)], pcm)


def prepare_audio():
    import numpy as np
    from pocketsphinx import Decoder
    audio = ASSETS / "audio"
    cmd = """import {WORDS,unitsOf} from './dist/catalogue.js'; import {SOUNDS,AUDIO_SOUNDS} from './dist/phonics.js';
    console.log(JSON.stringify({words:Object.fromEntries(WORDS.map(w=>[w,unitsOf(w).map(u=>SOUNDS[u.id])])),
    sounds:AUDIO_SOUNDS.filter(id=>id.length>1).map(id=>SOUNDS[id])}))"""
    readings = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", cmd], cwd=ROOT))
    local = threading.local()
    speed = .58

    def prepare(entry):
        w = entry["word"]
        original = ffmpeg(["-i", str(source(entry)), "-f", "s16le", "-ar", "16000", "-ac", "1", "pipe:1"])
        data = np.frombuffer(original, dtype="<i2").astype(float)
        peak = np.max(np.abs(data))
        active = np.flatnonzero(np.abs(data) > max(peak * .012, 35))
        if not len(active):
            raise ValueError(f"Silent recording: {w}")
        data = data[max(0, active[0]-800):active[-1]+1200] * (25000/peak)
        data = np.pad(data, (800, 1000)).astype("<i2")
        sounds = readings["words"][w]
        phones = [s["phones"].split() for s in sounds]
        if not hasattr(local, "decoder"):
            local.decoder = Decoder(lm=None, loglevel="ERROR")
        decoder = local.decoder
        key = "readling-" + w
        decoder.add_word(key, " ".join(p for group in phones for p in group), False)
        decoder.set_align_text(key)
        pcm = data.tobytes()
        for step in range(2):
            decoder.start_utt()
            decoder.process_raw(pcm, full_utt=True)
            decoder.end_utt()
            if step == 0:
                decoder.set_alignment()
        alignment = next((a for a in decoder.get_alignment() if a.name == key), None)
        if alignment is None:
            raise ValueError(f"Could not align the recording of {w}")
        frames = list(alignment)
        if len(frames) != sum(map(len, phones)):
            raise ValueError(f"Check the phonemes of {w}")
        offsets, at = [], 0
        for group in phones:
            offsets.append(frames[at].start * .01)
            at += len(group)
        encode(data, audio / "words" / f"{w}.mp3")
        encode(data, audio / "blends" / f"{w}.mp3", speed)
        for spec in readings["sounds"]:
            if spec["example"] != w:
                continue
            i = next(i for i, s in enumerate(sounds) if s["audio"] == spec["audio"])
            start = max(0, int(offsets[i]*16000)-80)
            end = int((offsets[i+1] if i+1 < len(offsets) else (frames[-1].start+frames[-1].duration)*.01)*16000)
            segment = data[start:end].astype(float)
            if len(segment)<160 or np.max(np.abs(segment))<30:
                raise ValueError(f"Check the isolated sound {spec['id']} from {w}")
            fade = min(80, len(segment)//3)
            segment[:fade] *= np.linspace(0,1,fade)
            segment[-fade:] *= np.linspace(1,0,fade)
            encode(np.pad(segment * (22500/np.max(np.abs(segment))), (120,400)),
                   audio / "letters" / (spec["audio"]+".mp3"), .75)
        if "tale" in entry:
            # CMU's bundled voice, generated once. Classroom playback needs no speech service.
            dest = audio / "tales"
            dest.mkdir(exist_ok=True)
            tale_src = CACHE / f"tale-{w}.txt"
            tale_src.write_text(entry["tale"], encoding="utf-8")
            ffmpeg(["-f", "lavfi", "-i", f"flite=textfile=scripts/.voice-cache-rl4/tale-{w}.txt:voice=slt",
                    "-af","volume=1.5","-c:a","libmp3lame","-b:a","64k",str(dest / f"{w}.mp3")])
        return w, [round(s/speed, 3) for s in offsets[1:]]

    cue_file = audio / "blends" / "cues.json"
    old = json.loads(cue_file.read_text())
    cues = {e["word"]: old[e["word"]] for e in STAGES[0]["words"]}
    with ThreadPoolExecutor(max_workers=4) as pool:
        cues.update(pool.map(prepare, entries()))
    cue_file.write_text(json.dumps(cues, indent=2)+"\n", encoding="utf-8")
    print(f"Prepared {len(cues)} sets of blend timings.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sources", action="store_true", help="fetch originals and prepare the pictures")
    parser.add_argument("--audio", action="store_true", help="align, level and encode the later recordings")
    args = parser.parse_args()
    if args.sources:
        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(prepare_sources, entries()))
        print(f"Prepared sources for {len(entries())} later-stage words.")
    if args.audio:
        prepare_audio()
