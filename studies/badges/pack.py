"""Build the self-contained review gallery after rendering the badges."""
import base64
import io
import json
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DIST = ROOT / "dist"


def uri(mime, data):
    return f"data:{mime};base64," + base64.b64encode(data).decode("ascii")


art = {}
for family in ("oak", "poppy", "moth", "book", "compass"):
    for level in range(1, 6):
        key = f"{family}-{level}"
        with Image.open(ROOT / "assets/videos/badge-studies" / (key + ".png")) as image:
            assert image.mode == "RGBA" and image.size == (384, 384), key
            box = image.getchannel("A").getbbox()
            assert box and min(box[0], box[1], 384-box[2], 384-box[3]) >= 4, key
            buffer = io.BytesIO()
            image.save(buffer, "WEBP", quality=91, method=6, alpha_quality=100)
            art[key] = uri("image/webp", buffer.getvalue())

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
