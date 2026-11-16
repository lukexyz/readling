"""Pack a Blender take for the game: python studies/woodland/pack.py bunnies 2 41."""
import argparse
import hashlib
import json
from pathlib import Path
import runpy
import shutil
from tempfile import TemporaryDirectory

from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[2]
FAMILIES = ("vines", "mushrooms", "bunnies", "elephants", "parade")
COUNTS = (72, 80, 88)


def pack(family, level, poster):
    count = COUNTS[level-1]
    if not 1 <= poster <= count:
        raise ValueError("Poster must be a one-based frame of this take")
    stem = f"{family}-{level}"
    raw = ROOT/"assets/videos/woodland"/stem
    target = ROOT/"dist/assets/woodland"
    target.mkdir(parents=True, exist_ok=True)
    pack_shot = runpy.run_path(str(ROOT/"studies/ember-orca/pack-progression.py"))["pack_shot"]
    # Holds share a single texture rectangle. Keep intermediate PNGs and proof files out of dist.
    with TemporaryDirectory(dir=raw) as scratch:
        temp = Path(scratch)
        unique, timeline = {}, []
        for index in range(1, count+1):
            path = raw/f"{index:03}.png"
            with Image.open(path) as im:
                if im.mode != "RGBA" or im.size != (480, 360):
                    raise ValueError(f"Unexpected stage or missing alpha in {path}")
                digest = hashlib.sha256(im.tobytes()).digest()
            if digest not in unique:
                unique[digest] = len(unique)
                shutil.copyfile(path, temp/f"{len(unique):03}.png")
            timeline.append(unique[digest])
        pack_shot(temp, temp, stem, len(unique))
        manifest = temp/(stem+".json")
        data = json.loads(manifest.read_text())
        data["frames"] = [data["frames"][i] for i in timeline]
        data["poster"] = poster
        for track in ("anchors", "hats"):
            file = raw/(track+".json")
            if file.exists():
                rows = json.loads(file.read_text())
                if len(rows) != count:
                    raise ValueError(f"Expected {count} anchor rows in {file}")
                data[track] = rows
        if family in ("bunnies","elephants","parade") and not data.get("anchors"):
            raise ValueError(f"Missing tracked positions in {stem}")
        pages = [Image.open(temp/name).convert("RGBA") for name in data["sheets"]]
        for i, rect in enumerate(data["frames"], 1):
            with Image.open(raw/f"{i:03}.png") as source:
                original = source.getchannel("A")
                if not rect:
                    assert original.getbbox() is None
                    continue
                sheet, x, y, w, h, dx, dy = rect
                assert (dx, dy, dx+w, dy+h) == original.getbbox()
                cropped = pages[sheet].getchannel("A").crop((x,y,x+w,y+h))
                assert not ImageChops.difference(cropped, original.crop(original.getbbox())).getbbox()
        with Image.open(raw/f"{poster:03}.png") as still:
            assert still.getchannel("A").getbbox()
            still.save(temp/(stem+"-poster.webp"), quality=93, method=6, alpha_quality=100)
        manifest.write_text(json.dumps(data,separators=(",",":"))+"\n",encoding="utf-8")
        for filename in [*data["sheets"], stem+"-poster.webp", manifest.name]:
            shutil.copyfile(temp/filename, target/filename)
        print(f"{stem}: {count} frames, {len(unique)} distinct, {len(pages)} sheets, poster {poster}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("family", choices=FAMILIES)
    parser.add_argument("level", type=int, choices=(1,2,3))
    parser.add_argument("poster", type=int)
    args = parser.parse_args()
    pack(args.family, args.level, args.poster)
