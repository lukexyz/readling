"""Pack the eight game takes and their transparent gallery stills."""
from pathlib import Path
import runpy
import sys
from PIL import Image

here=Path(__file__).resolve().parent
root=here.parents[1]
pack_shot=runpy.run_path(str(here.parent/"ember-orca"/"pack-progression.py"))["pack_shot"]
# Render number, duration in frames, and the representative frame shown on a card.
takes={"skip":[(1,66,23),(2,107,63),(3,120,68)],
       "vault":[(1,76,21),(2,102,32),(3,99,34)],
       "relay":[(1,73,27),(3,112,46)]}
out=root/"dist/assets/dolphins"

def pack(family, posters_only=False):
    out.mkdir(parents=True,exist_ok=True)
    for render,count,poster in takes[family]:
        stem=f"{family}-{render}"
        frames=root/"assets/videos/dolphin-renders"/stem
        if not posters_only:
            pack_shot(frames,out,stem,count)
        with Image.open(frames/f"{poster:03}.png") as image:
            image.save(out/f"{stem}-poster.webp",quality=92,method=6,exact=True)

if __name__=="__main__":
    families=[arg for arg in sys.argv[1:] if arg!="--posters-only"]
    for family in families or takes:
        pack(family,posters_only="--posters-only" in sys.argv)
