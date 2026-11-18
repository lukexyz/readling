"""Pack the review gallery, or the playable stage collections with --game."""
import base64
import io
import json
import sys
import tomllib
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DIST = ROOT / "dist"
FAMILIES = ("oak", "poppy", "moth", "book", "compass")


def uri(mime, data):
    return f"data:{mime};base64," + base64.b64encode(data).decode("ascii")


def badge_webp(key):
    with Image.open(ROOT / "assets/videos/badge-studies" / (key + ".png")) as image:
        assert image.mode == "RGBA" and image.size == (384, 384), key
        box = image.getchannel("A").getbbox()
        assert box and min(box[0], box[1], 384-box[2], 384-box[3]) >= 4, key
        buffer = io.BytesIO()
        image.save(buffer, "WEBP", quality=91, method=6, alpha_quality=100)
        return buffer.getvalue()


if "--game" in sys.argv[1:]:
    output = DIST / "assets/badges"
    output.mkdir(parents=True, exist_ok=True)
    with (DIST / "words.toml").open("rb") as source:
        sets = set(FAMILIES)
        sets.update(stage["badges"] for stage in tomllib.load(source)["stages"] if "badges" in stage)
    for family in sorted(sets):
        for level in range(1, 6):
            key = f"{family}-{level}"
            (output / (key + ".webp")).write_bytes(badge_webp(key))
    print(f"Packed {len(sets)*5} game badges in {output}")
    raise SystemExit(0)

art = {}
for family in FAMILIES:
    for level in range(1, 6):
        key = f"{family}-{level}"
        art[key] = uri("image/webp", badge_webp(key))

source = (HERE / "gallery.html").read_text(encoding="utf-8")
source = source.replace("/* GALLERY_STYLE */", (HERE / "gallery.css").read_text(encoding="utf-8"))
source = source.replace("/* GALLERY_SCRIPT */", (HERE / "gallery.js").read_text(encoding="utf-8"))
source = source.replace("__BADGE_ART__", json.dumps(art, separators=(",", ":")))
for key, name, mime in [("SERIF","fonts/young-serif.ttf","font/ttf"),
                        ("SANS","fonts/nunito.ttf","font/ttf"),
                        ("LOGO","readling.svg","image/svg+xml"), ("CAT","words/cat.webp","image/webp")]:
    source = source.replace(f"__{key}__", uri(mime, (DIST / "assets" / name).read_bytes()))
target = DIST / "badge-studies.html"
target.write_text(source, encoding="utf-8", newline="\n")
print(f"{target}: 25 badges, {target.stat().st_size:,} bytes")
